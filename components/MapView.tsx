import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Navigation, MapPin } from 'lucide-react-native';
import * as Location from 'expo-location';
import { sectors } from '@/data/sectors';
import WebView from 'react-native-webview';
import { useSectorStore } from '@/stores/sector-store';

interface MapViewComponentProps {
  location: Location.LocationObject | null;
}

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || 'pk.eyJ1IjoicGxhbWVuc3RveWFub3YiLCJhIjoiY21mcGtzdTh6MGMwdTJqc2NqNjB3ZjZvcSJ9.mYM2IeJEeCJkeaR2TVd4BQ';

export const MapViewComponent: React.FC<MapViewComponentProps> = ({ location }) => {
  const webViewRef = useRef<WebView>(null);
  const [hasInitiallyFocused, setHasInitiallyFocused] = useState(false);
  const [lastCenterTime, setLastCenterTime] = useState(0);
  const [previousLocation, setPreviousLocation] = useState<Location.LocationObject | null>(null);
  const [isFollowingUser, setIsFollowingUser] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  
  // Get sector data from store
  const { sectors: storeSectors } = useSectorStore();

  // Convert store sectors to routes format - ONLY include sectors with valid routes (3+ points)
  // We don't show fallback straight lines anymore to avoid showing incorrect routes
  const sectorRoutes = useMemo(() => {
    const routes: Record<string, [number, number][]> = {};
    
    storeSectors.forEach(sector => {
      // Only include routes that have valid curved paths (3+ points)
      // Skip fallback straight lines (2 points) - we'll wait for real routes to load
      if (sector.routeCoordinates && sector.routeCoordinates.length > 2) {
        routes[sector.id] = sector.routeCoordinates;
      }
    });
    
    return routes;
  }, [storeSectors]);
  

  // Throttled location update ref
  const locationUpdateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Update location on the map and handle automatic centering
  useEffect(() => {
    if (!location || !webViewRef.current || !mapReady) return;
    
    // Clear existing timeout
    if (locationUpdateTimeoutRef.current) {
      clearTimeout(locationUpdateTimeoutRef.current);
    }
    
    // Throttle location updates with 250ms delay
    locationUpdateTimeoutRef.current = setTimeout(() => {
      if (!webViewRef.current || !location) return;
      
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
        
        // Very aggressive following: center if user moved more than 5 meters and 1 second passed
        const timeSinceLastCenter = currentTime - lastCenterTime;
        const isMoving = distance > 5; // 5 meters - very sensitive
        const shouldAutoCenter = isMoving && timeSinceLastCenter > 1000; // 1 second - very frequent
        
        if (shouldAutoCenter) {
          shouldCenter = true;
          setLastCenterTime(currentTime);
        }
      }
      
      const updateScript = `
        if (window.updateUserLocation) {
          window.updateUserLocation(${location.coords.longitude}, ${location.coords.latitude}, ${shouldCenter}, ${isFollowingUser});
        }
        true;
      `;
      webViewRef.current.injectJavaScript(updateScript);
      
      if (!hasInitiallyFocused) {
        setHasInitiallyFocused(true);
        setLastCenterTime(currentTime);
      }
      
      setPreviousLocation(location);
    }, 250);
    
    // Cleanup timeout on unmount or dependency change
    return () => {
      if (locationUpdateTimeoutRef.current) {
        clearTimeout(locationUpdateTimeoutRef.current);
      }
    };
  }, [location, hasInitiallyFocused, previousLocation, lastCenterTime, isFollowingUser, mapReady]);

  // Force center on user location when both map and location are ready
  useEffect(() => {
    if (location && mapReady && webViewRef.current && !hasInitiallyFocused) {
      const centerScript = `
        if (window.updateUserLocation) {
          window.updateUserLocation(${location.coords.longitude}, ${location.coords.latitude}, true, true);
        }
        true;
      `;
      webViewRef.current.injectJavaScript(centerScript);
      setHasInitiallyFocused(true);
      setLastCenterTime(Date.now());
    }
  }, [location, mapReady, hasInitiallyFocused]);

  // Debounced function to send routes to WebView
  const sendRoutesToWebDebouncedRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendRoutesToWeb = useCallback(() => {
    if (!webViewRef.current || !mapReady) return;
    
    // Clear existing timeout
    if (sendRoutesToWebDebouncedRef.current) {
      clearTimeout(sendRoutesToWebDebouncedRef.current);
    }
    
    // Debounce with 150ms delay
    sendRoutesToWebDebouncedRef.current = setTimeout(() => {
      if (!webViewRef.current) return;
      
      // Always send snapshot, even if empty - this clears old routes/markers
      const routeKeys = Object.keys(sectorRoutes);
      const filteredRoutes: Record<string, [number, number][]> = {};
      routeKeys.forEach(key => {
        filteredRoutes[key] = sectorRoutes[key];
      });
      
      const updateScript = `
        if (window.updateSectorRoutes) {
          try {
            window.updateSectorRoutes(${JSON.stringify(filteredRoutes)}, ${JSON.stringify(storeSectors)});
            window.addSectorMarkers(${JSON.stringify(storeSectors)}, ${JSON.stringify(filteredRoutes)});
          } catch (error) {
            // Error updating routes
          }
        }
        true;
      `;
      webViewRef.current.injectJavaScript(updateScript);
    }, 150);
  }, [mapReady, sectorRoutes, storeSectors]);

  // Update routes after map loads
  useEffect(() => {
    if (!mapReady || !webViewRef.current) return;
    
    sendRoutesToWeb();
    
    // Cleanup timeout on unmount
    return () => {
      if (sendRoutesToWebDebouncedRef.current) {
        clearTimeout(sendRoutesToWebDebouncedRef.current);
      }
    };
  }, [mapReady, sectorRoutes, sendRoutesToWeb]);

  // Function to calculate distance between two coordinates
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  };

  // Function to center map on user location
  const centerOnUserLocation = () => {
    if (location && webViewRef.current) {
      setLastCenterTime(Date.now()); // Reset auto-center timer
      setIsFollowingUser(true); // Re-enable following
      const centerScript = `
        if (window.centerOnUser) {
          window.centerOnUser();
        }
        true;
      `;
      webViewRef.current.injectJavaScript(centerScript);
    }
  };

  // Function to toggle user following mode
  const toggleFollowMode = () => {
    setIsFollowingUser(!isFollowingUser);
  };

  const mapHTML = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <script src='https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.js'></script>
      <link href='https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css' rel='stylesheet' />
      <style>
        body { margin: 0; padding: 0; }
        #map { position: absolute; top: 0; bottom: 0; width: 100%; }
        .mapboxgl-popup-content {
          background: #1a2a1a;
          color: #fff;
          padding: 10px;
          border-radius: 8px;
          font-size: 12px;
        }
        .mapboxgl-popup-anchor-bottom .mapboxgl-popup-tip {
          border-top-color: #1a2a1a;
        }
      </style>
    </head>
    <body>
      <div id='map'></div>
      <script>
        mapboxgl.accessToken = '${MAPBOX_TOKEN}';
        
        const map = new mapboxgl.Map({
          container: 'map',
          style: 'mapbox://styles/mapbox/dark-v11',
          center: [25.4858, 42.7339],
          zoom: 7,
          pitch: 0
        });

        let userMarker = null;
        
        // Function to update user location
        window.updateUserLocation = function(lng, lat, shouldCenter = false, isFollowing = true) {
          if (userMarker) {
            userMarker.setLngLat([lng, lat]);
            
            // Center map if requested (first time, manual center, or following mode)
            if (shouldCenter) {
              map.flyTo({
                center: [lng, lat],
                zoom: 16, // Closer zoom for better following
                duration: isFollowing ? 500 : 1500, // Much faster animation when following
                essential: true // Ensures animation completes even if interrupted
              });
            }
          } else {
            const el = document.createElement('div');
            el.style.width = '20px';
            el.style.height = '20px';
            el.style.borderRadius = '50%';
            el.style.backgroundColor = '#00ff88';
            el.style.border = '3px solid white';
            el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
            
            userMarker = new mapboxgl.Marker(el)
              .setLngLat([lng, lat])
              .addTo(map);
            
            // Always center map on user location when first added
            map.flyTo({
              center: [lng, lat],
              zoom: 15,
              duration: 2000
            });
          }
        };

        // Function to center on user location
        window.centerOnUser = function() {
          if (userMarker) {
            const lngLat = userMarker.getLngLat();
            map.flyTo({
              center: [lngLat.lng, lngLat.lat],
              zoom: 15,
              duration: 1500,
              essential: true
            });
          }
        };

        // Disable following when user manually interacts with map, but re-enable after timeout
        let userInteractionTimeout;
        
        const handleUserInteraction = (action) => {
          window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'userInteraction', action: action }));
          
          // Clear existing timeout
          if (userInteractionTimeout) {
            clearTimeout(userInteractionTimeout);
          }
          
          // Re-enable following after 10 seconds of no interaction
          userInteractionTimeout = setTimeout(() => {
            window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'reEnableFollowing' }));
          }, 10000);
        };
        
        map.on('dragstart', () => handleUserInteraction('dragstart'));
        map.on('zoomstart', () => handleUserInteraction('zoomstart'));

        // Function to update sector routes
        window.updateSectorRoutes = function(routes, sectorsData) {
          if (!map.getSource('sectors')) {
            return;
          }
          
          const features = sectorsData.map(sector => {
            const coordinates = routes[sector.id];
            
            if (!coordinates) {
              return null;
            }
            
            if (!Array.isArray(coordinates)) {
              return null;
            }
            
            if (coordinates.length < 2) {
              return null;
            }
              
            const validCoordinates = coordinates.filter(coord => 
              Array.isArray(coord) && 
              coord.length === 2 && 
              typeof coord[0] === 'number' && 
              typeof coord[1] === 'number' &&
              !isNaN(coord[0]) && !isNaN(coord[1])
            );
              
            if (validCoordinates.length < 2) {
              return null;
            }
              
            // Add direction property based on sector ID to help separate overlapping routes
            const isDirection1 = parseInt(sector.id) % 2 === 0 || sector.name.includes('посока 1');
            
            return {
              'type': 'Feature',
              'id': sector.id,
              'properties': {
                'name': sector.name,
                'route': sector.route,
                'speedLimit': sector.speedLimit,
                'distance': sector.distance,
                'startKm': sector.startPoint.km || 0,
                'endKm': sector.endPoint.km || 0,
                'direction': isDirection1 ? 'dir1' : 'dir2'  // Helper property for offset
              },
              'geometry': {
                'type': 'LineString',
                'coordinates': validCoordinates
              }
            };
          }).filter(feature => feature !== null); // Remove null features
          
          const geojsonData = {
            'type': 'FeatureCollection',
            'features': features.length > 0 ? features : []
          };
          
          map.getSource('sectors').setData(geojsonData);
        };
        
        // Registry to track markers and prevent duplicates
        const markersBySectorId = {};
        
        // Helper to create marker element
        const createMarkerEl = (color) => {
          const el = document.createElement('div');
          el.style.width = '12px';
          el.style.height = '12px';
          el.style.borderRadius = '50%';
          el.style.backgroundColor = color;
          el.style.border = '2px solid white';
          return el;
        };
        
        // Function to add markers for all sectors
        window.addSectorMarkers = function(sectorsData, routes) {
          // Remove old markers
          Object.values(markersBySectorId).forEach(m => {
            if (m.start) m.start.remove();
            if (m.end) m.end.remove();
          });
          Object.keys(markersBySectorId).forEach(k => delete markersBySectorId[k]);
          
          sectorsData.forEach(sector => {
            const coordinates = routes[sector.id];
            
            if (coordinates && Array.isArray(coordinates) && coordinates.length >= 2) {
              // Start marker
              const startMarker = new mapboxgl.Marker(createMarkerEl('#ffaa00'))
                .setLngLat([sector.startPoint.lng, sector.startPoint.lat])
                .setPopup(new mapboxgl.Popup({ offset: 25 })
                  .setHTML('<div><strong>Начало: ' + sector.startPoint.name + '</strong><br>' + 
                         sector.name + '<br>' +
                         (sector.startPoint.km ? 'км ' + sector.startPoint.km : '') + '</div>'))
                .addTo(map);
              
              // End marker
              const endMarker = new mapboxgl.Marker(createMarkerEl('#ff6600'))
                .setLngLat([sector.endPoint.lng, sector.endPoint.lat])
                .setPopup(new mapboxgl.Popup({ offset: 25 })
                  .setHTML('<div><strong>Край: ' + sector.endPoint.name + '</strong><br>' + 
                         sector.name + '<br>' +
                         (sector.endPoint.km ? 'км ' + sector.endPoint.km : '') + '</div>'))
                .addTo(map);
              
              markersBySectorId[sector.id] = { start: startMarker, end: endMarker };
            }
          });
        };

        map.on('load', () => {
          // Start with empty features - routes will be added when they load
          const initialFeatures = [];
          
          // Add source for sector lines with promoteId for stable feature IDs
          map.addSource('sectors', {
            'type': 'geojson',
            'promoteId': 'id',
            'data': {
              'type': 'FeatureCollection',
              'features': initialFeatures
            }
          });

          // Add layer for sector lines with offset to separate overlapping routes
          map.addLayer({
            'id': 'sectors-line',
            'type': 'line',
            'source': 'sectors',
            'layout': {
              'line-join': 'round',
              'line-cap': 'round',
              'line-offset': [
                // Offset lines based on direction to separate overlapping routes
                // For sectors with same start/end points but different directions
                'case',
                ['==', ['get', 'direction'], 'dir1'], 3,  // Direction 1: +3px offset (right side)
                -3  // Direction 2: -3px offset (left side)
              ]
            },
            'paint': {
              'line-color': [
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
                '#ffaa00'
              ],
              'line-width': 4,
              'line-opacity': 0.8
            }
          });

          // Add start and end markers only for sectors that will have routes
          // Markers will be added when routes are loaded to avoid showing markers for sectors without routes

          // Add click handler for sector info
          map.on('click', 'sectors-line', (e) => {
            const properties = e.features[0].properties;
            new mapboxgl.Popup()
              .setLngLat(e.lngLat)
              .setHTML('<div><strong>' + properties.name + '</strong><br>' +
                       'Маршрут: ' + properties.route + '<br>' +
                       'Дължина: ' + properties.distance + ' км<br>' +
                       'Лимит: ' + properties.speedLimit + ' км/ч<br>' +
                       (properties.startKm ? 'От км ' + properties.startKm + ' до км ' + properties.endKm : '') +
                       '</div>')
              .addTo(map);
          });

          // Change cursor on hover
          map.on('mouseenter', 'sectors-line', () => {
            map.getCanvas().style.cursor = 'pointer';
          });
          
          map.on('mouseleave', 'sectors-line', () => {
            map.getCanvas().style.cursor = '';
          });
          
          // Send mapReady message only after source/layer are guaranteed to exist
          window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'mapReady' }));
        });
      </script>
    </body>
    </html>
  `;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Navigation color="#00ff88" size={16} />
        <Text style={styles.title}>Карта на секторите</Text>
      </View>
      
      <WebView
          ref={webViewRef}
          style={styles.map}
          source={{ html: mapHTML }}
          scrollEnabled={true}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          originWhitelist={['*']}
          mixedContentMode="compatibility"
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === 'mapReady') {
                setMapReady(true);
                // Send full snapshot immediately when map is ready (handles WebView reload)
                sendRoutesToWeb();
                // Reset initial focus to enable auto-center on reload if needed
                setHasInitiallyFocused(false);
                return;
              }
              if (data.type === 'userInteraction') {
                setIsFollowingUser(false); // Disable following when user interacts
              } else if (data.type === 'reEnableFollowing') {
                setIsFollowingUser(true); // Re-enable following after timeout
              }
            } catch (error) {
              // Error parsing message
            }
          }}
        />

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
          <Text style={styles.legendText}>Сектори (само с валидни маршрути)</Text>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a2a1a',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  loadingSubtext: {
    color: '#888',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  loadingNote: {
    color: '#666',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
    fontStyle: 'italic',
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
});