import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sectors } from '@/data/sectors';

const LOCATION_TASK_NAME = 'background-location-task';
const BACKGROUND_NOTIFICATION_ID = 'background-tracking';

interface LocationData {
  latitude: number;
  longitude: number;
  speed: number;
  timestamp: number;
}

interface SectorCheck {
  id: string;
  name: string;
  speedLimit: number;
  startPoint: { lat: number; lng: number };
  endPoint: { lat: number; lng: number };
  active: boolean;
  route?: { lat: number; lng: number }[];
}

// Функция за изчисляване на разстояние между две точки
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

// Проверка дали точка е близо до сектор
function isPointNearSector(point: { latitude: number; longitude: number }, sector: SectorCheck, threshold: number = 80): boolean {
  const distToStart = getDistance(point.latitude, point.longitude, sector.startPoint.lat, sector.startPoint.lng);
  const distToEnd = getDistance(point.latitude, point.longitude, sector.endPoint.lat, sector.endPoint.lng);
  
  // Проверяваме дали сме близо до началото или края
  if (distToStart < threshold || distToEnd < threshold) {
    return true;
  }
  
  // Ако има маршрут, проверяваме дали сме близо до някоя точка от него
  if (sector.route && sector.route.length > 0) {
    for (const routePoint of sector.route) {
      const dist = getDistance(point.latitude, point.longitude, routePoint.lat, routePoint.lng);
      if (dist < threshold) {
        return true;
      }
    }
  }
  
  return false;
}

// Проверка дали се приближаваме към сектор (за предупреждение)
function isApproachingSector(point: { latitude: number; longitude: number }, sector: SectorCheck, warningDistance: number = 500): boolean {
  const distToStart = getDistance(point.latitude, point.longitude, sector.startPoint.lat, sector.startPoint.lng);
  
  // Проверяваме дали сме в предупредителната зона около началото
  if (distToStart < warningDistance && distToStart > 100) {
    return true;
  }
  
  // Ако има маршрут, проверяваме дали сме близо до началото на маршрута
  if (sector.route && sector.route.length > 0) {
    const firstRoutePoint = sector.route[0];
    const dist = getDistance(point.latitude, point.longitude, firstRoutePoint.lat, firstRoutePoint.lng);
    if (dist < warningDistance && dist > 100) {
      return true;
    }
  }
  
  return false;
}

// Изчисляване на оставащо разстояние до края на сектора
function calculateRemainingDistance(currentPos: { latitude: number; longitude: number }, sector: SectorCheck): number {
  if (!sector.route || sector.route.length === 0) {
    // Ако няма маршрут, връщаме директното разстояние до края
    return getDistance(currentPos.latitude, currentPos.longitude, sector.endPoint.lat, sector.endPoint.lng);
  }
  
  // Намираме най-близката точка от маршрута
  let minDistance = Infinity;
  let closestIndex = 0;
  
  for (let i = 0; i < sector.route.length; i++) {
    const point = sector.route[i];
    const dist = getDistance(currentPos.latitude, currentPos.longitude, point.lat, point.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closestIndex = i;
    }
  }
  
  // Изчисляваме оставащото разстояние по маршрута
  let remainingDistance = 0;
  for (let i = closestIndex; i < sector.route.length - 1; i++) {
    const point1 = sector.route[i];
    const point2 = sector.route[i + 1];
    remainingDistance += getDistance(point1.lat, point1.lng, point2.lat, point2.lng);
  }
  
  // Добавяме разстоянието до края
  if (sector.route.length > 0) {
    const lastPoint = sector.route[sector.route.length - 1];
    remainingDistance += getDistance(lastPoint.lat, lastPoint.lng, sector.endPoint.lat, sector.endPoint.lng);
  }
  
  return remainingDistance;
}

// Изчисляване на препоръчителна скорост
function calculateRecommendedSpeed(
  currentAvgSpeed: number,
  remainingDistance: number,
  speedLimit: number
): number | null {
  if (remainingDistance <= 0) return null;
  
  // Ако средната скорост е под лимита, можем да карам с лимита
  if (currentAvgSpeed <= speedLimit) {
    return Math.min(speedLimit, currentAvgSpeed + 10);
  }
  
  // Ако сме превишили, изчисляваме колко бавно трябва да караме
  // за да компенсираме превишението
  const timeAtLimit = remainingDistance / (speedLimit / 3.6); // време в секунди при лимита
  // const currentTime = remainingDistance / (currentAvgSpeed / 3.6); // текущо очаквано време
  
  // Изчисляваме необходимата скорост за компенсация
  const requiredSpeed = (remainingDistance / timeAtLimit) * 3.6;
  
  // Ако е отрицателна или много ниска, значи сме превишили твърде много
  if (requiredSpeed < 20) {
    return -1; // Индикация че трябва да спрем или караме много бавно
  }
  
  return Math.max(20, Math.min(requiredSpeed, speedLimit - 5));
}

// Състояние за проследяване на потвърждения
interface SectorTrackingState {
  lastCheckTime: number;
  entryConfirmations: { [sectorId: string]: number };
  exitConfirmations: number;
  currentSectorId: string | null;
  lastNotificationTime: { [key: string]: number };
  warnedSectors: string[];
}

// Background task definition
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('Background location task error:', error);
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const location = locations[0];
    
    if (location) {
      try {
        const speed = location.coords.speed ? location.coords.speed * 3.6 : 0;
        const locationData: LocationData = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          speed,
          timestamp: Date.now()
        };

        // Запазваме последното местоположение
        await AsyncStorage.setItem('last-location', JSON.stringify(locationData));

        // Зареждаме състоянието за проследяване
        const trackingStateStr = await AsyncStorage.getItem('sector-tracking-state');
        let trackingState: SectorTrackingState = trackingStateStr ? JSON.parse(trackingStateStr) : {
          lastCheckTime: 0,
          entryConfirmations: {},
          exitConfirmations: 0,
          currentSectorId: null,
          lastNotificationTime: {},
          warnedSectors: []
        };
        
        // Намален дебаунсинг за максимална точност
        const now = Date.now();
        if (now - trackingState.lastCheckTime < 250) { // Минимум 0.25 секунди между проверките за максимална точност
          return;
        }
        trackingState.lastCheckTime = now;
        
        // Проверяваме за влизане в сектори
        const currentSectorStr = await AsyncStorage.getItem('current-sector');
        let currentSector: SectorCheck | null = currentSectorStr ? JSON.parse(currentSectorStr) : null;

        // Проверяваме настройките за ранни предупреждения
        const settingsStr = await AsyncStorage.getItem('app-settings');
        const settings = settingsStr ? JSON.parse(settingsStr) : { 
          earlyWarningEnabled: true, 
          warningDistances: [1000, 2000, 3000] 
        };
        
        // Проверяваме за предупреждения преди влизане в сектор (само ако е включено и не сме вече в сектор)
        if (settings.earlyWarningEnabled && !trackingState.currentSectorId) {
          const warningDistances = settings.warningDistances || [1000, 2000, 3000];
          
          for (const sector of sectors) {
            if (!sector.active) continue;
            
            const sectorCheck: SectorCheck = {
              id: sector.id,
              name: sector.name,
              speedLimit: sector.speedLimit,
              startPoint: sector.startPoint,
              endPoint: sector.endPoint,
              active: sector.active,
              route: []
            };
            
            const distToStart = getDistance(location.coords.latitude, location.coords.longitude, sector.startPoint.lat, sector.startPoint.lng);
            
            // Проверяваме за всяко разстояние за предупреждение
            for (const warningDistance of warningDistances) {
              const warningKey = `warning-${sector.id}-${warningDistance}`;
              
              // Проверяваме дали се приближаваме и не сме вече предупредени за това разстояние
              if (distToStart < warningDistance && distToStart > warningDistance - 100) {
                // Проверяваме дали не сме изпратили известие скоро за това разстояние
                const lastWarningTime = trackingState.lastNotificationTime[warningKey] || 0;
                if (now - lastWarningTime > 120000) { // Минимум 2 минути между предупрежденията за едно разстояние
                  trackingState.lastNotificationTime[warningKey] = now;
                  
                  // Определяме текста според разстоянието
                  let distanceText = '';
                  if (warningDistance >= 1000) {
                    distanceText = `${warningDistance / 1000}км`;
                  } else {
                    distanceText = `${warningDistance}м`;
                  }
                  
                  // Изпращаме предупредително известие
                  await Notifications.scheduleNotificationAsync({
                    content: {
                      title: `⚠️ Сектор след ${distanceText}`,
                      body: `📍 ${sector.name}\n🚗 Ограничение: ${sector.speedLimit} км/ч\n⏱️ Средна скорост в сектора`,
                      data: { 
                        sectorId: sector.id,
                        type: 'sector-warning',
                        speedLimit: sector.speedLimit,
                        sectorName: sector.name,
                        distance: warningDistance
                      },
                      sound: settings.soundEnabled ?? true,
                      priority: 'high',
                    },
                    trigger: null,
                  });
                  
                  console.log(`Warning: Approaching sector ${sector.name} at ${distanceText}`);
                }
              }
            }
            
            // Почистваме стари предупреждения ако сме се отдалечили
            const maxWarningDistance = Math.max(...warningDistances);
            if (distToStart > maxWarningDistance + 500) {
              // Почистваме всички предупреждения за този сектор
              for (const distance of warningDistances) {
                const warningKey = `warning-${sector.id}-${distance}`;
                delete trackingState.lastNotificationTime[warningKey];
              }
            }
          }
        }

        // Проверяваме дали влизаме в нов сектор
        const newSector = sectors.find(sector => {
          const sectorCheck: SectorCheck = {
            id: sector.id,
            name: sector.name,
            speedLimit: sector.speedLimit,
            startPoint: sector.startPoint,
            endPoint: sector.endPoint,
            active: sector.active,
            route: [] // TODO: Parse route from Mapbox if needed
          };
          return sector.active && isPointNearSector(location.coords, sectorCheck, 80); // По-малък threshold за по-бърза детекция
        });

        // Ако вече сме в сектор
        if (trackingState.currentSectorId) {
          // Проверяваме дали все още сме в същия сектор
          if (newSector && newSector.id === trackingState.currentSectorId) {
            // Все още сме в същия сектор - нулираме exit confirmations
            trackingState.exitConfirmations = 0;
          } else if (!newSector) {
            // Може би излизаме от сектора
            trackingState.exitConfirmations++;
            
            // Изискваме 3 потвърждения за излизане
            if (trackingState.exitConfirmations >= 3) {
              // Излизаме от сектора
              const exitingSector = sectors.find(s => s.id === trackingState.currentSectorId);
              if (exitingSector) {
                const speedReadingsStr = await AsyncStorage.getItem('sector-speed-readings');
                const speedReadings: number[] = speedReadingsStr ? JSON.parse(speedReadingsStr) : [];
                const avgSpeed = speedReadings.length > 0 ? speedReadings.reduce((a, b) => a + b, 0) / speedReadings.length : 0;

                // Изпращаме известие за излизане
                await Notifications.scheduleNotificationAsync({
                  content: {
                    title: `✅ Край на сектор`,
                    body: `📍 ${exitingSector.name}\n📊 Средна скорост: ${avgSpeed.toFixed(1)} км/ч\n${avgSpeed > exitingSector.speedLimit ? '⚠️ Превишена средна скорост!' : '✅ В рамките на ограничението'}`,
                    data: { 
                      sectorId: exitingSector.id,
                      type: 'sector-exit',
                      averageSpeed: avgSpeed,
                      speedLimit: exitingSector.speedLimit
                    },
                    sound: true,
                    priority: 'high',
                  },
                  trigger: null,
                });

                console.log(`Exited sector ${exitingSector.name} with avg speed ${avgSpeed.toFixed(1)} km/h`);
              }
              
              // Записваме нарушението в базата данни ако имаме device ID
              try {
                // Първо проверяваме за device ID в localStorage (за web) или го генерираме
                let deviceId = null;
                
                if (Platform.OS === 'web') {
                  try {
                    deviceId = localStorage?.getItem('device_id');
                    if (!deviceId) {
                      const timestamp = Date.now();
                      const random = Math.random().toString(36).substr(2, 9);
                      deviceId = `web_${timestamp}_${random}`;
                      localStorage?.setItem('device_id', deviceId);
                    }
                  } catch (e) {
                    // Fallback ако localStorage не работи
                    deviceId = `web_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                  }
                } else {
                  // За mobile устройства искаме от AsyncStorage
                  deviceId = await AsyncStorage.getItem('device_id');
                  if (!deviceId) {
                    const timestamp = Date.now();
                    const random = Math.random().toString(36).substr(2, 9);
                    deviceId = `${Platform.OS}_${timestamp}_${random}`;
                    await AsyncStorage.setItem('device_id', deviceId);
                  }
                }
                
                if (deviceId && exitingSector) {
                  // Импортираме trpcClient динамично за да избегнем circular dependencies
                  const { trpcClient } = await import('@/lib/trpc');
                  
                  await trpcClient.violations.save.mutate({
                    device_id: deviceId,
                    sector_id: exitingSector.id,
                    sector_name: exitingSector.name,
                    speed_limit: exitingSector.speedLimit,
                    current_speed: avgSpeed,
                    violation_type: avgSpeed > exitingSector.speedLimit ? 'speeding' : 'normal',
                    location: {
                      latitude: location.coords.latitude,
                      longitude: location.coords.longitude,
                    },
                    timestamp: new Date().toISOString(),
                  });
                  
                  console.log('Violation saved to database successfully');
                }
              } catch (dbError) {
                console.error('Failed to save violation to database:', dbError);
                // Don't throw error to avoid breaking the flow
              }
              
              // Изчистваме данните
              await AsyncStorage.removeItem('current-sector');
              await AsyncStorage.removeItem('sector-entry-time');
              await AsyncStorage.removeItem('sector-speed-readings');
              await AsyncStorage.removeItem('sector-monitor-data');
              
              trackingState.currentSectorId = null;
              trackingState.exitConfirmations = 0;
              trackingState.warnedSectors = trackingState.warnedSectors.filter(id => id !== trackingState.currentSectorId);
            }
          }
        } else if (!trackingState.currentSectorId && newSector) {
          // Влизаме в нов сектор
          trackingState.entryConfirmations[newSector.id] = (trackingState.entryConfirmations[newSector.id] || 0) + 1;
          
          // Изискваме 2 потвърждения за влизане
          if (trackingState.entryConfirmations[newSector.id] >= 2) {
            const entryTime = Date.now();
            
            // Запазваме сектора
            const sectorToStore: SectorCheck = {
              id: newSector.id,
              name: newSector.name,
              speedLimit: newSector.speedLimit,
              startPoint: newSector.startPoint,
              endPoint: newSector.endPoint,
              active: newSector.active,
              route: []
            };
            
            await AsyncStorage.setItem('current-sector', JSON.stringify(sectorToStore));
            await AsyncStorage.setItem('sector-entry-time', entryTime.toString());
            await AsyncStorage.setItem('sector-speed-readings', JSON.stringify([speed]));
            
            trackingState.currentSectorId = newSector.id;
            trackingState.entryConfirmations = {};
            trackingState.exitConfirmations = 0;
            
            // Изпращаме известие за влизане
            await Notifications.scheduleNotificationAsync({
              content: {
                title: `🚗 Влизане в сектор`,
                body: `📍 ${newSector.name}\n⚠️ Ограничение: ${newSector.speedLimit} км/ч\n🏃 Текуща скорост: ${speed.toFixed(0)} км/ч`,
                data: { 
                  sectorId: newSector.id,
                  type: 'sector-entry',
                  speedLimit: newSector.speedLimit,
                  currentSpeed: speed,
                  entryTime: entryTime
                },
                sound: true,
                priority: 'high',
              },
              trigger: null,
            });
            
            console.log(`Entered sector ${newSector.name} with speed ${speed.toFixed(1)} km/h`);
          }
        }
        
        // Запазваме състоянието
        await AsyncStorage.setItem('sector-tracking-state', JSON.stringify(trackingState));

        // Ако сме в сектор, обновяваме скоростта и проверяваме за нарушения
        if (trackingState.currentSectorId) {
          const activeSector = sectors.find(s => s.id === trackingState.currentSectorId);
          if (!activeSector) return;
          const speedReadingsStr = await AsyncStorage.getItem('sector-speed-readings');
          const speedReadings: number[] = speedReadingsStr ? JSON.parse(speedReadingsStr) : [];
          const newReadings = [...speedReadings, speed];
          
          await AsyncStorage.setItem('sector-speed-readings', JSON.stringify(newReadings));
          
          // Изчисляваме средна скорост
          const avgSpeed = newReadings.reduce((a, b) => a + b, 0) / newReadings.length;
          
          // Изчисляваме оставащо разстояние
          const sectorCheck: SectorCheck = {
            id: activeSector.id,
            name: activeSector.name,
            speedLimit: activeSector.speedLimit,
            startPoint: activeSector.startPoint,
            endPoint: activeSector.endPoint,
            active: activeSector.active,
            route: []
          };
          const remainingDistance = calculateRemainingDistance(location.coords, sectorCheck);
          
          // Изчисляваме препоръчителна скорост
          const recommendedSpeed = calculateRecommendedSpeed(avgSpeed, remainingDistance, activeSector.speedLimit);
          
          // Запазваме данните за overlay
          const entryTimeStr = await AsyncStorage.getItem('sector-entry-time');
          const entryTime = entryTimeStr ? parseInt(entryTimeStr) : Date.now();
          const timeInSector = Math.floor((Date.now() - entryTime) / 1000);
          
          const monitorData = {
            sectorName: activeSector.name,
            speedLimit: activeSector.speedLimit,
            currentSpeed: speed,
            averageSpeed: avgSpeed,
            timeInSector,
            distanceRemaining: remainingDistance,
            recommendedSpeed,
            isOverSpeed: avgSpeed > activeSector.speedLimit,
            entryTime,
            speedReadings: newReadings
          };
          
          await AsyncStorage.setItem('sector-monitor-data', JSON.stringify(monitorData));

          // Проверяваме за превишаване на моментната скорост
          const lastSpeedWarning = trackingState.lastNotificationTime[`speed-${activeSector.id}`] || 0;
          if (speed > activeSector.speedLimit + 5 && now - lastSpeedWarning > 30000) {
            trackingState.lastNotificationTime[`speed-${activeSector.id}`] = now;
            
            await Notifications.scheduleNotificationAsync({
              content: {
                title: `⚠️ Превишена скорост!`,
                body: `🚨 ${speed.toFixed(0)} км/ч (лимит: ${activeSector.speedLimit} км/ч)\n📊 Средна: ${avgSpeed.toFixed(1)} км/ч`,
                data: { 
                  sectorId: activeSector.id,
                  type: 'speed-violation',
                  currentSpeed: speed,
                  averageSpeed: avgSpeed,
                  speedLimit: activeSector.speedLimit
                },
                sound: true,
                priority: 'max',
              },
              trigger: null,
            });
          }
          
          // Проверяваме за превишаване на средната скорост
          const lastAvgWarning = trackingState.lastNotificationTime[`avg-${activeSector.id}`] || 0;
          if (avgSpeed > activeSector.speedLimit && now - lastAvgWarning > 60000) {
            trackingState.lastNotificationTime[`avg-${activeSector.id}`] = now;
            
            const warningBody = recommendedSpeed && recommendedSpeed > 0
              ? `📊 Средна: ${avgSpeed.toFixed(1)} км/ч\n💡 Намалете до ${recommendedSpeed.toFixed(0)} км/ч за компенсация`
              : `📊 Средна: ${avgSpeed.toFixed(1)} км/ч\n⛔ Карайте много бавно!`;
            
            await Notifications.scheduleNotificationAsync({
              content: {
                title: `🚨 Превишена средна скорост!`,
                body: warningBody,
                data: { 
                  sectorId: activeSector.id,
                  type: 'average-speed-violation',
                  averageSpeed: avgSpeed,
                  recommendedSpeed,
                  speedLimit: activeSector.speedLimit
                },
                sound: true,
                priority: 'high',
              },
              trigger: null,
            });
          }
          
          // Запазваме актуализираното състояние
          await AsyncStorage.setItem('sector-tracking-state', JSON.stringify(trackingState));
        }

        console.log(`🚀 MAX ACCURACY GPS: ${location.coords.latitude.toFixed(6)}, ${location.coords.longitude.toFixed(6)}, Speed: ${speed.toFixed(1)} km/h, Accuracy: ${location.coords.accuracy?.toFixed(1)}m`);
      } catch (error) {
        console.error('Error processing background location:', error);
      }
    }
  }
});

export class BackgroundLocationService {
  private static isRunning = false;

  static async checkBatteryOptimization(): Promise<void> {
    try {
      if (Platform.OS === 'android') {
        // Показваме КРИТИЧНО известие за battery optimization
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '🚨 КРИТИЧНО: Изключете Battery Optimization',
            body: 'За МАКСИМАЛНА точност на GPS и стабилна работа в background:\n\n1. Настройки → Приложения → Speed Tracker\n2. Батерия → "Не оптимизирай"\n3. Автостарт → ВКЛЮЧЕН\n4. Рестартирайте приложението\n\nБЕЗ ТОВА GPS НЯМА ДА РАБОТИ ПРАВИЛНО!',
            data: { type: 'battery-optimization-critical' },
            sound: true,
            priority: 'max',
            sticky: true,
          },
          trigger: null,
        });
      } else if (Platform.OS === 'ios') {
        // За iOS също показваме инструкции
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '🍎 iOS: Настройки за максимална точност',
            body: 'За най-добра работа на GPS:\n\n1. Настройки → Конфиденциалност → Местоположение → Speed Tracker → "Винаги"\n2. Настройки → Батерия → Без ограничения за Speed Tracker\n3. Включете "Точно местоположение"',
            data: { type: 'ios-optimization-info' },
            sound: true,
            priority: 'high',
          },
          trigger: null,
        });
      }
    } catch (error) {
      console.error('Failed to show battery optimization info:', error);
    }
  }

  static async startBackgroundLocationTracking(): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        console.log('Background location not supported on web');
        return false;
      }

      // Показваме информация за battery optimization
      await this.checkBatteryOptimization();

      // ВИНАГИ изискваме максимални разрешения
      console.log('🔐 Requesting ALWAYS location permissions for maximum GPS accuracy...');
      
      // Първо искаме foreground разрешение
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
      if (foregroundStatus !== 'granted') {
        console.log('❌ Foreground location permission not granted');
        
        // Показваме критично известие
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '🚨 КРИТИЧНО: Нужно е разрешение за местоположение',
            body: 'Приложението НЕ МОЖЕ да работи без достъп до местоположението. Моля, разрешете достъп в настройките на устройството и рестартирайте приложението.',
            data: { type: 'permission-error-critical' },
            sound: true,
            priority: 'max',
            sticky: true,
          },
          trigger: null,
        });
        
        return false;
      }

      // След това ЗАДЪЛЖИТЕЛНО искаме background разрешение (винаги)
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== 'granted') {
        console.log('❌ Background location permission not granted - CRITICAL ERROR');
        
        // Показваме критично известие с детайлни инструкции
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '🚨 КРИТИЧНО: Нужно е "ВИНАГИ" разрешение за местоположение',
            body: 'За максимална точност на GPS и работа в background:\n\n📱 Android:\n1. Настройки → Приложения → Speed Tracker\n2. Разрешения → Местоположение\n3. Изберете "Винаги разрешено"\n\n🍎 iOS:\n1. Настройки → Конфиденциалност → Местоположение\n2. Speed Tracker → "Винаги"\n\nБЕЗ ТОВА ПРИЛОЖЕНИЕТО НЯМА ДА РАБОТИ ПРАВИЛНО!',
            data: { type: 'background-permission-critical' },
            sound: true,
            priority: 'max',
            sticky: true,
          },
          trigger: null,
        });
        
        return false;
      }
      
      console.log('✅ All location permissions granted - proceeding with maximum accuracy GPS tracking');

      // Проверяваме дали вече работи
      const isTaskRunning = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (isTaskRunning) {
        console.log('Background location task already running');
        this.isRunning = true;
        return true;
      }

      // Стартираме background location tracking с максимална точност
      try {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.BestForNavigation, // МАКСИМАЛНА точност GPS - най-високо качество
          timeInterval: 100, // 0.1 секунди за МАКСИМАЛНА честота на обновления
          distanceInterval: 0.1, // 0.1 метра за МАКСИМАЛНА чувствителност
          deferredUpdatesInterval: 250, // Много чести обновления за максимална точност
          mayShowUserSettingsDialog: true, // Показва диалог за настройки ако е нужно
          pausesUpdatesAutomatically: false, // НИКОГА не спира автоматично
          showsBackgroundLocationIndicator: true, // Показва индикатор че работи в background
          foregroundService: {
            notificationTitle: '🚗 Speed Tracker - МАКСИМАЛНА ТОЧНОСТ GPS',
            notificationBody: '📍 Следи с най-висока точност • Background режим • Винаги активен • Изключена battery optimization',
            notificationColor: '#ff6b35',
            killServiceOnDestroy: false, // НИКОГА не спира сервиса при затваряне
          },
        });
        
        console.log('🚀 Background location tracking started with MAXIMUM GPS accuracy settings');
      } catch (locationError: any) {
        console.error('Location service error:', locationError);
        
        // Проверяваме за специфични грешки
        if (locationError.message && locationError.message.includes('Background location has not been configured')) {
          console.error('❌ Background location not configured in app.json. Please rebuild the app with proper configuration.');
          
          // Показваме известие за грешката
          await Notifications.scheduleNotificationAsync({
            content: {
              title: '⚠️ Конфигурационна грешка',
              body: 'Background location не е конфигуриран правилно. Моля, свържете се с разработчика.',
              data: { type: 'config-error' },
              sound: true,
              priority: 'high',
            },
            trigger: null,
          });
          
          return false;
        }
        
        throw locationError;
      }

      this.isRunning = true;
      console.log('✅ Background location tracking started with MAXIMUM accuracy');
      
      // Показваме persistent notification за максимална точност
      await this.showBackgroundNotification();
      
      // Показваме успешно известие
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '✅ Speed Tracker стартиран успешно',
          body: '🚀 Работи с максимална точност на GPS\n📍 Background режим активен\n🔋 Препоръчваме да изключите battery optimization',
          data: { type: 'tracking-started-success' },
          sound: true,
          priority: 'high',
        },
        trigger: null,
      });
      
      return true;
    } catch (error) {
      console.error('Failed to start background location tracking:', error);
      return false;
    }
  }

  static async stopBackgroundLocationTracking(): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        return;
      }

      const isTaskRunning = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      if (isTaskRunning) {
        await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
        console.log('Background location tracking stopped');
      }

      this.isRunning = false;
      
      // Премахваме persistent notification
      await Notifications.dismissNotificationAsync(BACKGROUND_NOTIFICATION_ID);
    } catch (error) {
      console.error('Failed to stop background location tracking:', error);
    }
  }

  static async isBackgroundLocationRunning(): Promise<boolean> {
    try {
      if (Platform.OS === 'web') {
        return false;
      }
      
      const isTaskRunning = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK_NAME);
      this.isRunning = isTaskRunning;
      return isTaskRunning;
    } catch (error) {
      console.error('Failed to check background location status:', error);
      return false;
    }
  }

  private static async showBackgroundNotification(): Promise<void> {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: BACKGROUND_NOTIFICATION_ID,
        content: {
          title: '🚗 Speed Tracker - МАКСИМАЛНА ТОЧНОСТ',
          body: '📍 GPS следене с най-висока точност • Background режим активен • Винаги работи',
          data: { persistent: true, maxAccuracy: true },
          sticky: true,
          autoDismiss: false,
          priority: 'high',
        },
        trigger: null,
      });
    } catch (error) {
      console.error('Failed to show background notification:', error);
    }
  }

  static getIsRunning(): boolean {
    return this.isRunning;
  }
}

// Export for use in other files
export { LOCATION_TASK_NAME };