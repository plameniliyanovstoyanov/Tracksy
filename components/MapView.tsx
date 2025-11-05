import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Navigation, MapPin } from 'lucide-react-native';
import * as Location from 'expo-location';
import Mapbox, { MapView as MapboxMapView, Camera, ShapeSource, LineLayer, SymbolLayer, PointAnnotation, MarkerView } from '@rnmapbox/maps';
import { useSectorStore } from '@/stores/sector-store';
import { ENV } from '@/utils/env';

// Initialize Mapbox token immediately - before any component renders
if (ENV.mapboxToken) {
  console.log('🗺️ Initializing Mapbox with token:', ENV.mapboxToken.substring(0, 20) + '...');
  Mapbox.setAccessToken(ENV.mapboxToken);
} else {
  console.error('❌ Mapbox token is missing!');
}

interface MapViewComponentProps {
  location: Location.LocationObject | null;
}

export const MapViewComponent: React.FC<MapViewComponentProps> = ({ location }) => {
  const mapRef = useRef<MapboxMapView>(null);
  const cameraRef = useRef<Camera>(null);
  const [hasInitiallyFocused, setHasInitiallyFocused] = useState(false);
  const [lastCenterTime, setLastCenterTime] = useState(0);
  const [previousLocation, setPreviousLocation] = useState<Location.LocationObject | null>(null);
  const [isFollowingUser, setIsFollowingUser] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  
  // Get sector data from store
  const { sectors: storeSectors } = useSectorStore();

  // Convert store sectors to GeoJSON features for routes
  const sectorGeoJSON = useMemo(() => {
    const features: any[] = [];
    
    storeSectors.forEach(sector => {
      // Only include routes that have valid curved paths (3+ points)
      if (sector.routeCoordinates && sector.routeCoordinates.length > 2) {
        // Convert [lng, lat] to GeoJSON LineString
        const coordinates = sector.routeCoordinates.map(([lng, lat]) => [lng, lat]);
        
        features.push({
          type: 'Feature' as const,
          id: sector.id,
          properties: {
            name: sector.name,
            route: sector.route,
            speedLimit: sector.speedLimit,
            distance: sector.distance,
            startKm: sector.startPoint.km || 0,
            endKm: sector.endPoint.km || 0,
            direction: parseInt(sector.id) % 2 === 0 || sector.name.includes('посока 1') ? 'dir1' : 'dir2',
          },
          geometry: {
            type: 'LineString' as const,
            coordinates: coordinates,
          },
        });
      }
    });
    
    return {
      type: 'FeatureCollection' as const,
      features: features,
    };
  }, [storeSectors]);
  
  // Calculate distance between two points
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };
  
  // Update location on the map and handle automatic centering
  useEffect(() => {
    if (!location || !mapReady) return;
      
      const currentTime = Date.now();
      let shouldCenter = !hasInitiallyFocused;
      
      // Check if user is moving and should auto-center
      if (hasInitiallyFocused && previousLocation && isFollowingUser) {
        const distance = calculateDistance(
          previousLocation.coords.latitude,
          previousLocation.coords.longitude,
          location.coords.latitude,
          location.coords.longitude
        );
        
        const timeSinceLastCenter = currentTime - lastCenterTime;
      const isMoving = distance > 5; // 5 meters
      const shouldAutoCenter = isMoving && timeSinceLastCenter > 1000; // 1 second
        
        if (shouldAutoCenter) {
          shouldCenter = true;
          setLastCenterTime(currentTime);
        }
      }
      
    if (shouldCenter && cameraRef.current) {
      cameraRef.current.setCamera({
        centerCoordinate: [location.coords.longitude, location.coords.latitude],
        zoomLevel: hasInitiallyFocused ? 16 : 15,
        animationDuration: isFollowingUser ? 500 : 1500,
      });
      
      if (!hasInitiallyFocused) {
        setHasInitiallyFocused(true);
        setLastCenterTime(currentTime);
      }
      }
      
      setPreviousLocation(location);
  }, [location, mapReady, hasInitiallyFocused, previousLocation, isFollowingUser, lastCenterTime]);

  // Center on user location manually
  const centerOnUserLocation = useCallback(() => {
    if (!location || !cameraRef.current) return;
    
    cameraRef.current.setCamera({
      centerCoordinate: [location.coords.longitude, location.coords.latitude],
      zoomLevel: 15,
      animationDuration: 1500,
    });
    setIsFollowingUser(true);
  }, [location]);

  // Toggle follow mode
  const toggleFollowMode = useCallback(() => {
    setIsFollowingUser(prev => !prev);
    if (!isFollowingUser && location && cameraRef.current) {
      centerOnUserLocation();
    }
  }, [isFollowingUser, location, centerOnUserLocation]);

  // Handle map press to disable following
  const handleMapPress = useCallback(() => {
    setIsFollowingUser(false);
  }, []);

  // Get route color by route name
  const getRouteColor = (routeName: string): string => {
    const colors: Record<string, string> = {
      'АМ "Тракия"': '#ff6b6b',
      'АМ "Хемус"': '#4ecdc4',
      'АМ "Струма"': '#45b7d1',
      'Северна тангента': '#f7b731',
      'Път I-1': '#5f27cd',
      'Път I-2': '#fd79a8',
      'Път I-3': '#a29bfe',
      'Път I-4': '#ffeaa7',
      'Бул. България': '#ff9ff3',
      'Бул. Европа': '#ff6b9d',
      'Цариградско шосе': '#ffaa00',
      'Тест': '#00ff88',
    };
    return colors[routeName] || '#ffaa00';
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Navigation color="#00ff88" size={16} />
        <Text style={styles.title}>Карта на секторите</Text>
      </View>
      
      <MapboxMapView
        ref={mapRef}
        style={styles.map}
        styleURL="mapbox://styles/mapbox/dark-v11"
        onDidFinishLoadingMap={() => {
          console.log('✅ Map loaded successfully');
          setMapReady(true);
        }}
        onDidFailLoadingMap={(error) => {
          console.error('❌ Map failed to load:', error);
        }}
        onPress={handleMapPress}
        logoEnabled={false}
        attributionEnabled={true}
        attributionPosition={{ bottom: 8, right: 8 }}
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: [25.4858, 42.7339],
            zoomLevel: 7,
          }}
        />

        {/* Sector routes */}
        {sectorGeoJSON.features.length > 0 && (
          <ShapeSource id="sectors" shape={sectorGeoJSON}>
            <LineLayer
              id="sectors-line"
              style={{
                lineColor: [
                'case',
                ['==', ['get', 'route'], 'АМ "Тракия"'], '#ff6b6b',
                ['==', ['get', 'route'], 'АМ "Хемус"'], '#4ecdc4',
                ['==', ['get', 'route'], 'АМ "Струма"'], '#45b7d1',
                ['==', ['get', 'route'], 'Северна тангента'], '#f7b731',
                ['==', ['get', 'route'], 'Път I-1'], '#5f27cd',
                ['==', ['get', 'route'], 'Път I-2'], '#fd79a8',
                ['==', ['get', 'route'], 'Път I-3'], '#a29bfe',
                ['==', ['get', 'route'], 'Път I-4'], '#ffeaa7',
                ['==', ['get', 'route'], 'Бул. България'], '#ff9ff3',
                ['==', ['get', 'route'], 'Бул. Европа'], '#ff6b9d',
                ['==', ['get', 'route'], 'Цариградско шосе'], '#ffaa00',
                ['==', ['get', 'route'], 'Тест'], '#00ff88',
                  '#ffaa00',
                ],
                lineWidth: 4,
                lineOpacity: 0.8,
                lineJoin: 'round',
                lineCap: 'round',
              }}
            />
          </ShapeSource>
        )}

        {/* Sector start/end markers */}
        {storeSectors.map((sector) => {
          if (!sector.routeCoordinates || sector.routeCoordinates.length < 2) return null;

  return (
            <View key={`sector-${sector.id}`}>
              <PointAnnotation
                id={`start-${sector.id}`}
                coordinate={[sector.startPoint.lng, sector.startPoint.lat]}
              >
                <View style={[styles.marker, { backgroundColor: '#ffaa00' }]} />
              </PointAnnotation>
              <PointAnnotation
                id={`end-${sector.id}`}
                coordinate={[sector.endPoint.lng, sector.endPoint.lat]}
              >
                <View style={[styles.marker, { backgroundColor: '#ff6600' }]} />
              </PointAnnotation>
      </View>
          );
        })}

        {/* User location marker */}
        {location && (
          <PointAnnotation
            id="user-location"
            coordinate={[location.coords.longitude, location.coords.latitude]}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.userMarker} />
          </PointAnnotation>
        )}
      </MapboxMapView>

      {/* Center and Follow buttons */}
      {location && (
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.followButton, { backgroundColor: isFollowingUser ? '#00ff88' : '#666' }]} 
            onPress={toggleFollowMode}
            activeOpacity={0.8}
          >
            <Navigation color="#fff" size={18} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.centerButton} 
            onPress={centerOnUserLocation}
            activeOpacity={0.8}
          >
            <MapPin color="#fff" size={20} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#00ff88' }]} />
          <Text style={styles.legendText}>Вашето местоположение</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#ffaa00' }]} />
          <Text style={styles.legendText}>Начало на сектор</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1a2a1a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    paddingBottom: 6,
    backgroundColor: '#1a2a1a',
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  map: {
    flex: 1,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 12,
    paddingTop: 8,
    backgroundColor: '#1a2a1a',
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    color: '#888',
    fontSize: 10,
    fontWeight: '500',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 80,
    right: 16,
    flexDirection: 'column',
    gap: 12,
  },
  followButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  centerButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#00ff88',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  marker: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#fff',
  },
  userMarker: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#00ff88',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    ...Platform.select({
      ios: {
        shadowOpacity: 0.3,
      },
      android: {
        elevation: 4,
      },
    }),
  },
});
