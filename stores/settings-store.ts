import { create } from 'zustand';
import { combine } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { BackgroundLocationService } from './location-service';
import { supabase } from '@/lib/supabase';

interface SettingsState {
  notificationsEnabled: boolean;
  vibrationEnabled: boolean;
  soundEnabled: boolean;
  backgroundTrackingEnabled: boolean;
  backgroundTrackingActive: boolean;
  earlyWarningEnabled: boolean;
}

interface SettingsActions {
  toggleNotifications: () => void;
  toggleVibration: () => void;
  toggleSound: () => void;
  toggleBackgroundTracking: () => Promise<void>;
  toggleEarlyWarning: () => void;
  startBackgroundTracking: () => Promise<boolean>;
  stopBackgroundTracking: () => Promise<void>;
  checkBackgroundTrackingStatus: () => Promise<void>;
  loadFromStorage: (userId?: string) => Promise<void>;
  saveToStorage: (userId?: string) => Promise<void>;
  loadFromDatabase: (userId: string) => Promise<void>;
  saveToDatabase: (userId: string) => Promise<void>;
  requestNotificationPermissions: () => Promise<void>;
  getSettings: () => { notificationsEnabled: boolean; vibrationEnabled: boolean; soundEnabled: boolean; };
}

export const useSettingsStore = create(
  combine(
    {
      notificationsEnabled: true,
      vibrationEnabled: true,
      soundEnabled: true,
      backgroundTrackingEnabled: false,
      backgroundTrackingActive: false,
      earlyWarningEnabled: true,
    } as SettingsState,
    (set, get) => ({
      toggleNotifications: () => {
        const newValue = !get().notificationsEnabled;
        set({ notificationsEnabled: newValue });
        const actions = get() as SettingsState & SettingsActions;
        // Save to both local storage and database (if user is authenticated)
        actions.saveToStorage();
        
        if (newValue) {
          actions.requestNotificationPermissions();
        }
      },

      toggleVibration: () => {
        set({ vibrationEnabled: !get().vibrationEnabled });
        const actions = get() as SettingsState & SettingsActions;
        actions.saveToStorage();
      },

      toggleSound: () => {
        set({ soundEnabled: !get().soundEnabled });
        const actions = get() as SettingsState & SettingsActions;
        actions.saveToStorage();
      },

      toggleEarlyWarning: () => {
        set({ earlyWarningEnabled: !get().earlyWarningEnabled });
        const actions = get() as SettingsState & SettingsActions;
        actions.saveToStorage();
      },

      toggleBackgroundTracking: async () => {
        const state = get();
        const newValue = !state.backgroundTrackingEnabled;
        
        if (newValue) {
          const actions = get() as SettingsState & SettingsActions;
          const success = await actions.startBackgroundTracking();
          if (success) {
            set({ 
              backgroundTrackingEnabled: true,
              backgroundTrackingActive: true 
            });
          }
        } else {
          const actions = get() as SettingsState & SettingsActions;
          await actions.stopBackgroundTracking();
          set({ 
            backgroundTrackingEnabled: false,
            backgroundTrackingActive: false 
          });
        }
        
        const actions = get() as SettingsState & SettingsActions;
        actions.saveToStorage();
      },

      startBackgroundTracking: async (): Promise<boolean> => {
        try {
          const success = await BackgroundLocationService.startBackgroundLocationTracking();
          if (success) {
            set({ backgroundTrackingActive: true });
            console.log('Background tracking started successfully');
          } else {
            // Ако не успее да стартира, изключваме настройката
            set({ 
              backgroundTrackingEnabled: false,
              backgroundTrackingActive: false 
            });
            const actions = get() as SettingsState & SettingsActions;
            actions.saveToStorage();
          }
          return success;
        } catch (error) {
          console.error('Failed to start background tracking:', error);
          // При грешка изключваме настройката
          set({ 
            backgroundTrackingEnabled: false,
            backgroundTrackingActive: false 
          });
          const actions = get() as SettingsState & SettingsActions;
          actions.saveToStorage();
          return false;
        }
      },

      stopBackgroundTracking: async (): Promise<void> => {
        try {
          await BackgroundLocationService.stopBackgroundLocationTracking();
          set({ backgroundTrackingActive: false });
          console.log('Background tracking stopped');
        } catch (error) {
          console.error('Failed to stop background tracking:', error);
        }
      },

      checkBackgroundTrackingStatus: async (): Promise<void> => {
        try {
          const isRunning = await BackgroundLocationService.isBackgroundLocationRunning();
          set({ backgroundTrackingActive: isRunning });
        } catch (error) {
          console.error('Failed to check background tracking status:', error);
        }
      },

      loadFromStorage: async (userId?: string) => {
        try {
          // First try to load from database if user is authenticated
          if (userId) {
            try {
              await (get() as SettingsState & SettingsActions).loadFromDatabase(userId);
              return; // If successful, don't load from local storage
            } catch (error) {
              console.warn('Failed to load settings from database, falling back to local storage:', error);
            }
          }
          
          // Fallback to local storage
          const data = await AsyncStorage.getItem('app-settings');
          if (data) {
            const parsed = JSON.parse(data);
            set({
              notificationsEnabled: parsed.notificationsEnabled ?? true,
              vibrationEnabled: parsed.vibrationEnabled ?? true,
              soundEnabled: parsed.soundEnabled ?? true,
              backgroundTrackingEnabled: parsed.backgroundTrackingEnabled ?? false,
              backgroundTrackingActive: false, // Will be checked separately
              earlyWarningEnabled: parsed.earlyWarningEnabled ?? true,
            });
            
            // Check if background tracking is actually running (in background)
            const actions = get() as SettingsState & SettingsActions;
            actions.checkBackgroundTrackingStatus().catch(err => {
              console.error('Failed to check background tracking status:', err);
            });
          }
        } catch (error) {
          console.error('Failed to load settings from storage:', error);
        }
      },

      saveToStorage: async (userId?: string) => {
        try {
          const state = get();
          const dataToSave = {
            notificationsEnabled: state.notificationsEnabled,
            vibrationEnabled: state.vibrationEnabled,
            soundEnabled: state.soundEnabled,
            backgroundTrackingEnabled: state.backgroundTrackingEnabled,
            earlyWarningEnabled: state.earlyWarningEnabled,
          };
          
          // Save to local storage (always)
          await AsyncStorage.setItem('app-settings', JSON.stringify(dataToSave));
          
          // Also save to database if user is authenticated
          if (userId) {
            try {
              await (get() as SettingsState & SettingsActions).saveToDatabase(userId);
            } catch (error) {
              console.warn('Failed to save settings to database:', error);
              // Don't throw - local storage save was successful
            }
          }
        } catch (error) {
          console.error('Failed to save settings to storage:', error);
        }
      },

      loadFromDatabase: async (userId: string) => {
        try {
          const { data, error } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', userId)
            .single();

          if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            console.error('Error fetching user settings:', error);
            throw new Error('Failed to fetch user settings');
          }

          // Return default settings if no record exists
          if (!data) {
            set({
              notificationsEnabled: true,
              vibrationEnabled: true,
              soundEnabled: true,
              backgroundTrackingEnabled: false,
              backgroundTrackingActive: false,
              earlyWarningEnabled: true,
            });
            // Also save to local storage as backup
            const actions = get() as SettingsState & SettingsActions;
            await actions.saveToStorage();
            return;
          }

          set({
            notificationsEnabled: data.notifications_enabled ?? true,
            vibrationEnabled: data.vibration_enabled ?? true,
            soundEnabled: data.sound_enabled ?? true,
            backgroundTrackingEnabled: data.background_tracking_enabled ?? false,
            backgroundTrackingActive: false, // Will be checked separately
            earlyWarningEnabled: data.early_warning_enabled ?? true,
          });
          
          // Also save to local storage as backup
          const actions = get() as SettingsState & SettingsActions;
          await actions.saveToStorage();
          
          // Check if background tracking is actually running
          actions.checkBackgroundTrackingStatus().catch(err => {
            console.error('Failed to check background tracking status:', err);
          });
          
          console.log('Settings loaded from database');
        } catch (error) {
          console.error('Failed to load settings from database:', error);
          throw error;
        }
      },

      saveToDatabase: async (userId: string) => {
        try {
          const state = get();
          
          const { error } = await supabase
            .from('user_settings')
            .upsert({
              user_id: userId,
              notifications_enabled: state.notificationsEnabled,
              vibration_enabled: state.vibrationEnabled,
              sound_enabled: state.soundEnabled,
              background_tracking_enabled: state.backgroundTrackingEnabled,
              early_warning_enabled: state.earlyWarningEnabled,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'user_id',
            });

          if (error) {
            console.error('Error saving user settings:', error);
            throw new Error('Failed to save user settings');
          }
          
          console.log('Settings saved to database');
        } catch (error) {
          console.error('Failed to save settings to database:', error);
          throw error;
        }
      },

      requestNotificationPermissions: async () => {
        if (Platform.OS === 'web') {
          console.log('Notifications not supported on web');
          return;
        }

        try {
          // Заявка за разрешения с time-sensitive за iOS
          const { status } = await Notifications.requestPermissionsAsync({
            ios: {
              allowAlert: true,
              allowSound: true,
              allowBadge: true,
            },
          });
          
          // Създаваме канал ПРЕДИ първата нотификация (Android)
          if (status === 'granted' && Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('tracksy-alerts', {
              name: 'Tracksy Alerts',
              description: 'Известия за сектори и превишаване на скорост',
              importance: Notifications.AndroidImportance.MAX,
              sound: 'default',
              vibrationPattern: [0, 300, 200, 300],
              lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
              showBadge: true,
              lightColor: '#FF231F7C',
            });
          }
          if (status !== 'granted') {
            console.log('Notification permissions not granted');
            set({ notificationsEnabled: false });
            const actions = get() as SettingsState & SettingsActions;
            actions.saveToStorage();
          }
        } catch (error) {
          console.error('Failed to request notification permissions:', error);
        }
      },

      getSettings: () => {
        const state = get();
        return {
          notificationsEnabled: state.notificationsEnabled,
          vibrationEnabled: state.vibrationEnabled,
          soundEnabled: state.soundEnabled,
        };
      },
    } as SettingsActions)
  )
);

// Helper function to get current settings
export const getNotificationSettings = async (): Promise<{
  notificationsEnabled: boolean;
  vibrationEnabled: boolean;
  soundEnabled: boolean;
}> => {
  try {
    const data = await AsyncStorage.getItem('app-settings');
    if (data) {
      const parsed = JSON.parse(data);
      return {
        notificationsEnabled: parsed.notificationsEnabled ?? true,
        vibrationEnabled: parsed.vibrationEnabled ?? true,
        soundEnabled: parsed.soundEnabled ?? true,
      };
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
  
  // Default values
  return {
    notificationsEnabled: true,
    vibrationEnabled: true,
    soundEnabled: true,
  };
};

