import createContextHook from '@nkzw/create-context-hook';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

export const [DeviceProvider, useDevice] = createContextHook(() => {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Generate or get device ID
  const generateDeviceId = useCallback((): string => {
    try {
      // Check if we already have a stored device ID
      const stored = localStorage?.getItem('device_id') || null;
      if (stored) {
        return stored;
      }

      // Generate new device ID
      const timestamp = Date.now();
      const random = Math.random().toString(36).substr(2, 9);
      const platform = Platform.OS;
      
      const uniqueId = `${platform}_${timestamp}_${random}`;
      
      // Store the generated ID
      try {
        localStorage?.setItem('device_id', uniqueId);
      } catch (e) {
        console.warn('Could not store device ID:', e);
      }
      
      return uniqueId;
    } catch (error) {
      console.error('Error generating device ID:', error);
      // Fallback to timestamp + random
      return `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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

      if (error && error.code !== '23505') {
        console.error('Error creating anonymous user:', error);
      }
      
      return data;
    } catch (error) {
      console.error('Error in createAnonymousUser:', error);
      return null;
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
        const generatedDeviceId = generateDeviceId();
        setDeviceId(generatedDeviceId);
        
        // Create anonymous user record in database
        await createAnonymousUser(generatedDeviceId);
      } catch (error) {
        console.error('Error initializing device:', error);
        // Fallback to just device ID
        const fallbackId = generateDeviceId();
        setDeviceId(fallbackId);
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