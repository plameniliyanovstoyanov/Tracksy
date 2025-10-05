import { create } from 'zustand';
import { combine } from 'zustand/middleware';
import { sectors as initialSectors, Sector } from '@/data/sectors';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { fetchSectorRoute } from '@/utils/mapbox-directions';
import { trpcClient } from '@/lib/trpc';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface Location {
  latitude: number;
  longitude: number;
}

interface SectorWithRoute extends Sector {
  routeCoordinates?: [number, number][];
}

interface SectorHistoryEntry {
  sectorId: string;
  sectorName: string;
  timestamp: number;
  averageSpeed: number;
  speedLimit: number;
  exceeded: boolean;
  duration: number;
}

interface SectorState {
  sectors: SectorWithRoute[];
  userLocation: Location | null;
  currentSector: Sector | null;
  sectorEntryTime: number | null;
  currentSectorAverageSpeed: number;
  predictedAverageSpeed: number;
  willExceedLimit: boolean;
  speedReadings: number[];
  sectorHistory: SectorHistoryEntry[];
  lastSectorCheckTime: number;
  sectorConfirmationCount: number;
  exitConfirmationCount: number;
  sectorProgress: number; // 0 to 1 representing progress through sector
  lastNotificationThreshold: number; // 0, 0.33, 0.66 to track which notifications were sent
  sectorTotalDistance: number; // Total distance of the sector route in meters
  distanceTraveled: number; // Distance traveled in current sector
  recommendedSpeed: number | null; // Recommended speed to stay within limit
}

interface SectorActions {
  initializeNotifications: () => Promise<void>;
  checkSectorEntry: (location: Location) => void;
  checkSectorExit: (location: Location, deviceId?: string) => void;
  updateSectorSpeed: (speed: number) => void;
  updateSectorProgress: (location: Location) => void;
  loadSectorRoutes: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
  addToHistory: (entry: SectorHistoryEntry) => void;
  saveViolationToDatabase: (entry: SectorHistoryEntry, location: Location, deviceId: string) => Promise<void>;
  syncWithBackgroundTask: () => Promise<void>;
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

// Функция за изчисляване на разстояние от точка до линия
function distanceToLineSegment(point: Location, lineStart: [number, number], lineEnd: [number, number]): number {
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

// Проверка дали точка е близо до линия от сектор
function isPointNearSector(point: Location, sector: SectorWithRoute, threshold: number = 80): boolean {
  // Check if we have route coordinates
  if (sector.routeCoordinates && sector.routeCoordinates.length > 1) {
    // Проверяваме разстоянието до всеки сегмент от маршрута
    for (let i = 0; i < sector.routeCoordinates.length - 1; i++) {
      const lineStart = sector.routeCoordinates[i];
      const lineEnd = sector.routeCoordinates[i + 1];
      
      const distance = distanceToLineSegment(point, lineStart, lineEnd);
      
      if (distance < threshold) {
        return true;
      }
    }
  } else {
    // Fallback to checking start and end points if no route
    const distToStart = getDistance(point.latitude, point.longitude, sector.startPoint.lat, sector.startPoint.lng);
    const distToEnd = getDistance(point.latitude, point.longitude, sector.endPoint.lat, sector.endPoint.lng);
    
    // Проверяваме и въображаемата линия между началото и края
    const distance = distanceToLineSegment(
      point,
      [sector.startPoint.lng, sector.startPoint.lat],
      [sector.endPoint.lng, sector.endPoint.lat]
    );
    
    if (distToStart < threshold || distToEnd < threshold || distance < threshold) {
      return true;
    }
  }
  return false;
}

// Проверка дали се приближаваме към сектор по правилния път (за известия)
function isApproachingSectorOnRoute(point: Location, sector: SectorWithRoute, warningDistance: number = 500): boolean {
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
  if (sector.routeCoordinates && sector.routeCoordinates.length > 1) {
    // Намираме най-близкия сегмент от маршрута
    let minDistanceToRoute = Infinity;
    let isOnApproachPath = false;
    
    for (let i = 0; i < sector.routeCoordinates.length - 1; i++) {
      const lineStart = sector.routeCoordinates[i];
      const lineEnd = sector.routeCoordinates[i + 1];
      
      const distanceToSegment = distanceToLineSegment(point, lineStart, lineEnd);
      
      if (distanceToSegment < minDistanceToRoute) {
        minDistanceToRoute = distanceToSegment;
        
        // Проверяваме дали този сегмент е в посоката към началото на сектора
        const [lng1, lat1] = lineStart;
        const [lng2, lat2] = lineEnd;
        const segmentDistToStart = getDistance(lat1, lng1, sector.startPoint.lat, sector.startPoint.lng);
        const segmentEndDistToStart = getDistance(lat2, lng2, sector.startPoint.lat, sector.startPoint.lng);
        
        // Ако сегментът води към началото на сектора (разстоянието намалява)
        if (segmentEndDistToStart < segmentDistToStart) {
          isOnApproachPath = true;
        }
      }
    }
    
    // Трябва да сме близо до маршрута (в рамките на 100м) и на правилния път
    return minDistanceToRoute < 100 && isOnApproachPath;
  } else {
    // Ако няма маршрут, проверяваме дали сме на въображаемата линия между началото и края
    const distanceToSectorLine = distanceToLineSegment(
      point,
      [sector.startPoint.lng, sector.startPoint.lat],
      [sector.endPoint.lng, sector.endPoint.lat]
    );
    
    // Трябва да сме близо до линията на сектора (в рамките на 100м)
    // и в предупредителната зона около началото
    return distanceToSectorLine < 100 && distToStart < warningDistance && distToStart > 50;
  }
}

export const useSectorStore = create(
  combine(
    {
      sectors: initialSectors as SectorWithRoute[],
      userLocation: null as Location | null,
      currentSector: null as Sector | null,
      sectorEntryTime: null as number | null,
      currentSectorAverageSpeed: 0,
      predictedAverageSpeed: 0,
      willExceedLimit: false,
      speedReadings: [] as number[],
      sectorHistory: [] as SectorHistoryEntry[],
      lastSectorCheckTime: 0,
      sectorConfirmationCount: 0,
      exitConfirmationCount: 0,
      sectorProgress: 0,
      lastNotificationThreshold: 0,
      sectorTotalDistance: 0,
      distanceTraveled: 0,
      recommendedSpeed: null as number | null,
    } as SectorState,
    (set, get) => ({
      initializeNotifications: async () => {
        if (Platform.OS !== 'web') {
          try {
            const { status } = await Notifications.requestPermissionsAsync();
            if (status === 'granted' && Platform.OS === 'android') {
              await Notifications.setNotificationChannelAsync('sectors', {
                name: 'Sector Notifications',
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
              });
            }
          } catch (error) {
            console.log('Notification channels feature is only supported on Android.');
          }
        }
      },

      checkSectorEntry: (location: Location) => {
        const state = get();
        const { sectors, currentSector, lastSectorCheckTime, sectorConfirmationCount } = state;
        
        // Дебаунсинг - не проверяваме твърде често
        const now = Date.now();
        if (now - lastSectorCheckTime < 500) { // Минимум 0.5 секунди между проверките
          return;
        }
        
        try {
          // Проверяваме дали сме в някой сектор
          const newSector = sectors.find(sector => 
            sector.active && isPointNearSector(location, sector, 80) // По-малък threshold за по-бърза детекция
          );

          // Ако вече сме в сектор, не правим нищо
          if (currentSector && newSector && currentSector.id === newSector.id) {
            // Нулираме брояча за излизане, защото все още сме в сектора
            set({ exitConfirmationCount: 0, lastSectorCheckTime: now });
            return;
          }

          // Ако откриваме нов сектор
          if (newSector && (!currentSector || currentSector.id !== newSector.id)) {
            // Изискваме 3 последователни потвърждения преди да влезем
            const newCount = sectorConfirmationCount + 1;
            
            if (newCount >= 2) {
              // Calculate total sector distance
              let totalDistance = 0;
              const sectorWithRoute = newSector as SectorWithRoute;
              
              if (sectorWithRoute.routeCoordinates && sectorWithRoute.routeCoordinates.length > 1) {
                for (let i = 0; i < sectorWithRoute.routeCoordinates.length - 1; i++) {
                  const [lng1, lat1] = sectorWithRoute.routeCoordinates[i];
                  const [lng2, lat2] = sectorWithRoute.routeCoordinates[i + 1];
                  totalDistance += getDistance(lat1, lng1, lat2, lng2);
                }
              } else {
                // Fallback to straight line distance
                totalDistance = getDistance(
                  newSector.startPoint.lat,
                  newSector.startPoint.lng,
                  newSector.endPoint.lat,
                  newSector.endPoint.lng
                );
              }
              
              // Влизаме в сектора
              set({ 
                currentSector: newSector, 
                sectorEntryTime: Date.now(),
                currentSectorAverageSpeed: 0,
                speedReadings: [],
                predictedAverageSpeed: 0,
                willExceedLimit: false,
                sectorConfirmationCount: 0,
                exitConfirmationCount: 0,
                lastSectorCheckTime: now,
                sectorProgress: 0,
                lastNotificationThreshold: 0,
                sectorTotalDistance: totalDistance,
                distanceTraveled: 0,
                recommendedSpeed: null
              });
              
              // Изпращаме известие
              if (Platform.OS !== 'web') {
                Notifications.scheduleNotificationAsync({
                  content: {
                    title: `Влязохте в сектор: ${newSector.name}`,
                    body: `Ограничение: ${newSector.speedLimit} км/ч`,
                    data: { sectorId: newSector.id },
                  },
                  trigger: null,
                }).catch(error => {
                  console.error('Failed to send notification:', error);
                });
              }
            } else {
              // Увеличаваме брояча
              set({ sectorConfirmationCount: newCount, lastSectorCheckTime: now });
            }
          } else {
            // Нулираме брояча ако не сме в сектор
            if (sectorConfirmationCount > 0) {
              set({ sectorConfirmationCount: 0, lastSectorCheckTime: now });
            }
          }
        } catch (error) {
          console.error('Error checking sector entry:', error);
        }
      },

      checkSectorExit: (location: Location, deviceId?: string) => {
        const state = get();
        const { currentSector, currentSectorAverageSpeed, exitConfirmationCount, lastSectorCheckTime } = state;
        
        if (!currentSector) return;
        
        // Дебаунсинг
        const now = Date.now();
        if (now - lastSectorCheckTime < 500) {
          return;
        }

        try {
          // Проверяваме дали все още сме в сектора
          const stillInSector = isPointNearSector(location, currentSector as SectorWithRoute, 120); // По-голям threshold за излизане

          // Ако все още сме в сектора
          if (stillInSector) {
            // Нулираме брояча за излизане
            if (exitConfirmationCount > 0) {
              set({ exitConfirmationCount: 0, lastSectorCheckTime: now });
            }
            return;
          }

          // Ако не сме в сектора, увеличаваме брояча
          const newExitCount = exitConfirmationCount + 1;
          
          // Изискваме 3 последователни потвърждения преди да излезем
          if (newExitCount >= 3) {
            const { sectorEntryTime, sectorHistory } = get();
            const duration = sectorEntryTime ? Date.now() - sectorEntryTime : 0;
            const exceeded = currentSectorAverageSpeed > currentSector.speedLimit;
            
            // Добавяме в историята
            const historyEntry: SectorHistoryEntry = {
              sectorId: currentSector.id,
              sectorName: currentSector.name,
              timestamp: Date.now(),
              averageSpeed: currentSectorAverageSpeed,
              speedLimit: currentSector.speedLimit,
              exceeded,
              duration
            };
            
            // Записваме в базата данни ако имаме device ID
            if (deviceId) {
              const actions = get() as SectorState & SectorActions;
              actions.saveViolationToDatabase(historyEntry, location, deviceId).catch(error => {
                console.error('Failed to save violation to database:', error);
              });
            }
            
            if (Platform.OS !== 'web') {
              Notifications.scheduleNotificationAsync({
                content: {
                  title: `Излязохте от сектор: ${currentSector.name}`,
                  body: `Средна скорост: ${currentSectorAverageSpeed.toFixed(1)} км/ч`,
                  data: { sectorId: currentSector.id },
                },
                trigger: null,
              }).catch(error => {
                console.error('Failed to send notification:', error);
              });
            }
            
            set({ 
              currentSector: null, 
              sectorEntryTime: null,
              currentSectorAverageSpeed: 0,
              speedReadings: [],
              predictedAverageSpeed: 0,
              willExceedLimit: false,
              sectorConfirmationCount: 0,
              exitConfirmationCount: 0,
              lastSectorCheckTime: now,
              sectorHistory: [historyEntry, ...sectorHistory].slice(0, 50),
              sectorProgress: 0,
              lastNotificationThreshold: 0,
              sectorTotalDistance: 0,
              distanceTraveled: 0,
              recommendedSpeed: null
            });
          } else {
            // Увеличаваме брояча за излизане
            set({ exitConfirmationCount: newExitCount, lastSectorCheckTime: now });
          }
        } catch (error) {
          console.error('Error checking sector exit:', error);
        }
      },

      updateSectorSpeed: (speed: number) => {
        const state = get();
        
        try {
          if (state.currentSector && state.sectorEntryTime) {
            const newReadings = [...state.speedReadings, speed];
            const avgSpeed = newReadings.reduce((a, b) => a + b, 0) / newReadings.length;
            
            // Calculate predicted average based on current trend
            const recentReadings = newReadings.slice(-10); // Last 10 readings
            const recentAvg = recentReadings.reduce((a, b) => a + b, 0) / recentReadings.length;
            const predicted = avgSpeed * 0.7 + recentAvg * 0.3; // Weighted prediction
            
            // Calculate recommended speed
            let recommendedSpeed: number | null = null;
            
            // Only calculate if we're exceeding the limit
            if (avgSpeed > state.currentSector.speedLimit) {
              const remainingDistance = Math.max(0, state.sectorTotalDistance - state.distanceTraveled);
              const distanceCoveredKm = state.distanceTraveled / 1000;
              const remainingDistanceKm = remainingDistance / 1000;
              const totalDistanceKm = state.sectorTotalDistance / 1000;
              
              if (remainingDistanceKm > 0.05) { // At least 50m remaining
                // Target average at the limit (not below)
                const targetAvg = state.currentSector.speedLimit;
                
                // Calculate required speed: (Target * Total - Current * Covered) / Remaining
                const requiredSpeed = (targetAvg * totalDistanceKm - avgSpeed * distanceCoveredKm) / remainingDistanceKm;
                
                // Only recommend if it's realistic (not too low and not negative)
                const minRealisticSpeed = Math.max(0, state.currentSector.speedLimit - 20);
                if (requiredSpeed >= minRealisticSpeed && requiredSpeed < state.currentSector.speedLimit) {
                  recommendedSpeed = Math.round(requiredSpeed);
                } else if (requiredSpeed < minRealisticSpeed) {
                  // If required speed is too low, it's impossible to recover
                  recommendedSpeed = null; // Will show "Няма как да паднете под лимита"
                }
              }
            }
            // If avgSpeed <= speedLimit, don't show any recommendation (we're already good)
            
            set({ 
              speedReadings: newReadings,
              currentSectorAverageSpeed: avgSpeed,
              predictedAverageSpeed: predicted,
              willExceedLimit: predicted > state.currentSector.speedLimit,
              recommendedSpeed
            });
          }
        } catch (error) {
          console.error('Error updating sector speed:', error);
        }
      },

      updateSectorProgress: (location: Location) => {
        const state = get();
        const { currentSector, sectorTotalDistance, lastNotificationThreshold } = state;
        
        if (!currentSector || sectorTotalDistance === 0) return;
        
        try {
          const sectorWithRoute = currentSector as SectorWithRoute;
          let distanceFromStart = 0;
          
          // Calculate distance traveled along the route
          if (sectorWithRoute.routeCoordinates && sectorWithRoute.routeCoordinates.length > 1) {
            // Find closest point on route and calculate distance from start
            let minDistance = Infinity;
            let closestSegmentIndex = 0;
            
            for (let i = 0; i < sectorWithRoute.routeCoordinates.length - 1; i++) {
              const distance = distanceToLineSegment(
                location,
                sectorWithRoute.routeCoordinates[i],
                sectorWithRoute.routeCoordinates[i + 1]
              );
              
              if (distance < minDistance) {
                minDistance = distance;
                closestSegmentIndex = i;
              }
            }
            
            // Calculate distance from start to closest segment
            for (let i = 0; i < closestSegmentIndex; i++) {
              const [lng1, lat1] = sectorWithRoute.routeCoordinates[i];
              const [lng2, lat2] = sectorWithRoute.routeCoordinates[i + 1];
              distanceFromStart += getDistance(lat1, lng1, lat2, lng2);
            }
            
            // Add partial distance on current segment
            if (closestSegmentIndex < sectorWithRoute.routeCoordinates.length - 1) {
              const [lng1, lat1] = sectorWithRoute.routeCoordinates[closestSegmentIndex];
              distanceFromStart += getDistance(lat1, lng1, location.latitude, location.longitude);
            }
          } else {
            // Fallback to straight line distance from start
            distanceFromStart = getDistance(
              currentSector.startPoint.lat,
              currentSector.startPoint.lng,
              location.latitude,
              location.longitude
            );
          }
          
          const progress = Math.min(1, distanceFromStart / sectorTotalDistance);
          
          // Check if we've crossed a notification threshold
          const thresholds = [0.33, 0.66];
          for (const threshold of thresholds) {
            if (progress >= threshold && lastNotificationThreshold < threshold) {
              // Send notification
              const { currentSectorAverageSpeed, recommendedSpeed } = state;
              const isExceeding = currentSectorAverageSpeed > currentSector.speedLimit;
              
              if (Platform.OS !== 'web') {
                const progressPercent = Math.round(threshold * 100);
                let notificationBody = '';
                
                if (isExceeding) {
                  notificationBody = `⚠️ Средна скорост: ${currentSectorAverageSpeed.toFixed(1)} км/ч\n` +
                    `Превишавате с ${(currentSectorAverageSpeed - currentSector.speedLimit).toFixed(1)} км/ч!\n` +
                    `Препоръчителна скорост: ${recommendedSpeed ? `≤${recommendedSpeed.toFixed(0)} км/ч` : 'Намалете!'}`;
                } else {
                  notificationBody = `✅ Средна скорост: ${currentSectorAverageSpeed.toFixed(1)} км/ч\n` +
                    `Всичко е наред - под лимита сте`;
                }
                
                Notifications.scheduleNotificationAsync({
                  content: {
                    title: `${progressPercent}% от сектор ${currentSector.name}`,
                    body: notificationBody,
                    data: { 
                      sectorId: currentSector.id,
                      progress: threshold,
                      isExceeding,
                      averageSpeed: currentSectorAverageSpeed,
                      recommendedSpeed
                    },
                    ...(isExceeding ? { sound: 'default' } : {}),
                  },
                  trigger: null,
                }).catch(error => {
                  console.error('Failed to send progress notification:', error);
                });
              }
              
              set({ lastNotificationThreshold: threshold });
            }
          }
          
          set({ 
            sectorProgress: progress,
            distanceTraveled: distanceFromStart
          });
        } catch (error) {
          console.error('Error updating sector progress:', error);
        }
      },

      loadSectorRoutes: async () => {
        try {
          console.log('Loading sector routes from Mapbox...');
          const loadedSectors = await Promise.all(
            initialSectors.map(async (sector) => {
              try {
                console.log(`Fetching route for sector ${sector.name}`);
                const route = await fetchSectorRoute(sector);
                
                if (route && route.length > 0) {
                  console.log(`Got ${route.length} points for sector ${sector.name}`);
                  return { ...sector, routeCoordinates: route } as SectorWithRoute;
                } else {
                  console.log(`Failed to load route for ${sector.name}, using straight line`);
                  return { 
                    ...sector, 
                    routeCoordinates: [
                      [sector.startPoint.lng, sector.startPoint.lat],
                      [sector.endPoint.lng, sector.endPoint.lat]
                    ]
                  } as SectorWithRoute;
                }
              } catch (error) {
                console.error(`Error loading route for ${sector.name}:`, error);
                return { 
                  ...sector, 
                  routeCoordinates: [
                    [sector.startPoint.lng, sector.startPoint.lat],
                    [sector.endPoint.lng, sector.endPoint.lat]
                  ]
                } as SectorWithRoute;
              }
            })
          );
          
          console.log('All sector routes loaded');
          set({ sectors: loadedSectors });
          
          // Запазваме секторите с маршрути в AsyncStorage за background task
          try {
            await AsyncStorage.setItem('sectors-with-routes', JSON.stringify(loadedSectors));
            console.log('Sectors with routes saved to AsyncStorage');
          } catch (error) {
            console.error('Failed to save sectors with routes to AsyncStorage:', error);
          }
        } catch (error) {
          console.error('Error loading sector routes:', error);
          // Fallback to sectors without routes
          set({ sectors: initialSectors });
        }
      },

      loadFromStorage: async () => {
        try {
          console.log('Loading sectors from storage...');
          // For now, just initialize with default sectors
          // In the future, this could load custom sectors from AsyncStorage
          set({ sectors: initialSectors });
          
          // Load routes after setting sectors
          const actions = get() as SectorState & SectorActions;
          await actions.loadSectorRoutes();
        } catch (error) {
          console.error('Failed to load sectors from storage:', error);
          // Fallback to default sectors
          set({ sectors: initialSectors });
        }
      },
      
      addToHistory: (entry: SectorHistoryEntry) => {
        const { sectorHistory } = get();
        set({ 
          sectorHistory: [entry, ...sectorHistory].slice(0, 50) // Keep last 50 entries
        });
      },
      
      saveViolationToDatabase: async (entry: SectorHistoryEntry, location: Location, deviceId: string) => {
        try {
          console.log('Saving violation to database:', {
            deviceId,
            sectorId: entry.sectorId,
            sectorName: entry.sectorName,
            speedLimit: entry.speedLimit,
            currentSpeed: entry.averageSpeed,
            violationType: entry.exceeded ? 'speeding' : 'normal',
            location,
            timestamp: new Date(entry.timestamp).toISOString(),
          });
          
          const result = await trpcClient.violations.save.mutate({
            device_id: deviceId,
            sector_id: entry.sectorId,
            sector_name: entry.sectorName,
            speed_limit: entry.speedLimit,
            current_speed: entry.averageSpeed,
            violation_type: entry.exceeded ? 'speeding' : 'normal',
            location: {
              latitude: location.latitude,
              longitude: location.longitude,
            },
            timestamp: new Date(entry.timestamp).toISOString(),
          });
          
          console.log('Violation saved successfully:', result);
        } catch (error) {
          console.error('Error saving violation to database:', error);
          // Don't throw error to avoid breaking the app flow
        }
      },
      
      syncWithBackgroundTask: async () => {
        try {
          const currentSectorStr = await AsyncStorage.getItem('current-sector');
          const sectorMonitorDataStr = await AsyncStorage.getItem('sector-monitor-data');
          
          console.log('🔄 Syncing with background task...');
          console.log('  - current-sector:', currentSectorStr ? 'EXISTS' : 'NULL');
          console.log('  - sector-monitor-data:', sectorMonitorDataStr ? 'EXISTS' : 'NULL');
          
          if (currentSectorStr) {
            const currentSectorData = JSON.parse(currentSectorStr);
            const monitorData = sectorMonitorDataStr ? JSON.parse(sectorMonitorDataStr) : null;
            
            console.log('  - currentSectorData:', currentSectorData);
            console.log('  - monitorData:', monitorData);
            
            const sector = initialSectors.find(s => s.id === currentSectorData.id);
            
            if (sector) {
              console.log('✅ Syncing with background task - sector found:', sector.name);
              
              const state = get();
              
              if (!state.currentSector || state.currentSector.id !== sector.id) {
                console.log('🆕 Setting current sector from background task:', sector.name);
                
                const sectorWithRoute = state.sectors.find(s => s.id === sector.id) || sector;
                
                let totalDistance = 0;
                const sectorWithRouteTyped = sectorWithRoute as SectorWithRoute;
                
                if (sectorWithRouteTyped.routeCoordinates && sectorWithRouteTyped.routeCoordinates.length > 1) {
                  for (let i = 0; i < sectorWithRouteTyped.routeCoordinates.length - 1; i++) {
                    const [lng1, lat1] = sectorWithRouteTyped.routeCoordinates[i];
                    const [lng2, lat2] = sectorWithRouteTyped.routeCoordinates[i + 1];
                    totalDistance += getDistance(lat1, lng1, lat2, lng2);
                  }
                } else {
                  totalDistance = getDistance(
                    sector.startPoint.lat,
                    sector.startPoint.lng,
                    sector.endPoint.lat,
                    sector.endPoint.lng
                  );
                }
                
                set({
                  currentSector: sector,
                  sectorEntryTime: monitorData?.entryTime || Date.now(),
                  currentSectorAverageSpeed: monitorData?.averageSpeed || 0,
                  speedReadings: monitorData?.speedReadings || [],
                  predictedAverageSpeed: monitorData?.averageSpeed || 0,
                  willExceedLimit: (monitorData?.averageSpeed || 0) > sector.speedLimit,
                  sectorTotalDistance: totalDistance,
                  distanceTraveled: 0,
                  recommendedSpeed: monitorData?.recommendedSpeed || null,
                  sectorProgress: 0,
                  lastNotificationThreshold: 0,
                  sectorConfirmationCount: 0,
                  exitConfirmationCount: 0,
                });
                
                console.log('✅ Current sector set to:', sector.name);
              } else {
                console.log('🔄 Updating sector data from background task');
                if (monitorData) {
                  set({
                    currentSectorAverageSpeed: monitorData.averageSpeed || state.currentSectorAverageSpeed,
                    speedReadings: monitorData.speedReadings || state.speedReadings,
                    predictedAverageSpeed: monitorData.averageSpeed || state.predictedAverageSpeed,
                    willExceedLimit: (monitorData.averageSpeed || 0) > sector.speedLimit,
                    recommendedSpeed: monitorData.recommendedSpeed || state.recommendedSpeed,
                  });
                }
              }
            } else {
              console.log('⚠️ Sector not found in initialSectors:', currentSectorData.id);
            }
          } else {
            const state = get();
            if (state.currentSector) {
              console.log('❌ Background task has no sector, clearing current sector');
              set({
                currentSector: null,
                sectorEntryTime: null,
                currentSectorAverageSpeed: 0,
                speedReadings: [],
                predictedAverageSpeed: 0,
                willExceedLimit: false,
                sectorProgress: 0,
                lastNotificationThreshold: 0,
                sectorTotalDistance: 0,
                distanceTraveled: 0,
                recommendedSpeed: null,
                sectorConfirmationCount: 0,
                exitConfirmationCount: 0,
              });
            }
          }
        } catch (error) {
          console.error('❌ Error syncing with background task:', error);
        }
      },
    } as SectorActions)
  )
);