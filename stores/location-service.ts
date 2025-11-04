import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sectors } from '@/data/sectors';
import {
  PROXIMITY_THRESHOLD_ENTER,
  PROXIMITY_THRESHOLD_EXIT,
  WARNING_DISTANCE_M,
  ROUTE_SNAP_THRESHOLD_M,
  GPS_MAX_ACCURACY_M,
  GPS_SPIKE_THRESHOLD_KMH,
  MAX_SPEED_READINGS,
} from '@/constants/proximity';
import { computeRecommendedSpeedKmH } from '@/utils/speed-calculations';

const LOCATION_TASK_NAME = 'background-location-task';

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
  routeCoordinates?: [number, number][];
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
function isPointNearSector(point: { latitude: number; longitude: number }, sector: SectorCheck, threshold: number = PROXIMITY_THRESHOLD_ENTER): boolean {
  // Ако има routeCoordinates, проверяваме разстоянието до всеки сегмент от маршрута
  if (sector.routeCoordinates && sector.routeCoordinates.length > 1) {
    for (let i = 0; i < sector.routeCoordinates.length - 1; i++) {
      const lineStart = sector.routeCoordinates[i];
      const lineEnd = sector.routeCoordinates[i + 1];
      
      const distance = distanceToLineSegment(point, lineStart, lineEnd);
      
      if (distance < threshold) {
        return true;
      }
    }
    return false;
  }
  
  // Fallback: проверяваме дали сме близо до началото или края
  const distToStart = getDistance(point.latitude, point.longitude, sector.startPoint.lat, sector.startPoint.lng);
  const distToEnd = getDistance(point.latitude, point.longitude, sector.endPoint.lat, sector.endPoint.lng);
  
  if (distToStart < threshold || distToEnd < threshold) {
    return true;
  }
  
  // Проверяваме и въображаемата линия между началото и края
  const distance = distanceToLineSegment(
    point,
    [sector.startPoint.lng, sector.startPoint.lat],
    [sector.endPoint.lng, sector.endPoint.lat]
  );
  
  return distance < threshold;
}

// Функция за изчисляване на разстояние от точка до линия
function distanceToLineSegment(point: { latitude: number; longitude: number }, lineStart: [number, number], lineEnd: [number, number]): number {
  const [lng1, lat1] = lineStart;
  const [lng2, lat2] = lineEnd;
  
  const A = point.longitude - lng1;
  const B = point.latitude - lat1;
  const C = lng2 - lng1;
  const D = lat2 - lat1;
  
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  
  let param = -1;
  if (lenSq !== 0) {
    param = dot / lenSq;
  }
  
  let xx, yy;
  
  if (param < 0) {
    xx = lng1;
    yy = lat1;
  } else if (param > 1) {
    xx = lng2;
    yy = lat2;
  } else {
    xx = lng1 + param * C;
    yy = lat1 + param * D;
  }
  
  return getDistance(point.latitude, point.longitude, yy, xx);
}

// Проверка дали се приближаваме към сектор по правилния път
function isApproachingSectorOnRoute(point: { latitude: number; longitude: number }, sector: SectorCheck, warningDistance: number = WARNING_DISTANCE_M): boolean {
  // Първо проверяваме дали сме близо до началото на сектора
  const distToStart = getDistance(point.latitude, point.longitude, sector.startPoint.lat, sector.startPoint.lng);
  
  // Ако сме твърде далеч от началото, не сме в предупредителната зона
  if (distToStart > warningDistance) {
    return false;
  }
  
  // Ако сме твърде близо до началото, вече сме в сектора
  if (distToStart < 50) {
    return false;
  }
  
  // Проверяваме дали сме на пътя към сектора
  // Създаваме въображаема линия от текущата позиция към началото на сектора
  // и проверяваме дали тази линия е в посоката на пътя
  
  // Ако има маршрут, проверяваме дали сме близо до някой сегмент от маршрута ПРЕДИ началото
  if (sector.route && sector.route.length > 1) {
    // Намираме най-близкия сегмент от маршрута
    let minDistanceToRoute = Infinity;
    let isOnApproachPath = false;
    
    for (let i = 0; i < sector.route.length - 1; i++) {
      const lineStart: [number, number] = [sector.route[i].lng, sector.route[i].lat];
      const lineEnd: [number, number] = [sector.route[i + 1].lng, sector.route[i + 1].lat];
      
      const distanceToSegment = distanceToLineSegment(point, lineStart, lineEnd);
      
      if (distanceToSegment < minDistanceToRoute) {
        minDistanceToRoute = distanceToSegment;
        
        // Проверяваме дали този сегмент е в посоката към началото на сектора
        const segmentDistToStart = getDistance(sector.route[i].lat, sector.route[i].lng, sector.startPoint.lat, sector.startPoint.lng);
        const segmentEndDistToStart = getDistance(sector.route[i + 1].lat, sector.route[i + 1].lng, sector.startPoint.lat, sector.startPoint.lng);
        
        // Ако сегментът води към началото на сектора (разстоянието намалява)
        if (segmentEndDistToStart < segmentDistToStart) {
          isOnApproachPath = true;
        }
      }
    }
    
    // Трябва да сме близо до маршрута (в рамките на ROUTE_SNAP_THRESHOLD_M) и на правилния път
    return minDistanceToRoute < ROUTE_SNAP_THRESHOLD_M && isOnApproachPath;
  } else {
    // Ако няма маршрут, проверяваме дали сме на въображаемата линия между началото и края
    const distanceToSectorLine = distanceToLineSegment(
      point,
      [sector.startPoint.lng, sector.startPoint.lat],
      [sector.endPoint.lng, sector.endPoint.lat]
    );
    
    // Трябва да сме близо до линията на сектора (в рамките на ROUTE_SNAP_THRESHOLD_M)
    // и в предупредителната зона около началото
    return distanceToSectorLine < ROUTE_SNAP_THRESHOLD_M && distToStart < warningDistance && distToStart > 50;
  }
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
  
  // Добавяме разстоянието до края само ако последната точка е далечна (>30м)
  if (sector.route.length > 0) {
    const lastPoint = sector.route[sector.route.length - 1];
    const tail = getDistance(lastPoint.lat, lastPoint.lng, sector.endPoint.lat, sector.endPoint.lng);
    if (tail > 30) remainingDistance += tail;
  }
  
  return remainingDistance;
}

// Използваме shared функцията от utils/speed-calculations.ts
// Запазена за backward compatibility, но ще използваме директно computeRecommendedSpeedKmH

// Състояние за проследяване на потвърждения
interface SectorTrackingState {
  lastCheckTime: number;
  entryConfirmations: { [sectorId: string]: number };
  exitConfirmations: number;
  currentSectorId: string | null;
  lastNotificationTime: { [key: string]: number };
  warnedSectors: string[];
  hasNotifiedAverageSpeedExceeded: { [sectorId: string]: boolean }; // Флаг за да не дублираме нотификации за средна скорост
}

// In-memory cache за намаляване на I/O операции
// Flush-ва се към AsyncStorage периодично или при събития
let memTrackingState: SectorTrackingState | null = null;
let memSpeedReadings: number[] = [];
let memLastSpeed: number | undefined = undefined; // за spike detection
let lastFlushTime = 0;
const FLUSH_INTERVAL_MS = 5000; // flush на всеки 5 секунди

// Зарежда състоянието от AsyncStorage в memory cache
async function loadStateFromStorage(): Promise<void> {
  try {
    const trackingStateStr = await AsyncStorage.getItem('sector-tracking-state');
    memTrackingState = trackingStateStr ? JSON.parse(trackingStateStr) : {
      lastCheckTime: 0,
      entryConfirmations: {},
      exitConfirmations: 0,
      currentSectorId: null,
      lastNotificationTime: {},
      warnedSectors: [],
      hasNotifiedAverageSpeedExceeded: {}
    };
    
    const speedReadingsStr = await AsyncStorage.getItem('sector-speed-readings');
    memSpeedReadings = speedReadingsStr ? JSON.parse(speedReadingsStr) : [];
    
    // Инициализираме флага ако липсва (backward compatibility)
    if (memTrackingState && !memTrackingState.hasNotifiedAverageSpeedExceeded) {
      memTrackingState.hasNotifiedAverageSpeedExceeded = {};
    }
  } catch (error) {
    console.error('Failed to load state from storage:', error);
    // Fallback към празно състояние
    memTrackingState = {
      lastCheckTime: 0,
      entryConfirmations: {},
      exitConfirmations: 0,
      currentSectorId: null,
      lastNotificationTime: {},
      warnedSectors: [],
      hasNotifiedAverageSpeedExceeded: {}
    };
    memSpeedReadings = [];
  }
}

// Flush-ва memory cache към AsyncStorage
async function flushStateToStorage(force: boolean = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastFlushTime < FLUSH_INTERVAL_MS) {
    return; // Не е време за flush
  }
  
  lastFlushTime = now;
  
  try {
    await AsyncStorage.multiSet([
      ['sector-tracking-state', JSON.stringify(memTrackingState)],
      ['sector-speed-readings', JSON.stringify(memSpeedReadings)],
    ]);
  } catch (error) {
    console.error('Failed to flush state to storage:', error);
  }
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
        // GPS филтри: проверяваме accuracy
        const accuracy = location.coords.accuracy ?? 9999;
        if (accuracy > GPS_MAX_ACCURACY_M) {
          return; // Прескачаме точки с лоша точност
        }
        
        // Изчисляваме скоростта
        let speed = location.coords.speed ? location.coords.speed * 3.6 : 0;
        if (speed < 0) speed = 0;
        
        // Spike detection: игнорираме голяма промяна в скоростта
        if (memLastSpeed !== undefined && Math.abs(speed - memLastSpeed) > GPS_SPIKE_THRESHOLD_KMH) {
          return; // Прескачаме spike-овете
        }
        memLastSpeed = speed;
        
        const locationData: LocationData = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          speed,
          timestamp: Date.now()
        };

        // Запазваме последното местоположение
        await AsyncStorage.setItem('last-location', JSON.stringify(locationData));

        // Lazy-load state от storage ако не е в memory
        if (memTrackingState === null) {
          await loadStateFromStorage();
        }
        
        const trackingState = memTrackingState!;
        
        // Дебаунсинг - балансирано за battery
        const now = Date.now();
        if (now - trackingState.lastCheckTime < 700) { // 700ms между проверките
          return;
        }
        trackingState.lastCheckTime = now;
        
        // Кешираме настройките и данните за сектор за да намалим I/O
        const currentSectorStr = await AsyncStorage.getItem('current-sector');
        let currentSector: SectorCheck | null = currentSectorStr ? JSON.parse(currentSectorStr) : null;

        const settingsStr = await AsyncStorage.getItem('app-settings');
        const settings = settingsStr ? JSON.parse(settingsStr) : { 
          earlyWarningEnabled: true,
          notificationsEnabled: true,
          vibrationEnabled: true,
          soundEnabled: true
        };
        
        // Зареждаме маршрутите на секторите от AsyncStorage ПРЕДИ early-warning проверката
        const sectorsWithRoutesStr = await AsyncStorage.getItem('sectors-with-routes');
        let sectorsWithRoutes: any[] = sectors;
        if (sectorsWithRoutesStr) {
          try {
            sectorsWithRoutes = JSON.parse(sectorsWithRoutesStr);
          } catch {
            console.log('Failed to parse sectors with routes, using default');
          }
        }
        
        // Запазваме trackingState само накрая (веднъж), не на всяка стъпка
        let shouldSaveTrackingState = false;
        
        // Проверяваме за предупреждения преди влизане в сектор (само ако е включено и не сме вече в сектор)
        if (settings.earlyWarningEnabled && !trackingState.currentSectorId) {
          // Използваме sectorsWithRoutes ако има, иначе fallback към sectors
          const warnSource = sectorsWithRoutes?.length ? sectorsWithRoutes : sectors;
          
          for (const sector of warnSource) {
            if (!sector.active) continue;
            
            // Използваме реалния маршрут ако е наличен
            const sectorAny = sector as unknown as { routeCoordinates?: [number, number][] };
            const sectorCheck: SectorCheck = {
              id: sector.id,
              name: sector.name,
              speedLimit: sector.speedLimit,
              startPoint: sector.startPoint,
              endPoint: sector.endPoint,
              active: sector.active,
              routeCoordinates: sectorAny.routeCoordinates,
              route: sectorAny.routeCoordinates ? sectorAny.routeCoordinates.map(([lng, lat]: [number, number]) => ({ lat, lng })) : []
            };
            
            const warningKey = `warning-${sector.id}`;
            
            // ВАЖНО: Проверяваме дали се приближаваме ПО ПРАВИЛНИЯ ПЪТ
            const isApproaching = isApproachingSectorOnRoute(location.coords, sectorCheck, WARNING_DISTANCE_M);
            
            if (isApproaching) {
              // Проверяваме дали не сме изпратили известие скоро
              const lastWarningTime = trackingState.lastNotificationTime[warningKey] || 0;
              if (now - lastWarningTime > 120000) { // Минимум 2 минути между предупрежденията
                trackingState.lastNotificationTime[warningKey] = now;
                shouldSaveTrackingState = true; // ВАЖНО: Запазваме промяната
                
                // Определяме текста според разстоянието
                let distanceText = '';
                const actualDistance = getDistance(location.coords.latitude, location.coords.longitude, sector.startPoint.lat, sector.startPoint.lng);
                if (actualDistance >= 1000) {
                  distanceText = `${(actualDistance / 1000).toFixed(1)}км`;
                } else {
                  distanceText = `${Math.round(actualDistance)}м`;
                }
                
                // Изпращаме предупредително известие
                await Notifications.scheduleNotificationAsync({
                  content: {
                    title: `⚠️ Сектор след ${distanceText}`,
                    body: `📍 ${sector.name}\n🚗 Ограничение: ${sector.speedLimit} км/ч\n🛣️ На правилния път`,
                    data: { 
                      sectorId: sector.id,
                      type: 'sector-warning',
                      speedLimit: sector.speedLimit,
                      sectorName: sector.name,
                      distance: actualDistance
                    },
                    sound: settings.soundEnabled ? 'default' : false,
                    vibrate: settings.vibrationEnabled ? [0, 300, 200, 300] : undefined,
                    ...(Platform.OS === 'android' && {
                      priority: Notifications.AndroidNotificationPriority.MAX,
                      channelId: 'tracksy-alerts',
                    }),
                    ...(Platform.OS === 'ios' && { interruptionLevel: 'timeSensitive' }),
                  },
                  trigger: null,
                });
                
                console.log(`Warning: Approaching sector ${sector.name} on correct route at ${distanceText}`);
              }
            }
            
            // Почистваме стари предупреждения ако сме се отдалечили от сектора
            const distToStart = getDistance(location.coords.latitude, location.coords.longitude, sector.startPoint.lat, sector.startPoint.lng);
            if (distToStart > WARNING_DISTANCE_M + 500) {
              // Почистваме предупреждението за този сектор
              delete trackingState.lastNotificationTime[warningKey];
              shouldSaveTrackingState = true; // Запазваме промяната
            }
          }
        }
        
        // Проверяваме дали влизаме в нов сектор
        const newSector = sectorsWithRoutes.find((sector: any) => {
          if (!sector.active) return false;
          
          const sectorCheck: SectorCheck = {
            id: sector.id,
            name: sector.name,
            speedLimit: sector.speedLimit,
            startPoint: sector.startPoint,
            endPoint: sector.endPoint,
            active: sector.active,
            routeCoordinates: sector.routeCoordinates,
            route: sector.routeCoordinates ? sector.routeCoordinates.map(([lng, lat]: [number, number]) => ({ lat, lng })) : []
          };
          
          const isNear = isPointNearSector(location.coords, sectorCheck, PROXIMITY_THRESHOLD_ENTER);
          if (isNear) {
            console.log(`✅ Found sector nearby: ${sector.name} (ID: ${sector.id})`);
          }
          return isNear;
        });
        
        if (newSector) {
          console.log(`🎯 New sector detected: ${newSector.name} (ID: ${newSector.id})`);
        }

        // Ако вече сме в сектор
        if (trackingState.currentSectorId) {
          // Проверяваме дали все още сме в същия сектор
          // Използваме по-голям threshold за изход за да избегнем фликер
          const stillInSector = newSector && newSector.id === trackingState.currentSectorId;
          const exitCheck = sectorsWithRoutes.find((sector: any) => {
            if (!sector.active || sector.id !== trackingState.currentSectorId) return false;
            const sectorCheck: SectorCheck = {
              id: sector.id,
              name: sector.name,
              speedLimit: sector.speedLimit,
              startPoint: sector.startPoint,
              endPoint: sector.endPoint,
              active: sector.active,
              routeCoordinates: sector.routeCoordinates,
              route: sector.routeCoordinates ? sector.routeCoordinates.map(([lng, lat]: [number, number]) => ({ lat, lng })) : []
            };
            return isPointNearSector(location.coords, sectorCheck, PROXIMITY_THRESHOLD_EXIT);
          });
          
          if (stillInSector || exitCheck) {
            // Все още сме в същия сектор - нулираме exit confirmations
            trackingState.exitConfirmations = 0;
          } else {
            // Може би излизаме от сектора
            trackingState.exitConfirmations++;
            
            // Изискваме 3 потвърждения за излизане
            if (trackingState.exitConfirmations >= 3) {
              // Излизаме от сектора
              const exitingSector = sectors.find(s => s.id === trackingState.currentSectorId);
              
              // Изчисляваме средната скорост от memory cache
              const avgSpeed = memSpeedReadings.length > 0 ? memSpeedReadings.reduce((a, b) => a + b, 0) / memSpeedReadings.length : 0;
              
              if (exitingSector) {
                // Използваме вече заредените настройки (кеширани по-горе)
                const isExceeding = avgSpeed > exitingSector.speedLimit;
                
                // Вибрация само ако е включена
                if (settings.vibrationEnabled) {
                  try {
                    if (isExceeding) {
                      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                    } else {
                      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    }
                  } catch (e) {
                    console.log('Haptics not available:', e);
                  }
                }
                
                // Изпращаме известие само ако е включено и не сме изпратили такова за този сектор в последните 5 секунди
                const exitNotificationKey = `exit-${exitingSector.id}`;
                const lastExitNotificationTime = trackingState.lastNotificationTime[exitNotificationKey] || 0;
                const NOTIFICATION_DEBOUNCE_MS = 5000;
                const shouldSendExitNotification = now - lastExitNotificationTime >= NOTIFICATION_DEBOUNCE_MS;
                
                if (settings.notificationsEnabled && shouldSendExitNotification) {
                  await Notifications.scheduleNotificationAsync({
                    content: {
                      title: `✅ Край на сектор`,
                      body: `📍 ${exitingSector.name}\n📊 Средна скорост: ${avgSpeed.toFixed(1)} км/ч\n${isExceeding ? '⚠️ Превишена средна скорост!' : '✅ В рамките на ограничението'}`,
                      data: { 
                        sectorId: exitingSector.id,
                        type: 'sector-exit',
                        averageSpeed: avgSpeed,
                        speedLimit: exitingSector.speedLimit
                      },
                  sound: settings.soundEnabled ? 'default' : false,
                  vibrate: settings.vibrationEnabled ? [0, 300, 200, 300] : undefined,
                  ...(Platform.OS === 'android' && {
                    priority: Notifications.AndroidNotificationPriority.MAX,
                    channelId: 'tracksy-alerts',
                  }),
                  ...(Platform.OS === 'ios' && { interruptionLevel: 'timeSensitive' }),
                },
                    trigger: null,
                  });
                  
                  // Запазваме времето за debounce
                  trackingState.lastNotificationTime[exitNotificationKey] = now;
                  shouldSaveTrackingState = true;
                }

                console.log(`Exited sector ${exitingSector.name} with avg speed ${avgSpeed.toFixed(1)} km/h`);
              }
              
              // Изчистваме данните
              await AsyncStorage.removeItem('current-sector');
              await AsyncStorage.removeItem('sector-entry-time');
              await AsyncStorage.removeItem('sector-speed-readings');
              await AsyncStorage.removeItem('sector-monitor-data');
              
              // Изчистваме memory cache
              memSpeedReadings = [];
              
              const exitingSectorId = trackingState.currentSectorId;
              trackingState.currentSectorId = null;
              trackingState.exitConfirmations = 0;
              trackingState.warnedSectors = trackingState.warnedSectors.filter(id => id !== exitingSectorId);
              
              // Ресетваме флага за средна скорост при излизане от сектор
              if (exitingSector && trackingState.hasNotifiedAverageSpeedExceeded[exitingSector.id]) {
                delete trackingState.hasNotifiedAverageSpeedExceeded[exitingSector.id];
              }
              
              shouldSaveTrackingState = true; // Запазваме промяната
              
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
              
            }
          }
        } else if (!trackingState.currentSectorId && newSector) {
          // Влизаме в нов сектор
          trackingState.entryConfirmations[newSector.id] = (trackingState.entryConfirmations[newSector.id] || 0) + 1;
          
          // Изискваме 2 потвърждения за влизане
          if (trackingState.entryConfirmations[newSector.id] >= 2) {
            const entryTime = Date.now();
            
            // Запазваме сектора с реалния маршрут
            const newSectorAny = newSector as unknown as { routeCoordinates?: [number, number][] };
            const sectorToStore: SectorCheck = {
              id: newSector.id,
              name: newSector.name,
              speedLimit: newSector.speedLimit,
              startPoint: newSector.startPoint,
              endPoint: newSector.endPoint,
              active: newSector.active,
              routeCoordinates: newSectorAny.routeCoordinates,
              route: newSectorAny.routeCoordinates ? newSectorAny.routeCoordinates.map(([lng, lat]: [number, number]) => ({ lat, lng })) : []
            };
            
            await AsyncStorage.setItem('current-sector', JSON.stringify(sectorToStore));
            await AsyncStorage.setItem('sector-entry-time', entryTime.toString());
            
            // Инициализираме memory cache за speed readings
            memSpeedReadings = [speed];
            
            trackingState.currentSectorId = newSector.id;
            trackingState.entryConfirmations = {};
            trackingState.exitConfirmations = 0;
            shouldSaveTrackingState = true;
            
            // Използваме вече заредените настройки (кеширани по-горе)
            // settings вече са заредени в началото на тика
            
            // Вибрация само ако е включена
            if (settings.vibrationEnabled) {
              try {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              } catch (e) {
                console.log('Haptics not available:', e);
              }
            }
            
            // Изпращаме известие само ако е включено и не сме изпратили такова за този сектор в последните 5 секунди
            const entryNotificationKey = `entry-${newSector.id}`;
            const lastEntryNotificationTime = trackingState.lastNotificationTime[entryNotificationKey] || 0;
            const NOTIFICATION_DEBOUNCE_MS = 5000;
            const shouldSendEntryNotification = now - lastEntryNotificationTime >= NOTIFICATION_DEBOUNCE_MS;
            
            if (settings.notificationsEnabled && shouldSendEntryNotification) {
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
                  sound: settings.soundEnabled ? 'default' : false,
                  vibrate: settings.vibrationEnabled ? [0, 300, 200, 300] : undefined,
                  ...(Platform.OS === 'android' && {
                    priority: Notifications.AndroidNotificationPriority.MAX,
                    channelId: 'tracksy-alerts',
                  }),
                  ...(Platform.OS === 'ios' && { interruptionLevel: 'timeSensitive' }),
                },
                trigger: null,
              });
              
              // Запазваме времето за debounce
              trackingState.lastNotificationTime[entryNotificationKey] = now;
              shouldSaveTrackingState = true;
            }
            
            console.log(`Entered sector ${newSector.name} with speed ${speed.toFixed(1)} km/h`);
          }
        }

        // Ако сме в сектор, обновяваме скоростта и проверяваме за нарушения
        if (trackingState.currentSectorId) {
          const activeSector = sectors.find(s => s.id === trackingState.currentSectorId);
          if (!activeSector) return;
          
          // Добавяме скоростта в rolling window (memory cache)
          memSpeedReadings.push(speed);
          // Ограничаваме размера на буфера (rolling window ~60s при 1Hz)
          if (memSpeedReadings.length > MAX_SPEED_READINGS) {
            memSpeedReadings.shift();
          }
          
          // Изчисляваме средна скорост
          const avgSpeed = memSpeedReadings.length > 0 ? memSpeedReadings.reduce((a, b) => a + b, 0) / memSpeedReadings.length : 0;
          
          // Изчисляваме оставащо разстояние
          // Използваме реалния маршрут ако е наличен
          const activeSectorAny = activeSector as unknown as { routeCoordinates?: [number, number][] };
          const sectorCheck: SectorCheck = {
            id: activeSector.id,
            name: activeSector.name,
            speedLimit: activeSector.speedLimit,
            startPoint: activeSector.startPoint,
            endPoint: activeSector.endPoint,
            active: activeSector.active,
            routeCoordinates: activeSectorAny.routeCoordinates,
            route: activeSectorAny.routeCoordinates ? activeSectorAny.routeCoordinates.map(([lng, lat]: [number, number]) => ({ lat, lng })) : []
          };
          const remainingDistance = calculateRemainingDistance(location.coords, sectorCheck);
          
          // Запазваме данните за overlay
          const entryTimeStr = await AsyncStorage.getItem('sector-entry-time');
          const entryTime = entryTimeStr ? parseInt(entryTimeStr) : Date.now();
          const timeInSector = Math.floor((Date.now() - entryTime) / 1000);
          
          // Изчисляваме изминато разстояние за recommended speed
          const distanceSoFar = (avgSpeed / 3.6) * timeInSector; // метри
          
          // Използваме shared функцията за препоръчителна скорост
          const recommendedSpeed = computeRecommendedSpeedKmH(
            avgSpeed,
            activeSector.speedLimit,
            distanceSoFar,
            remainingDistance
          );
          
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
            speedReadings: [...memSpeedReadings] // копие на масива
          };
          
          await AsyncStorage.setItem('sector-monitor-data', JSON.stringify(monitorData));

          // Проверяваме за превишаване на средната скорост с флаг механизъм
          const hasNotified = trackingState.hasNotifiedAverageSpeedExceeded[activeSector.id] || false;
          const isExceeding = avgSpeed > activeSector.speedLimit;
          
          // Ако превишаваме и не сме изпратили нотификация - изпращаме
          // Използваме вече заредените настройки (кеширани по-горе)
          if (isExceeding && !hasNotified) {
            if (settings.notificationsEnabled) {
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
                  sound: settings.soundEnabled ? 'default' : false,
                  vibrate: settings.vibrationEnabled ? [0, 300, 200, 300] : undefined,
                  ...(Platform.OS === 'android' && {
                    priority: Notifications.AndroidNotificationPriority.MAX,
                    channelId: 'tracksy-alerts',
                  }),
                  ...(Platform.OS === 'ios' && { interruptionLevel: 'timeSensitive' }),
                },
                trigger: null,
              });
              
              // Сетваме флага - изпратена нотификация
              trackingState.hasNotifiedAverageSpeedExceeded[activeSector.id] = true;
              shouldSaveTrackingState = true;
            }
          } else if (!isExceeding && hasNotified) {
            // Ако вече не превишаваме и сме изпратили нотификация - ресетваме флага
            trackingState.hasNotifiedAverageSpeedExceeded[activeSector.id] = false;
            shouldSaveTrackingState = true;
          }
          
          // Маркираме че трябва да запазим състоянието
          shouldSaveTrackingState = true;
        }

        // Flush-ваме memory cache към AsyncStorage (периодично или при промяна)
        if (shouldSaveTrackingState) {
          await flushStateToStorage(true); // Force flush при промяна
        } else {
          await flushStateToStorage(false); // Периодичен flush
        }
        
        console.log(`🚀 MAX ACCURACY GPS: ${location.coords.latitude.toFixed(6)}, ${location.coords.longitude.toFixed(6)}, Speed: ${speed.toFixed(1)} km/h, Accuracy: ${location.coords.accuracy?.toFixed(1)}m`);
      } catch (error) {
        console.error('Error processing background location:', error);
      }
    }
  }
});

// Функция за осигуряване на Android нотификационен канал
async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
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
  } catch (error) {
    console.error('Failed to create notification channel:', error);
  }
}

export class BackgroundLocationService {
  private static isRunning = false;
  private static bgInfoNotifId: string | null = null;

  static async checkBatteryOptimization(): Promise<void> {
    try {
      // Осигуряваме канала преди нотификацията
      await ensureAndroidChannel();
      
      // Показваме tip само веднъж
      const tipKey = 'battery-tip-shown';
      const shown = await AsyncStorage.getItem(tipKey);
      if (shown) {
        return; // Вече е показано
      }

      if (Platform.OS === 'android') {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '🔋 ВАЖНО: Изключете Battery Optimization',
            body: 'За максимална точност на GPS:\n\n1. Настройки → Приложения → Speed Tracker\n2. Батерия → "Не оптимизирай"\n3. Автостарт → ВКЛЮЧЕН\n\nБез това приложението може да спре в background.',
            data: { type: 'battery-optimization-critical' },
            sound: false, // Info нотификация - без звук
            ...(Platform.OS === 'android' && {
              priority: Notifications.AndroidNotificationPriority.HIGH,
              channelId: 'tracksy-alerts',
            }),
          },
          trigger: null,
        });
        await AsyncStorage.setItem(tipKey, '1');
      } else if (Platform.OS === 'ios') {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: '🍎 iOS: Настройки за максимална точност',
            body: 'За най-добра работа на GPS:\n\n1. Настройки → Конфиденциалност → Местоположение → Speed Tracker → "Винаги"\n2. Настройки → Батерия → Без ограничения за Speed Tracker\n3. Включете "Точно местоположение"',
            data: { type: 'ios-optimization-info' },
            sound: false, // Info нотификация
            interruptionLevel: 'active',
          },
          trigger: null,
        });
        await AsyncStorage.setItem(tipKey, '1');
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

      // Осигуряваме канала ПРЕДИ първата нотификация
      await ensureAndroidChannel();

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
            ...(Platform.OS === 'android' && {
              priority: Notifications.AndroidNotificationPriority.MAX,
              channelId: 'tracksy-alerts',
            }),
            ...(Platform.OS === 'ios' && { interruptionLevel: 'timeSensitive' }),
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
            ...(Platform.OS === 'android' && {
              priority: Notifications.AndroidNotificationPriority.MAX,
              channelId: 'tracksy-alerts',
            }),
            ...(Platform.OS === 'ios' && { interruptionLevel: 'timeSensitive' }),
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
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000, // 1 секунда - реалистично за battery
          distanceInterval: 5, // 5 метра - балансирано
          mayShowUserSettingsDialog: true,
          pausesUpdatesAutomatically: false,
          showsBackgroundLocationIndicator: true, // iOS only
          foregroundService: {
            notificationTitle: '🚗 Speed Tracker – GPS активно',
            notificationBody: 'Следене в background с висока точност',
            notificationColor: '#ff6b35',
            killServiceOnDestroy: false,
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
              ...(Platform.OS === 'android' && {
                priority: Notifications.AndroidNotificationPriority.HIGH,
                channelId: 'tracksy-alerts',
              }),
              ...(Platform.OS === 'ios' && { interruptionLevel: 'active' }),
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
          body: '🚀 Работи с висока точност на GPS\n📍 Background режим активен',
          data: { type: 'tracking-started-success' },
          sound: true,
          ...(Platform.OS === 'android' && {
            priority: Notifications.AndroidNotificationPriority.HIGH,
            channelId: 'tracksy-alerts',
          }),
          ...(Platform.OS === 'ios' && { interruptionLevel: 'active' }),
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
      
      // Премахваме info нотификацията (ако е показана)
      if (this.bgInfoNotifId) {
        await Notifications.dismissNotificationAsync(this.bgInfoNotifId);
        this.bgInfoNotifId = null;
      }
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
      // Info нотификация - foregroundService notification е persistent-ната
      // Тази е само за информация
      this.bgInfoNotifId = await Notifications.scheduleNotificationAsync({
        content: {
          title: '🚗 Speed Tracker активен',
          body: '📍 GPS следене в background • Винаги работи',
          data: { type: 'background-tracking-info' },
          sound: false, // Info - без звук
          ...(Platform.OS === 'android' && {
            priority: Notifications.AndroidNotificationPriority.LOW,
            channelId: 'tracksy-alerts',
          }),
          ...(Platform.OS === 'ios' && { interruptionLevel: 'passive' }),
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