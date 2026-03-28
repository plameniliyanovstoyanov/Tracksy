import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

// Helper to add timeout to promises
const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number, fallbackValue: T): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => {
      console.warn(`Operation timed out after ${timeoutMs}ms, using fallback`);
      resolve(fallbackValue);
    }, timeoutMs))
  ]);
};

export const [DeviceProvider, useDevice] = createContextHook(() => {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Generate or get device ID
  const generateDeviceId = useCallback(async (): Promise<string> => {
    try {
      // Check if we already have a stored device ID
      const stored = await AsyncStorage.getItem('device_id');
      if (stored) {
        return stored;
      }

      // Generate new device ID
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 11);
      const platform = Platform.OS;
      
      const uniqueId = `${platform}_${timestamp}_${random}`;
      
      // Store the generated ID
      await AsyncStorage.setItem('device_id', uniqueId);
      
      return uniqueId;
    } catch (error) {
      console.error('Error generating device ID:', error);
      // Fallback to timestamp + random
      const timestamp = Date.now();
      const random = Math.random().toString(36).substring(2, 11);
      return `device_${timestamp}_${random}`;
    }
  }, []);

  // Create anonymous user in database
  const createAnonymousUser = useCallback(async (deviceId: string) => {
    if (!deviceId?.trim()) {
      console.error('Invalid device ID provided');
      return null;
    }
    
    try {
      const { data, error } = await supabase
        .from('anonymous_users')
        .upsert({
          device_id: deviceId,
          created_at: new Date().toISOString(),
          last_seen: new Date().toISOString(),
          device_info: {
            platform: Platform.OS,
            device_name: Platform.OS === 'web' ? 'Web Browser' : 'Mobile Device',
            os_version: Platform.OS === 'web' ? (typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown') : 'Unknown',
            brand: Platform.OS === 'web' ? 'Web' : 'Mobile'
          }
        }, {
          onConflict: 'device_id'
        })
        .select()
        .single();

      if (error) {
        console.warn('Could not create anonymous user record (this is OK if table does not exist):', error.message);
        return { device_id: deviceId };
      }
      
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn('Error in createAnonymousUser (continuing without database record):', errorMessage);
      return { device_id: deviceId };
    }
  }, []);

  // Update last seen for anonymous users
  const updateLastSeen = useCallback(async () => {
    if (deviceId?.trim()) {
      try {
        await supabase
          .from('anonymous_users')
          .update({ last_seen: new Date().toISOString() })
          .eq('device_id', deviceId);
      } catch (error) {
        console.error('Error updating last seen:', error);
      }
    }
  }, [deviceId]);

  useEffect(() => {
    const initializeDevice = async () => {
      try {
        const generatedDeviceId = await generateDeviceId();
        setDeviceId(generatedDeviceId);
        
        // Create anonymous user record in database (don't wait for it - do it in background)
        createAnonymousUser(generatedDeviceId).catch(error => {
          console.error('Error creating anonymous user:', error instanceof Error ? error.message : String(error));
        });
      } catch (error) {
        console.error('Error initializing device:', error);
        // Fallback to just device ID
        try {
          const fallbackId = await generateDeviceId();
          setDeviceId(fallbackId);
        } catch (e) {
          console.error('Even fallback failed:', e);
        }
      } finally {
        setLoading(false);
      }
    };

    initializeDevice();
  }, [generateDeviceId, createAnonymousUser]);

  return useMemo(() => ({
    deviceId,
    loading,
    updateLastSeen,
  }), [deviceId, loading, updateLastSeen]);
});