import { create } from 'zustand';
import { combine } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SpeedState {
  currentSpeed: number;
  averageSpeed: number;
  maxSpeed: number;
  isTracking: boolean;
  trackingStartTime: number | null;
  speedHistory: number[];
}

interface SpeedActions {
  updateSpeed: (speed: number) => void;
  startTracking: () => void;
  stopTracking: () => void;
  resetStats: () => void;
  loadFromStorage: () => Promise<void>;
  saveToStorage: () => Promise<void>;
}

export const useSpeedStore = create(
  combine(
    {
      currentSpeed: 0,
      averageSpeed: 0,
      maxSpeed: 0,
      isTracking: false,
      trackingStartTime: null as number | null,
      speedHistory: [] as number[],
    } as SpeedState,
    (set, get) => ({
      updateSpeed: (speed: number) => {
        const state = get();
        const newSpeedHistory = [...state.speedHistory, speed].slice(-100);
        const newMaxSpeed = Math.max(state.maxSpeed, speed);
        const newAverageSpeed = newSpeedHistory.reduce((sum, s) => sum + s, 0) / newSpeedHistory.length;

        set({
          currentSpeed: speed,
          averageSpeed: newAverageSpeed,
          maxSpeed: newMaxSpeed,
          speedHistory: newSpeedHistory,
        });

        if (newSpeedHistory.length % 10 === 0) {
          const actions = get() as SpeedState & SpeedActions;
          actions.saveToStorage();
        }
      },

      startTracking: () => {
        set({
          isTracking: true,
          trackingStartTime: Date.now(),
        });
      },

      stopTracking: () => {
        set({
          isTracking: false,
          trackingStartTime: null,
        });
        const actions = get() as SpeedState & SpeedActions;
        actions.saveToStorage();
      },

      resetStats: () => {
        set({
          currentSpeed: 0,
          averageSpeed: 0,
          maxSpeed: 0,
          speedHistory: [],
          trackingStartTime: Date.now(),
        });
        const actions = get() as SpeedState & SpeedActions;
        actions.saveToStorage();
      },

      loadFromStorage: async () => {
        try {
          const data = await AsyncStorage.getItem('speed-stats');
          if (data) {
            const parsed = JSON.parse(data);
            set({
              maxSpeed: parsed.maxSpeed || 0,
              speedHistory: parsed.speedHistory || [],
            });
          }
        } catch (error) {
          console.error('Failed to load speed stats from storage:', error);
        }
      },

      saveToStorage: async () => {
        try {
          const state = get();
          const dataToSave = {
            maxSpeed: state.maxSpeed,
            speedHistory: state.speedHistory,
          };
          await AsyncStorage.setItem('speed-stats', JSON.stringify(dataToSave));
        } catch (error) {
          console.error('Failed to save speed stats to storage:', error);
        }
      },
    } as SpeedActions)
  )
);