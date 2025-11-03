import * as Battery from 'expo-battery';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Platform, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { combine } from 'zustand/middleware';

interface BatteryState {
  batteryLevel: number;
  isLowPowerMode: boolean;
  locationUpdateInterval: number;
  locationAccuracy: Location.LocationAccuracy;
  adaptiveMode: boolean; // Винаги false - премахнат адаптивен режим
}

interface BatteryActions {
  initializeBatteryOptimization: () => Promise<void>;
  updateBatteryLevel: (level: number) => void;
  setAdaptiveMode: (enabled: boolean) => void; // Винаги ще връща максимална точност
  getOptimalLocationSettings: () => { interval: number; accuracy: Location.LocationAccuracy };
  requestBatteryOptimizationDisable: () => Promise<void>;
  showBatteryOptimizationInstructions: () => Promise<void>;
  requestAlwaysLocationPermission: () => Promise<boolean>;
}

const BATTERY_THRESHOLDS = {
  CRITICAL: 0.1,  // 10%
  LOW: 0.2,       // 20%
  MEDIUM: 0.5,    // 50%
  HIGH: 0.8,      // 80%
};

// Премахнат адаптивен режим - винаги максимална точност
const LOCATION_SETTINGS = {
  MAX_ACCURACY: {
    interval: 1000,  // 1 секунда за максимална точност
    accuracy: Location.Accuracy.BestForNavigation,
  },
};

export const useBatteryOptimization = create(
  combine(
    {
      batteryLevel: 1,
      isLowPowerMode: false,
      locationUpdateInterval: 1000, // Винаги максимална точност
      locationAccuracy: Location.Accuracy.BestForNavigation,
      adaptiveMode: false, // Премахнат адаптивен режим
    } as BatteryState,
    (set, get) => ({
      initializeBatteryOptimization: async () => {
        try {
          if (Platform.OS === 'web') {
            console.log('Battery optimization not available on web');
            return;
          }

          // Премахнат адаптивен режим - винаги максимална точност
          const adaptiveMode = false; // Винаги изключен
          
          // Получаваме текущото ниво на батерията (само за информация)
          const batteryLevel = await Battery.getBatteryLevelAsync();
          const batteryState = await Battery.getBatteryStateAsync();
          const isLowPowerMode = await Battery.isLowPowerModeEnabledAsync();
          
          // Винаги използваме максимална точност
          const settings = LOCATION_SETTINGS.MAX_ACCURACY;
          
          set({
            batteryLevel: batteryLevel || 1,
            isLowPowerMode,
            adaptiveMode,
            locationUpdateInterval: settings.interval,
            locationAccuracy: settings.accuracy,
          });

          // Слушаме за промени в батерията
          const batteryLevelSubscription = Battery.addBatteryLevelListener(({ batteryLevel }) => {
            // Обновяваме нивото на батерията, но винаги използваме максимална точност
            set({ batteryLevel });
            const settings = LOCATION_SETTINGS.MAX_ACCURACY;
            set({
              locationUpdateInterval: settings.interval,
              locationAccuracy: settings.accuracy,
            });
            console.log(`Battery level: ${(batteryLevel * 100).toFixed(0)}%, using max GPS accuracy`);
          });

          const lowPowerSubscription = Battery.addLowPowerModeListener(({ lowPowerMode }) => {
            set({ isLowPowerMode: lowPowerMode });
            
            // Винаги максимална точност, независимо от режима на батерията
            const settings = LOCATION_SETTINGS.MAX_ACCURACY;
            set({
              locationUpdateInterval: settings.interval,
              locationAccuracy: settings.accuracy,
            });
          });

          // Запазваме subscriptions за по-късно почистване
          // В реална имплементация трябва да ги почистим при unmount
          
          console.log(`Battery optimization initialized: ${(batteryLevel * 100).toFixed(0)}% battery`);
        } catch (error) {
          console.error('Failed to initialize battery optimization:', error);
        }
      },

      updateBatteryLevel: (level: number) => {
        set({ batteryLevel: level });
        
        // Винаги максимална точност, независимо от нивото на батерията
        const settings = LOCATION_SETTINGS.MAX_ACCURACY;
        set({
          locationUpdateInterval: settings.interval,
          locationAccuracy: settings.accuracy,
        });
        
        console.log(`Battery level: ${(level * 100).toFixed(0)}%, using max GPS accuracy`);
      },

      setAdaptiveMode: async (enabled: boolean) => {
        try {
          // Винаги изключен адаптивен режим
          await AsyncStorage.setItem('battery-adaptive-mode', 'false');
          set({ adaptiveMode: false });
          
          // Винаги максимална точност
          const settings = LOCATION_SETTINGS.MAX_ACCURACY;
          set({
            locationUpdateInterval: settings.interval,
            locationAccuracy: settings.accuracy,
          });
          
          console.log('Adaptive mode disabled - always using max accuracy');
        } catch (error) {
          console.error('Failed to set adaptive mode:', error);
        }
      },

      getOptimalLocationSettings: () => {
        // Винаги връщаме максимална точност
        return LOCATION_SETTINGS.MAX_ACCURACY;
      },

      requestBatteryOptimizationDisable: async () => {
        try {
          if (Platform.OS === 'android') {
            // Показваме детайлни инструкции за изключване на battery optimization
            await Notifications.scheduleNotificationAsync({
              content: {
                title: '🔋 ВАЖНО: Изключете Battery Optimization',
                body: 'За максимална точност на GPS:\n\n1. Настройки → Приложения\n2. Speed Tracker → Батерия\n3. "Не оптимизирай"\n4. Рестартирайте приложението\n\nБез това приложението няма да работи правилно в background!',
                data: { type: 'battery-optimization-critical' },
                sound: false, // Info - без звук
                ...(Platform.OS === 'android' && {
                  priority: Notifications.AndroidNotificationPriority.HIGH,
                }),
                ...(Platform.OS !== 'android' && { interruptionLevel: 'active' }),
              },
              trigger: null,
            });

            // Опитваме се да отворим настройките за battery optimization
            try {
              await Linking.openSettings();
            } catch (linkError) {
              console.log('Could not open settings automatically');
            }
          }
        } catch (error) {
          console.error('Failed to request battery optimization disable:', error);
        }
      },

      showBatteryOptimizationInstructions: async () => {
        try {
          await Notifications.scheduleNotificationAsync({
            content: {
              title: '⚡ Максимална производителност',
              body: 'За най-добра работа:\n\n📱 Android:\n• Настройки → Батерия → Не оптимизирай\n• Настройки → Приложения → Автостарт: ВКЛ\n\n🍎 iOS:\n• Настройки → Конфиденциалност → Винаги разрешено\n• Настройки → Батерия → Без ограничения',
              data: { type: 'performance-instructions' },
              sound: false,
              ...(Platform.OS === 'android' && {
                priority: Notifications.AndroidNotificationPriority.HIGH,
                channelId: 'tracksy-alerts',
              }),
              ...(Platform.OS === 'ios' && { interruptionLevel: 'active' }),
            },
            trigger: null,
          });
        } catch (error) {
          console.error('Failed to show battery optimization instructions:', error);
        }
      },

      requestAlwaysLocationPermission: async () => {
        try {
          if (Platform.OS === 'web') {
            console.log('Location permissions not applicable on web');
            return false;
          }

          // Първо искаме foreground разрешение
          const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
          if (foregroundStatus !== 'granted') {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: '📍 Нужно е разрешение за местоположение',
                body: 'Моля, разрешете достъп до местоположението за да работи приложението.',
                data: { type: 'location-permission-required' },
                sound: true,
                ...(Platform.OS === 'android' && {
                  priority: Notifications.AndroidNotificationPriority.HIGH,
                  channelId: 'tracksy-alerts',
                }),
                ...(Platform.OS === 'ios' && { interruptionLevel: 'timeSensitive' }),
              },
              trigger: null,
            });
            return false;
          }

          // След това искаме background разрешение (винаги)
          const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
          if (backgroundStatus !== 'granted') {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: '🔄 Нужно е разрешение за background местоположение',
                body: 'За работа в background:\n\n📱 Android: Настройки → Приложения → Speed Tracker → Разрешения → Местоположение → "Винаги разрешено"\n\n🍎 iOS: Настройки → Конфиденциалност → Местоположение → Speed Tracker → "Винаги"',
                data: { type: 'background-location-required' },
                sound: true,
                ...(Platform.OS === 'android' && {
                  priority: Notifications.AndroidNotificationPriority.MAX,
                  channelId: 'tracksy-alerts',
                }),
                ...(Platform.OS === 'ios' && { interruptionLevel: 'timeSensitive' }),
              },
              trigger: null,
            });
            
            // Опитваме се да отворим настройките
            try {
              await Linking.openSettings();
            } catch (linkError) {
              console.log('Could not open settings automatically');
            }
            
            return false;
          }

          console.log('✅ All location permissions granted');
          return true;
        } catch (error) {
          console.error('Failed to request location permissions:', error);
          return false;
        }
      },
    } as BatteryActions)
  )
);