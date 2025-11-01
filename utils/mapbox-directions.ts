import { ENV } from './env';

const MAPBOX_TOKEN = ENV.mapboxToken;

// Cache for storing successful route fetches
const routeCache = new Map<string, [number, number][]>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const cacheTimestamps = new Map<string, number>();

// Function to clear route cache (useful when coordinates change)
export function clearRouteCache() {
  console.log('🗑️ Clearing route cache...');
  routeCache.clear();
  cacheTimestamps.clear();
  console.log('✅ Route cache cleared');
}

// Function to clear cache for a specific sector
export function clearRouteCacheForSector(sectorId: string) {
  console.log(`🗑️ Clearing route cache for sector ${sectorId}...`);
  const keysToDelete: string[] = [];
  routeCache.forEach((_, key) => {
    if (key.startsWith(`${sectorId}_`)) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => {
    routeCache.delete(key);
    cacheTimestamps.delete(key);
  });
  console.log(`✅ Cleared ${keysToDelete.length} cached routes for sector ${sectorId}`);
}

export interface RouteCoordinate {
  latitude: number;
  longitude: number;
}

interface Sector {
  id: string;
  name: string;
  startPoint: {
    lat: number;
    lng: number;
    name: string;
    km?: number;
  };
  endPoint: {
    lat: number;
    lng: number;
    name: string;
    km?: number;
  };
}

// Helper function to fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = 5000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export async function fetchSectorRoute(sector: Sector): Promise<[number, number][] | null> {
  try {
    // Create cache key
    const cacheKey = `${sector.id}_${sector.startPoint.lng}_${sector.startPoint.lat}_${sector.endPoint.lng}_${sector.endPoint.lat}`;
    
    // Check cache first
    const cachedRoute = routeCache.get(cacheKey);
    const cacheTime = cacheTimestamps.get(cacheKey);
    
    if (cachedRoute && cacheTime && (Date.now() - cacheTime) < CACHE_DURATION) {
      console.log(`📦 Using cached route for ${sector.name} (${cachedRoute.length} points)`);
      return cachedRoute;
    }

    // Check if Mapbox token is available
    if (!MAPBOX_TOKEN || MAPBOX_TOKEN === '') {
      console.warn(`⚠️ Mapbox token not found for ${sector.name}. Using fallback route.`);
      return null;
    }

    // Validate sector data
    if (!sector || !sector.startPoint || !sector.endPoint) {
      console.error(`❌ Invalid sector data for ${sector?.name || 'unknown'}`);
      return null;
    }

    if (typeof sector.startPoint.lng !== 'number' || typeof sector.startPoint.lat !== 'number' ||
        typeof sector.endPoint.lng !== 'number' || typeof sector.endPoint.lat !== 'number') {
      console.error(`❌ Invalid coordinates for ${sector.name}`);
      return null;
    }

    // Try multiple routing profiles for better road following
    const profiles = ['driving', 'driving-traffic'];
    let bestRoute: [number, number][] | null = null;
    
    for (const profile of profiles) {
      try {
        const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${sector.startPoint.lng},${sector.startPoint.lat};${sector.endPoint.lng},${sector.endPoint.lat}?geometries=geojson&overview=full&steps=true&alternatives=false&continue_straight=false&access_token=${MAPBOX_TOKEN}`;
        
        console.log(`🚗 Fetching route for ${sector.name} using ${profile} profile`);
        console.log(`📍 From: ${sector.startPoint.lat}, ${sector.startPoint.lng}`);
        console.log(`📍 To: ${sector.endPoint.lat}, ${sector.endPoint.lng}`);
        
        // Use fetch with 10 second timeout to give more time for route calculation
        const response = await fetchWithTimeout(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
        }, 10000);
        
        console.log(`📡 Response status for ${profile}: ${response.status}`);
        
        if (!response.ok) {
          console.error(`❌ Failed to fetch route for ${sector.name} with ${profile}:`, response.status);
          
          if (response.status === 401) {
            console.error(`❌ Authentication failed. Mapbox token may be invalid or expired.`);
            // Don't try other profiles if auth fails
            break;
          } else if (response.status === 422) {
            console.error(`❌ Invalid coordinates or request parameters for ${profile}.`);
            continue; // Try next profile
          } else if (response.status === 429) {
            console.error(`❌ Rate limit exceeded. Waiting before retry...`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
          
          try {
            const errorData = await response.json();
            console.error(`❌ Error details for ${sector.name} (${profile}):`, errorData);
          } catch {
            console.error('Could not read error response');
          }
          continue;
        }
        
        const data = await response.json();
        console.log(`📊 API Response for ${sector.name} (${profile}):`, {
          routes: data.routes?.length || 0,
          code: data.code
        });
        
        if (data.routes && Array.isArray(data.routes) && data.routes.length > 0) {
          const route = data.routes[0];
          if (route.geometry && route.geometry.coordinates && Array.isArray(route.geometry.coordinates)) {
            const coordinates = route.geometry.coordinates;
            console.log(`✅ Route found for ${sector.name} with ${profile}: ${coordinates.length} points`);
            
            // Ensure coordinates are valid numbers
            const validCoordinates = coordinates.filter((coord: any) => 
              Array.isArray(coord) && 
              coord.length === 2 && 
              typeof coord[0] === 'number' && 
              typeof coord[1] === 'number' &&
              !isNaN(coord[0]) && !isNaN(coord[1])
            );
            
            if (validCoordinates.length > 2) { // Need at least 3 points for a proper route
              console.log(`✅ Valid coordinates: ${validCoordinates.length}/${coordinates.length}`);
              bestRoute = validCoordinates as [number, number][];
              
              // Cache the successful route
              routeCache.set(cacheKey, bestRoute);
              cacheTimestamps.set(cacheKey, Date.now());
              
              return bestRoute;
            }
          }
        }
      } catch (error) {
        console.error(`💥 Error fetching route for ${sector.name} with ${profile}:`, error);
        continue;
      }
    }
    
    // If no route was found with any profile, return null
    console.log(`❌ No valid routes found for ${sector.name} with any profile`);
    return null;
    

  } catch (error) {
    console.error(`💥 Error fetching route for ${sector.name}:`, error);
    return null;
  }
}

export async function getRouteCoordinates(
  start: RouteCoordinate,
  end: RouteCoordinate
): Promise<RouteCoordinate[]> {
  try {
    // Check if Mapbox token is available
    if (!MAPBOX_TOKEN) {
      console.error(`❌ Mapbox token not found. Please set EXPO_PUBLIC_MAPBOX_TOKEN in your environment variables.`);
      return [];
    }

    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${start.longitude},${start.latitude};${end.longitude},${end.latitude}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
    
    console.log(`Fetching route: ${start.latitude},${start.longitude} to ${end.latitude},${end.longitude}`);
    
    const response = await fetch(url);
    if (!response.ok) {
      console.error('Failed to fetch directions:', response.status);
      if (response.status === 401) {
        console.error(`❌ Authentication failed. Please check your Mapbox token.`);
      }
      return [];
    }
    
    const data = await response.json();
    
    if (data.routes && data.routes.length > 0) {
      const coordinates = data.routes[0].geometry.coordinates;
      console.log(`Route found with ${coordinates.length} points`);
      return coordinates.map((coord: number[]) => ({
        latitude: coord[1],
        longitude: coord[0]
      }));
    }
    
    console.log('No routes found');
    return [];
  } catch (error) {
    console.error('Error fetching route:', error);
    return [];
  }
}