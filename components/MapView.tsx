import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Navigation, MapPin } from 'lucide-react-native';
import * as Location from 'expo-location';
import { sectors } from '@/data/sectors';
import WebView from 'react-native-webview';
import { fetchSectorRoute } from '@/utils/mapbox-directions';

interface MapViewComponentProps {
  location: Location.LocationObject | null;
}

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || 'pk.eyJ1IjoicGxhbWVuc3RveWFub3YiLCJhIjoiY21mcGtzdTh6MGMwdTJqc2NqNjB3ZjZvcSJ9.mYM2IeJEeCJkeaR2TVd4BQ';

export const MapViewComponent: React.FC<MapViewComponentProps> = ({ location }) => {
  const webViewRef = useRef<WebView>(null);
  const [sectorRoutes, setSectorRoutes] = useState<Record<string, [number, number][]>>({});
  const [routesLoaded, setRoutesLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hasInitiallyFocused, setHasInitiallyFocused] = useState(false);
  const [lastCenterTime, setLastCenterTime] = useState(0);
  const [previousLocation, setPreviousLocation] = useState<Location.LocationObject | null>(null);
  const [isFollowingUser, setIsFollowingUser] = useState(true);

  // Load sector routes
  useEffect(() => {
    const loadRoutes = async () => {
      console.log('🚀 Starting to load sector routes...');
      const routes: Record<string, [number, number][]> = {};
      
      try {
        // Load routes for each sector with delay to avoid rate limiting
        for (let i = 0; i < sectors.length; i++) {
          const sector = sectors[i];
          console.log(`📍 Loading route ${i + 1}/${sectors.length} for: ${sector.name}`);
          console.log(`   Start: ${sector.startPoint.lat}, ${sector.startPoint.lng}`);
          console.log(`   End: ${sector.endPoint.lat}, ${sector.endPoint.lng}`);
          
          try {
            const route = await fetchSectorRoute(sector);
            if (route && route.length > 2) { // Only use routes with more than 2 points
              console.log(`✅ Route loaded for ${sector.name}: ${route.length} points`);
              routes[sector.id] = route;
            } else {
              console.log(`⚠️ No valid route data for ${sector.name}, skipping sector visualization`);
              // Don't add straight lines - skip this sector entirely
              // This will prevent showing incorrect straight lines
            }
          } catch (error) {
            console.log(`❌ Error loading route for ${sector.name}:`, error);
            // Don't add fallback straight lines
            console.log(`🚫 Skipping visualization for ${sector.name} due to route fetch error`);
          }
          
          // Add delay between requests to avoid rate limiting
          if (i < sectors.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // Increased delay
          }
        }
      } catch (error) {
        console.error('💥 Error in loadRoutes:', error);
        // Don't create fallback straight line routes
        // Better to show no route than incorrect straight lines
        console.log('🚫 Skipping fallback routes to avoid showing incorrect straight lines');
      }
      
      console.log('🎉 All routes processing complete!');
      console.log('📊 Routes summary:', Object.keys(routes).map(id => {
        const sector = sectors.find(s => s.id === id);
        return `${sector?.name}: ${routes[id].length} points`;
      }));
      
      setSectorRoutes(routes);
      setRoutesLoaded(true);
      setIsLoading(false);
    };
    
    loadRoutes().catch(error => {
      console.error('💥 Failed to load routes:', error);
      setIsLoading(false);
    });
  }, []);

  // Update location on the map and handle automatic centering
  useEffect(() => {
    if (location && webViewRef.current) {
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
        
        // More aggressive following: center if user moved more than 10 meters and 2 seconds passed
        const timeSinceLastCenter = currentTime - lastCenterTime;
        const isMoving = distance > 10; // 10 meters (reduced from 50)
        const shouldAutoCenter = isMoving && timeSinceLastCenter > 2000; // 2 seconds (reduced from 10)
        
        if (shouldAutoCenter) {
          shouldCenter = true;
          setLastCenterTime(currentTime);
          console.log('🚗 Auto-centering map - user is moving:', distance.toFixed(0), 'meters');
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
        console.log('🎯 Centering map on user location for the first time');
      }
      
      setPreviousLocation(location);
    }
  }, [location, hasInitiallyFocused, previousLocation, lastCenterTime, isFollowingUser]);

  // Update routes after map loads
  useEffect(() => {
    if (routesLoaded && Object.keys(sectorRoutes).length > 0 && webViewRef.current) {
      // Wait longer for the map to be fully loaded
      const timer = setTimeout(() => {
        const validRoutes = Object.keys(sectorRoutes).filter(key => 
          sectorRoutes[key] && sectorRoutes[key].length > 2
        );
        
        console.log(`🎯 Injecting ${validRoutes.length} valid sector routes into map...`);
        const updateScript = `
          console.log('📱 Received ${validRoutes.length} valid routes from React Native');
          if (window.updateSectorRoutes) {
            window.updateSectorRoutes(${JSON.stringify(sectorRoutes)});
            window.addSectorMarkers(${JSON.stringify(sectors)}, ${JSON.stringify(sectorRoutes)});
          } else {
            console.log('❌ updateSectorRoutes function not available yet');
            // Retry after a short delay
            setTimeout(() => {
              if (window.updateSectorRoutes) {
                window.updateSectorRoutes(${JSON.stringify(sectorRoutes)});
                window.addSectorMarkers(${JSON.stringify(sectors)}, ${JSON.stringify(sectorRoutes)});
              }
            }, 1000);
          }
          true;
        `;
        webViewRef.current?.injectJavaScript(updateScript);
      }, 3000); // Increased wait time
      
      return () => clearTimeout(timer);
    }
  }, [routesLoaded, sectorRoutes]);

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
      console.log('🎯 Manually centering map on user location');
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
    console.log('📍 User following mode:', !isFollowingUser ? 'enabled' : 'disabled');
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
                zoom: 15, // Slightly closer zoom for better following
                duration: isFollowing ? 1000 : 2000, // Faster animation when following
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

        // Disable following when user manually interacts with map
        let userInteractionTimeout;
        map.on('dragstart', () => {
          window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'userInteraction', action: 'dragstart' }));
        });
        
        map.on('zoomstart', () => {
          window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'userInteraction', action: 'zoomstart' }));
        });

        // Function to update sector routes
        window.updateSectorRoutes = function(routes) {
          console.log('🗺️ Updating sector routes on map:', Object.keys(routes));
          
          if (map.getSource('sectors')) {
            const sectorsData = ${JSON.stringify(sectors)};
            
            const features = sectorsData.map(sector => {
              const coordinates = routes[sector.id];
              console.log('📍 Sector ' + sector.name + ': ' + (coordinates ? coordinates.length : 0) + ' coordinates');
              
              // Only include sectors that have proper route data
              if (!coordinates || !Array.isArray(coordinates) || coordinates.length < 3) {
                console.log('⚠️ Insufficient coordinates for ' + sector.name + ', skipping sector visualization');
                return null; // Skip this sector entirely
              }
              
              // Filter out invalid coordinates
              const validCoordinates = coordinates.filter(coord => 
                Array.isArray(coord) && 
                coord.length === 2 && 
                typeof coord[0] === 'number' && 
                typeof coord[1] === 'number' &&
                !isNaN(coord[0]) && !isNaN(coord[1])
              );
              
              if (validCoordinates.length < 3) {
                console.log('⚠️ Not enough valid coordinates for ' + sector.name + ', skipping sector visualization');
                return null; // Skip this sector entirely
              }
              
              console.log('✅ Using ' + validCoordinates.length + ' coordinates for ' + sector.name);
              
              return {
                'type': 'Feature',
                'properties': {
                  'name': sector.name,
                  'route': sector.route,
                  'speedLimit': sector.speedLimit,
                  'distance': sector.distance,
                  'startKm': sector.startPoint.km || 0,
                  'endKm': sector.endPoint.km || 0
                },
                'geometry': {
                  'type': 'LineString',
                  'coordinates': validCoordinates
                }
              };
            }).filter(feature => feature !== null); // Remove null features
            
            console.log('🎯 Updating map with ' + features.length + ' sector features');
            
            map.getSource('sectors').setData({
              'type': 'FeatureCollection',
              'features': features
            });
            
            console.log('✅ Sector routes updated on map successfully');
          } else {
            console.log('❌ Map source "sectors" not found');
          }
        };
        
        // Function to add markers only for sectors with valid routes
        window.addSectorMarkers = function(sectorsData, routes) {
          console.log('🏷️ Adding markers for sectors with valid routes');
          
          sectorsData.forEach(sector => {
            const coordinates = routes[sector.id];
            
            // Only add markers for sectors that have valid route data
            if (coordinates && Array.isArray(coordinates) && coordinates.length >= 3) {
              // Start marker
              const startEl = document.createElement('div');
              startEl.style.width = '12px';
              startEl.style.height = '12px';
              startEl.style.borderRadius = '50%';
              startEl.style.backgroundColor = '#ffaa00';
              startEl.style.border = '2px solid white';
              
              new mapboxgl.Marker(startEl)
                .setLngLat([sector.startPoint.lng, sector.startPoint.lat])
                .setPopup(new mapboxgl.Popup({ offset: 25 })
                  .setHTML('<div><strong>Начало: ' + sector.startPoint.name + '</strong><br>' + 
                         sector.name + '<br>' +
                         (sector.startPoint.km ? 'км ' + sector.startPoint.km : '') + '</div>'))
                .addTo(map);
              
              // End marker
              const endEl = document.createElement('div');
              endEl.style.width = '12px';
              endEl.style.height = '12px';
              endEl.style.borderRadius = '50%';
              endEl.style.backgroundColor = '#ff6600';
              endEl.style.border = '2px solid white';
              
              new mapboxgl.Marker(endEl)
                .setLngLat([sector.endPoint.lng, sector.endPoint.lat])
                .setPopup(new mapboxgl.Popup({ offset: 25 })
                  .setHTML('<div><strong>Край: ' + sector.endPoint.name + '</strong><br>' + 
                         sector.name + '<br>' +
                         (sector.endPoint.km ? 'км ' + sector.endPoint.km : '') + '</div>'))
                .addTo(map);
              
              console.log('✅ Added markers for ' + sector.name);
            } else {
              console.log('⚠️ Skipping markers for ' + sector.name + ' (no valid route)');
            }
          });
        };

        map.on('load', () => {
          console.log('🗺️ Map loaded, initializing sectors...');
          // Add sectors data
          const sectorsData = ${JSON.stringify(sectors)};
          
          // Start with empty features - routes will be added when they load
          const initialFeatures = [];
          
          // Add source for sector lines with initial straight lines
          map.addSource('sectors', {
            'type': 'geojson',
            'data': {
              'type': 'FeatureCollection',
              'features': initialFeatures
            }
          });

          // Add layer for sector lines
          map.addLayer({
            'id': 'sectors-line',
            'type': 'line',
            'source': 'sectors',
            'layout': {
              'line-join': 'round',
              'line-cap': 'round'
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
          
          console.log('✅ Map initialization complete with ' + initialFeatures.length + ' sectors');
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
      
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Зареждане на маршрути...</Text>
          <Text style={styles.loadingSubtext}>Получаване на реални пътни данни от Mapbox</Text>
          <Text style={styles.loadingNote}>Секторите ще се покажат само ако има валидни маршрутни данни</Text>
        </View>
      ) : (
        <WebView
          ref={webViewRef}
          style={styles.map}
          source={{ html: mapHTML }}
          scrollEnabled={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          originWhitelist={['*']}
          mixedContentMode="compatibility"
          onLoadEnd={() => {
            console.log('🌐 WebView loaded');
          }}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === 'userInteraction') {
                console.log('👆 User interacted with map:', data.action);
                setIsFollowingUser(false); // Disable following when user interacts
              }
            } catch (error) {
              console.log('Error parsing WebView message:', error);
            }
          }}
        />
      )}

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