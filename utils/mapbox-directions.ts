const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;

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

export async function fetchSectorRoute(sector: Sector): Promise<[number, number][] | null> {
  try {
    // Check if Mapbox token is available
    if (!MAPBOX_TOKEN) {
      console.error(`❌ Mapbox token not found. Please set EXPO_PUBLIC_MAPBOX_TOKEN in your environment variables.`);
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

    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${sector.startPoint.lng},${sector.startPoint.lat};${sector.endPoint.lng},${sector.endPoint.lat}?geometries=geojson&overview=full&steps=true&access_token=${MAPBOX_TOKEN}`;
    
    console.log(`🚗 Fetching route for ${sector.name}`);
    console.log(`📍 From: ${sector.startPoint.lat}, ${sector.startPoint.lng}`);
    console.log(`📍 To: ${sector.endPoint.lat}, ${sector.endPoint.lng}`);
    
    const response = await fetch(url);
    console.log(`📡 Response status: ${response.status}`);
    
    if (!response.ok) {
      console.error(`❌ Failed to fetch route for ${sector.name}:`, response.status);
      try {
        const errorData = await response.json();
        console.error(`❌ Error details for ${sector.name}:`, errorData);
        
        if (response.status === 401) {
          console.error(`❌ Authentication failed. Please check your Mapbox token.`);
        } else if (response.status === 422) {
          console.error(`❌ Invalid coordinates or request parameters.`);
        }
      } catch {
        try {
          const errorText = await response.text();
          console.error(`❌ Error details for ${sector.name}:`, errorText);
        } catch {
          console.error('Could not read error response');
        }
      }
      return null;
    }
    
    const data = await response.json();
    console.log(`📊 API Response for ${sector.name}:`, {
      routes: data.routes?.length || 0,
      code: data.code
    });
    
    if (data.routes && Array.isArray(data.routes) && data.routes.length > 0) {
      const route = data.routes[0];
      if (route.geometry && route.geometry.coordinates && Array.isArray(route.geometry.coordinates)) {
        const coordinates = route.geometry.coordinates;
        console.log(`✅ Route found for ${sector.name} with ${coordinates.length} points`);
        console.log(`🗺️ First coordinate: [${coordinates[0][0]}, ${coordinates[0][1]}]`);
        console.log(`🗺️ Last coordinate: [${coordinates[coordinates.length-1][0]}, ${coordinates[coordinates.length-1][1]}]`);
        
        // Ensure coordinates are valid numbers
        const validCoordinates = coordinates.filter((coord: any) => 
          Array.isArray(coord) && 
          coord.length === 2 && 
          typeof coord[0] === 'number' && 
          typeof coord[1] === 'number' &&
          !isNaN(coord[0]) && !isNaN(coord[1])
        );
        
        if (validCoordinates.length > 0) {
          console.log(`✅ Valid coordinates: ${validCoordinates.length}/${coordinates.length}`);
          return validCoordinates as [number, number][];
        } else {
          console.error(`❌ No valid coordinates found for ${sector.name}`);
          return null;
        }
      } else {
        console.error(`❌ Invalid route geometry for ${sector.name}`);
        return null;
      }
    }
    
    console.log(`❌ No routes found for ${sector.name}`);
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