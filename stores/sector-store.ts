import { create } from 'zustand';
import { combine } from 'zustand/middleware';
import { sectors as initialSectors, Sector } from '@/data/sectors';
import { Platform } from 'react-native';
import { fetchSectorRoute } from '@/utils/mapbox-directions';
import { trpcClient } from '@/lib/trpc';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  PROXIMITY_THRESHOLD_ENTER,
  PROXIMITY_THRESHOLD_EXIT,
  WARNING_DISTANCE_M,
  ROUTE_SNAP_THRESHOLD_M,
} from '@/constants/proximity';
import { computeRecommendedSpeedKmH } from '@/utils/speed-calculations';

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
  lastSpeedUpdateTime: number | null; // Last time we updated speed for time-based average calculation
  lastEntryNotificationTime: number; // Last time we sent entry notification (debounce)
  lastExitNotificationTime: number; // Last time we sent exit notification (debounce)
  lastEntryNotificationSectorId: string | null; // Last sector ID we sent entry notification for
  lastExitNotificationSectorId: string | null; // Last sector ID we sent exit notification for
}

interface SectorActions {
  initializeNotifications: () => Promise<void>;
  checkSectorEntry: (location: Location) => Promise<void>;
  checkSectorExit: (location: Location, deviceId?: string, userId?: string) => Promise<void>;
  updateSectorSpeed: (speed: number) => void;
  updateSectorProgress: (location: Location) => Promise<void>;
  loadSectorRoutes: (maxRetries?: number) => Promise<void>;
  reloadSectorRoutes: () => Promise<void>; // Force reload routes (clears cache)
  loadFromStorage: () => Promise<void>;
  addToHistory: (entry: SectorHistoryEntry) => void;
  saveViolationToDatabase: (entry: SectorHistoryEntry, location: Location, deviceId: string, userId?: string) => Promise<void>;
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
function isPointNearSector(point: Location, sector: SectorWithRoute, threshold: number = PROXIMITY_THRESHOLD_ENTER): boolean {
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
function isApproachingSectorOnRoute(point: Location, sector: SectorWithRoute, warningDistance: number = WARNING_DISTANCE_M): boolean {
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
      lastSpeedUpdateTime: null as number | null,
      lastEntryNotificationTime: 0,
      lastExitNotificationTime: 0,
      lastEntryNotificationSectorId: null as string | null,
      lastExitNotificationSectorId: null as string | null,
    } as SectorState,
    (set, get) => ({
      initializeNotifications: async () => {
        // Каналът и разрешенията се управляват от settings-store
        // Този метод може да остане празен или да бъде премахнат
      },

      checkSectorEntry: async (location: Location) => {
        const state = get();
        const { sectors, currentSector, lastSectorCheckTime, sectorConfirmationCount, lastEntryNotificationTime, lastEntryNotificationSectorId } = state;
        
        // Дебаунсинг - не проверяваме твърде често
        const now = Date.now();
        if (now - lastSectorCheckTime < 1000) { // 1 секунда между проверките
          return;
        }
        
        // Debounce за нотификации - минимум 5 секунди между нотификации за влизане
        const NOTIFICATION_DEBOUNCE_MS = 5000;
        
        try {
          // Проверяваме дали сме в някой сектор
          // UI store използва същите прагове като BG task
          const newSector = sectors.find(sector => 
            sector.active && isPointNearSector(location, sector, PROXIMITY_THRESHOLD_ENTER)
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
            
            if (newCount >= 3) {
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
                recommendedSpeed: null,
                lastSpeedUpdateTime: Date.now()
              });
              
              // NOTIFICATIONS: Само BG task праща нотификации за entry/exit
              // UI store само синхронизира състоянието и показва overlay
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

      checkSectorExit: async (location: Location, deviceId?: string, userId?: string) => {
        const state = get();
        const { currentSector, currentSectorAverageSpeed, exitConfirmationCount, lastSectorCheckTime, lastExitNotificationTime, lastExitNotificationSectorId } = state;
        
        if (!currentSector) return;
        
        // Дебаунсинг
        const now = Date.now();
        if (now - lastSectorCheckTime < 500) {
          return;
        }
        
        // Debounce за нотификации - минимум 5 секунди между нотификации за излизане
        const NOTIFICATION_DEBOUNCE_MS = 5000;

        try {
          // Проверяваме дали все още сме в сектора
          // Използваме по-голям threshold за излизане за да избегнем фликер
          const stillInSector = isPointNearSector(location, currentSector as SectorWithRoute, PROXIMITY_THRESHOLD_EXIT);

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
            
            // Записваме в базата данни ако имаме device ID или user ID
            if (deviceId || userId) {
              const actions = get() as SectorState & SectorActions;
              actions.saveViolationToDatabase(historyEntry, location, deviceId || '', userId).catch(error => {
                console.error('Failed to save violation to database:', error);
              });
            }
            
            // NOTIFICATIONS: Само BG task праща нотификации за exit
            // UI store само синхронизира състоянието
            
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
              recommendedSpeed: null,
              lastSpeedUpdateTime: null
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
            const now = Date.now();
            const newReadings = [...state.speedReadings, speed];
            
            const timeInSectorSeconds = (now - state.sectorEntryTime) / 1000;
            
            let avgSpeed = 0;
            if (newReadings.length > 0) {
              avgSpeed = newReadings.reduce((a, b) => a + b, 0) / newReadings.length;
            }
            
            const recentReadings = newReadings.slice(-10);
            const recentAvg = recentReadings.reduce((a, b) => a + b, 0) / recentReadings.length;
            const predicted = avgSpeed * 0.7 + recentAvg * 0.3;
            
            let recommendedSpeed: number | null = null;
            
            if (avgSpeed > state.currentSector.speedLimit) {
              const remainingDistance = Math.max(0, state.sectorTotalDistance - state.distanceTraveled);
              const distanceCoveredKm = state.distanceTraveled / 1000;
              const remainingDistanceKm = remainingDistance / 1000;
              const totalDistanceKm = state.sectorTotalDistance / 1000;
              
              if (remainingDistanceKm > 0.1) {
                const targetAvg = state.currentSector.speedLimit;
                const requiredSpeed = (targetAvg * totalDistanceKm - avgSpeed * distanceCoveredKm) / remainingDistanceKm;
                
                const minRealisticSpeed = Math.max(0, state.currentSector.speedLimit - 30);
                if (requiredSpeed >= minRealisticSpeed && requiredSpeed <= state.currentSector.speedLimit) {
                  recommendedSpeed = Math.round(requiredSpeed);
                } else if (requiredSpeed < minRealisticSpeed) {
                  recommendedSpeed = -1;
                }
              } else {
                recommendedSpeed = -1;
              }
            }
            
            set({ 
              speedReadings: newReadings,
              currentSectorAverageSpeed: avgSpeed,
              predictedAverageSpeed: predicted,
              willExceedLimit: predicted > state.currentSector.speedLimit,
              recommendedSpeed,
              lastSpeedUpdateTime: now
            });
          }
        } catch (error) {
          console.error('Error updating sector speed:', error);
        }
      },

      updateSectorProgress: async (location: Location) => {
        const state = get();
        const { currentSector, sectorTotalDistance, lastNotificationThreshold, distanceTraveled } = state;
        
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
            
            // When we just entered (distanceTraveled === 0), reset to start from beginning
            // This ensures progress starts from 0% instead of potentially showing 100%
            if (distanceTraveled === 0) {
              // Reset to calculate from actual start point
              distanceFromStart = getDistance(
                currentSector.startPoint.lat,
                currentSector.startPoint.lng,
                location.latitude,
                location.longitude
              );
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
          
          // Calculate progress (0 to 1)
          // When we just entered (distanceTraveled === 0), progress MUST be 0
          // This ensures we always start from 0% when entering a sector
          let progress: number;
          let newDistanceTraveled: number;
          
          if (distanceTraveled === 0) {
            // Just entered - progress is ALWAYS 0, regardless of physical location
            // This prevents showing 100% when entering near the end of a sector
            progress = 0;
            // Start tracking distance from this point forward
            // Use a small initial value to mark that we've started tracking
            newDistanceTraveled = Math.max(0, distanceFromStart);
          } else {
            // Already traveling - use calculated distance along route
            progress = Math.min(1, Math.max(0, distanceFromStart / sectorTotalDistance));
            newDistanceTraveled = distanceFromStart;
          }
          
          // Check if we've crossed the 50% notification threshold
          const threshold = 0.5;
          if (progress >= threshold && lastNotificationThreshold < threshold) {
            // Send notification
            const { currentSectorAverageSpeed, recommendedSpeed } = state;
            const isExceeding = currentSectorAverageSpeed > currentSector.speedLimit;
            
            // NOTIFICATIONS: 50% progress нотификацията се праща от BG task
            // UI store само обновява прогреса
            
            set({ lastNotificationThreshold: threshold });
          }
          
          set({ 
            sectorProgress: progress,
            distanceTraveled: newDistanceTraveled
          });
        } catch (error) {
          console.error('Error updating sector progress:', error);
        }
      },

      reloadSectorRoutes: async () => {
        // Force reload by clearing cache first
        const { clearRouteCache, clearRouteCacheForSector } = await import('@/utils/mapbox-directions');
        clearRouteCache();
        console.log('🔄 Force reloading sector routes (cache cleared)...');
        
        // Clear cache for updated sectors
        clearRouteCacheForSector('27'); // Цариградско шосе - посока 1
        clearRouteCacheForSector('28'); // Цариградско шосе - посока 2
        clearRouteCacheForSector('32'); // Бул. България - посока 1
        clearRouteCacheForSector('33'); // Бул. България - посока 2
        
        const actions = get() as SectorState & SectorActions;
        return actions.loadSectorRoutes(3); // Start with fresh retries
      },

      loadSectorRoutes: async (maxRetries: number = 3) => {
        try {
          console.log(`🔄 Loading sector routes from Mapbox... (attempt ${4 - maxRetries}/3)`);
          
          // Get current sectors from state (may be loaded from backend or local)
          const { sectors: currentSectors } = get();
          
          // Check if we have environment loaded
          const { ENV } = await import('@/utils/env');
          if (!ENV.mapboxToken || ENV.mapboxToken === '') {
            console.error('❌ Mapbox token not available - cannot load routes');
            // Keep sectors without routes - will retry when token is available
            return;
          }
          
          // Helper function to fetch route with retry for a single sector
          const fetchRouteWithRetry = async (sector: Sector, retriesLeft: number = 2): Promise<[number, number][] | null> => {
            try {
              const route = await fetchSectorRoute(sector);
              if (route && route.length > 2) {
                return route;
              }
              
              if (retriesLeft > 0) {
                console.log(`⚠️ Retrying route for ${sector.name}... (${retriesLeft} retries left)`);
                await new Promise(resolve => setTimeout(resolve, 1000 * (3 - retriesLeft))); // Exponential backoff
                return fetchRouteWithRetry(sector, retriesLeft - 1);
              }
              
              return null;
            } catch (error) {
              if (retriesLeft > 0) {
                console.log(`⚠️ Error fetching route for ${sector.name}, retrying... (${retriesLeft} retries left)`);
                await new Promise(resolve => setTimeout(resolve, 1000 * (3 - retriesLeft)));
                return fetchRouteWithRetry(sector, retriesLeft - 1);
              }
              throw error;
            }
          };
          
          // Load routes with retry logic - process sectors in batches to avoid overwhelming the API
          const batchSize = 5;
          const loadedSectors: SectorWithRoute[] = [];
          
          // Use sectors from state instead of initialSectors
          const sectorsToProcess = currentSectors.length > 0 ? currentSectors : initialSectors;
          
          for (let i = 0; i < sectorsToProcess.length; i += batchSize) {
            const batch = sectorsToProcess.slice(i, i + batchSize);
            console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} sectors)...`);
            
            const batchResults = await Promise.allSettled(
              batch.map(async (sector) => {
                // Skip if route already exists
                const sectorWithRoute = sector as SectorWithRoute;
                if (sectorWithRoute.routeCoordinates && sectorWithRoute.routeCoordinates.length > 2) {
                  console.log(`⏭️ Skipping ${sector.name} - route already loaded`);
                  return sectorWithRoute;
                }
                
                try {
                  console.log(`🚗 Fetching route for sector ${sector.name}...`);
                  console.log(`📍 From: ${sector.startPoint.lat}, ${sector.startPoint.lng}`);
                  console.log(`📍 To: ${sector.endPoint.lat}, ${sector.endPoint.lng}`);
                  
                  const route = await fetchRouteWithRetry(sector);
                  
                  if (route && route.length > 2) {
                    console.log(`✅ Got ${route.length} points for sector ${sector.name}`);
                    return { ...sector, routeCoordinates: route } as SectorWithRoute;
                  } else {
                    console.error(`❌ Failed to load route for ${sector.name} after retries`);
                    return { ...sector, routeCoordinates: sectorWithRoute.routeCoordinates } as SectorWithRoute;
                  }
                } catch (error) {
                  console.error(`❌ Error loading route for ${sector.name}:`, error);
                  return { ...sector, routeCoordinates: sectorWithRoute.routeCoordinates } as SectorWithRoute;
                }
              })
            );
            
            // Add batch results to loaded sectors
            batchResults.forEach((result, idx) => {
              if (result.status === 'fulfilled') {
                loadedSectors.push(result.value);
              } else {
                console.error(`❌ Promise rejected for sector ${batch[idx].name}:`, result.reason);
                loadedSectors.push({
                  ...batch[idx],
                  routeCoordinates: (batch[idx] as SectorWithRoute).routeCoordinates
                } as SectorWithRoute);
              }
            });
            
            // Small delay between batches to avoid rate limiting
            if (i + batchSize < sectorsToProcess.length) {
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
          
          // Update state with loaded sectors
          const successCount = loadedSectors.filter(s => s.routeCoordinates && s.routeCoordinates.length > 2).length;
          const pendingCount = loadedSectors.length - successCount;
          
          console.log(`✅ Loaded ${successCount}/${sectorsToProcess.length} sector routes successfully`);
          
          if (pendingCount > 0 && maxRetries > 0) {
            console.log(`⏳ ${pendingCount} sectors failed - retrying in 2 seconds...`);
            // Retry failed sectors after a delay
            setTimeout(() => {
              const actions = get() as SectorState & SectorActions;
              actions.loadSectorRoutes(maxRetries - 1).catch(err => {
                console.error('❌ Retry failed:', err);
              });
            }, 2000);
          } else if (pendingCount > 0) {
            console.error(`❌ ${pendingCount} sectors failed to load routes after all retries`);
          }
          
          // Always update state, even if some routes failed
          set({ sectors: loadedSectors });
          
          // Запазваме секторите с маршрути в AsyncStorage за background task
          try {
            await AsyncStorage.setItem('sectors-with-routes', JSON.stringify(loadedSectors));
            console.log('Sectors with routes saved to AsyncStorage');
          } catch (error) {
            console.error('Failed to save sectors with routes to AsyncStorage:', error);
          }
        } catch (error) {
          console.error('❌ Error loading sector routes:', error);
          // Don't create fallback - leave sectors without routeCoordinates so they can be loaded later
          const { sectors: currentSectors } = get();
          const sectorsWithoutRoutes = (currentSectors.length > 0 ? currentSectors : initialSectors).map(sector => ({
            ...sector,
            routeCoordinates: (sector as SectorWithRoute).routeCoordinates
          } as SectorWithRoute));
          set({ sectors: sectorsWithoutRoutes });
          console.log('⏳ Sectors initialized without routes - will load routes on next attempt');
        }
      },

      loadFromStorage: async () => {
        try {
          console.log('Loading sectors from backend...');
          
          // Try to load sectors from backend first
          try {
            const result = await trpcClient.sectors.list.query();
            
            if (result && result.sectors && result.sectors.length > 0) {
              console.log(`✅ Loaded ${result.sectors.length} sectors from backend`);
              set({ sectors: result.sectors as SectorWithRoute[] });
              
              // Load routes in the background (don't wait for it)
              const actions = get() as SectorState & SectorActions;
              actions.loadSectorRoutes().catch(error => {
                console.error('Failed to load sector routes in background:', error);
              });
              console.log('✅ Sectors initialized from backend, routes loading in background');
              return;
            } else {
              console.warn('⚠️ Backend returned empty sectors array, falling back to local sectors');
            }
          } catch (backendError) {
            console.warn('⚠️ Failed to load sectors from backend, falling back to local sectors:', backendError);
          }
          
          // Fallback to local sectors if backend fails or returns empty
          console.log('Using local sectors as fallback...');
          set({ sectors: initialSectors as SectorWithRoute[] });
          
          // Load routes in the background (don't wait for it)
          const actions = get() as SectorState & SectorActions;
          actions.loadSectorRoutes().catch(error => {
            console.error('Failed to load sector routes in background:', error);
          });
          console.log('✅ Sectors initialized from local data, routes loading in background');
        } catch (error) {
          console.error('Failed to load sectors:', error);
          // Final fallback to default sectors
          set({ sectors: initialSectors as SectorWithRoute[] });
        }
      },
      
      addToHistory: (entry: SectorHistoryEntry) => {
        const { sectorHistory } = get();
        set({ 
          sectorHistory: [entry, ...sectorHistory].slice(0, 50) // Keep last 50 entries
        });
      },
      
      saveViolationToDatabase: async (entry: SectorHistoryEntry, location: Location, deviceId: string, userId?: string) => {
        try {
          console.log('Saving violation to database:', {
            userId,
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
            user_id: userId || undefined,
            device_id: !userId ? deviceId : undefined, // Only use device_id if no user_id
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
            duration: entry.duration,
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
            
            const state = get();
            // Try to find sector from state first (may be loaded from backend), fallback to initialSectors
            const sector = state.sectors.find(s => s.id === currentSectorData.id) || initialSectors.find(s => s.id === currentSectorData.id);
            
            if (sector) {
              console.log('✅ Syncing with background task - sector found:', sector.name);
              
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
                  lastSpeedUpdateTime: Date.now()
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
                lastSpeedUpdateTime: null
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