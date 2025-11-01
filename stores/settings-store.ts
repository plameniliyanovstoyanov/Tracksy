import { create } from 'zustand';
import { combine } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { BackgroundLocationService } from './location-service';

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
  loadFromStorage: () => Promise<void>;
  saveToStorage: () => Promise<void>;
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

      loadFromStorage: async () => {
        try {
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

      saveToStorage: async () => {
        try {
          const state = get();
          const dataToSave = {
            notificationsEnabled: state.notificationsEnabled,
            vibrationEnabled: state.vibrationEnabled,
            soundEnabled: state.soundEnabled,
            backgroundTrackingEnabled: state.backgroundTrackingEnabled,
            earlyWarningEnabled: state.earlyWarningEnabled,
          };
          await AsyncStorage.setItem('app-settings', JSON.stringify(dataToSave));
        } catch (error) {
          console.error('Failed to save settings to storage:', error);
        }
      },

      requestNotificationPermissions: async () => {
        if (Platform.OS === 'web') {
          console.log('Notifications not supported on web');
          return;
        }

        try {
          const { status } = await Notifications.requestPermissionsAsync();
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

