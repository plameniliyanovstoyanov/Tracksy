import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, Navigation, Clock } from 'lucide-react-native';
import * as Location from 'expo-location';
import { useSpeedStore } from '@/stores/speed-store';
import { useSectorStore } from '@/stores/sector-store';
import { UnifiedSectorDisplay } from '@/components/UnifiedSectorDisplay';
import { MapViewComponent } from '@/components/MapView';
import { OfflineIndicator } from '@/components/OfflineIndicator';
import { useDevice } from '@/stores/device-store';

export default function HomeScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string>('Инициализиране...');
  const insets = useSafeAreaInsets();
  
  const { 
    currentSpeed, 
    averageSpeed,
    updateSpeed, 
    startTracking, 
    stopTracking
  } = useSpeedStore();
  
  const { 
    currentSector, 
    updateSectorSpeed,
    updateSectorProgress,
    initializeNotifications,
    checkSectorEntry,
    checkSectorExit,
    loadSectorRoutes
  } = useSectorStore();
  
  const { deviceId } = useDevice();

  const handleLocationUpdate = useCallback((location: Location.LocationObject) => {
    setLocation(location);
    let speed = location.coords.speed ? location.coords.speed * 3.6 : 0;
    
    if (speed < 3) {
      speed = 0;
    }
    
    updateSpeed(speed);
    
    checkSectorEntry(location.coords);
    checkSectorExit(location.coords, deviceId || undefined);
    
    if (currentSector) {
      updateSectorSpeed(speed);
      updateSectorProgress(location.coords);
    }
  }, [updateSpeed, updateSectorSpeed, updateSectorProgress, currentSector, checkSectorEntry, checkSectorExit, deviceId]);

  useEffect(() => {
    // Load routes on mount and reload periodically to ensure they're loaded
    loadSectorRoutes().catch(err => {
      console.error('Failed to load sector routes:', err);
      // Retry after 5 seconds if failed
      setTimeout(() => {
        loadSectorRoutes().catch(console.error);
      }, 5000);
    });
  }, [loadSectorRoutes]);

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    
    const initializeLocation = async () => {
      try {
        console.log('🚀 Initializing location services...');
        setGpsStatus('Инициализиране на известия...');
        
        // Check platform compatibility
        if (Platform.OS === 'web') {
          console.log('🌐 Running on web - using browser geolocation');
          setGpsStatus('Исползване на браузър GPS...');
          
          // For web, use browser geolocation API
          if (!navigator.geolocation) {
            setErrorMsg('GPS не се поддържа от браузъра');
            return;
          }
          
          // Request web geolocation
          navigator.geolocation.getCurrentPosition(
            (position) => {
              console.log('✅ Web geolocation success:', position.coords.latitude, position.coords.longitude);
              setGpsStatus(`GPS: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`);
              
              // Convert to Expo Location format
              const locationObject: Location.LocationObject = {
                coords: {
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                  altitude: position.coords.altitude,
                  accuracy: position.coords.accuracy,
                  altitudeAccuracy: position.coords.altitudeAccuracy,
                  heading: position.coords.heading,
                  speed: position.coords.speed,
                },
                timestamp: position.timestamp,
              };
              
              handleLocationUpdate(locationObject);
              
              // Start watching position for web
              const watchId = navigator.geolocation.watchPosition(
                (position) => {
                  const locationObject: Location.LocationObject = {
                    coords: {
                      latitude: position.coords.latitude,
                      longitude: position.coords.longitude,
                      altitude: position.coords.altitude,
                      accuracy: position.coords.accuracy,
                      altitudeAccuracy: position.coords.altitudeAccuracy,
                      heading: position.coords.heading,
                      speed: position.coords.speed,
                    },
                    timestamp: position.timestamp,
                  };
                  
                  setGpsStatus(`GPS: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`);
                  handleLocationUpdate(locationObject);
                },
                (error) => {
                  console.error('❌ Web geolocation error:', error);
                  setGpsStatus('GPS грешка');
                },
                {
                  enableHighAccuracy: true,
                  timeout: 10000,
                  maximumAge: 1000
                }
              );
              
              // Store watch ID for cleanup
              (subscription as any) = { remove: () => navigator.geolocation.clearWatch(watchId) };
            },
            (error) => {
              console.error('❌ Web geolocation error:', error);
              setGpsStatus('GPS грешка');
              setErrorMsg(`GPS грешка: ${error.message}`);
            },
            {
              enableHighAccuracy: true,
              timeout: 15000,
              maximumAge: 10000
            }
          );
          
          return; // Exit early for web
        }
        
        // Initialize notifications first (mobile only)
        await initializeNotifications();
        
        // Request foreground permissions
        console.log('📍 Requesting foreground location permissions...');
        setGpsStatus('Заявяване на разрешения...');
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.error('❌ Foreground location permission denied');
          setErrorMsg('Разрешението за достъп до местоположението е отказано');
          return;
        }
        console.log('✅ Foreground location permission granted');

        // Check if location services are enabled
        setGpsStatus('Проверка на GPS услуги...');
        const isEnabled = await Location.hasServicesEnabledAsync();
        if (!isEnabled) {
          console.error('❌ Location services are disabled');
          setErrorMsg('GPS услугите са изключени. Моля, включете ги от настройките.');
          return;
        }
        console.log('✅ Location services are enabled');

        // Get current location first to test GPS
        console.log('🎯 Getting current location...');
        setGpsStatus('Получаване на GPS позиция...');
        try {
          const currentLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.BestForNavigation,
          });
          console.log('✅ Got current location:', currentLocation.coords.latitude, currentLocation.coords.longitude);
          setGpsStatus('GPS активен');
          handleLocationUpdate(currentLocation);
        } catch (locationError) {
          console.error('❌ Failed to get current location:', locationError);
          setGpsStatus('GPS грешка');
          setErrorMsg('Не може да се получи GPS сигнал. Моля, проверете дали сте на открито.');
          return;
        }

        startTracking();
        
        console.log('👀 Starting location watching...');
        setGpsStatus('Стартиране на проследяване...');
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            timeInterval: 1000, // Every 1 second
            distanceInterval: 5, // Every 5 meters
            mayShowUserSettingsDialog: true,
          },
          (location) => {
            console.log('📍 Location update:', location.coords.latitude, location.coords.longitude, 'Speed:', location.coords.speed);
            setGpsStatus(`GPS: ${location.coords.latitude.toFixed(6)}, ${location.coords.longitude.toFixed(6)}`);
            handleLocationUpdate(location);
          }
        );
        console.log('✅ Location watching started successfully');
        
      } catch (error) {
        console.error('💥 Error initializing location:', error);
        setGpsStatus('GPS грешка');
        setErrorMsg('Грешка при инициализиране на GPS. Моля, рестартирайте приложението.');
      }
    };

    initializeLocation();

    return () => {
      if (subscription) {
        console.log('🛑 Stopping location subscription');
        subscription.remove();
      }
      stopTracking();
    };
  }, [startTracking, stopTracking, handleLocationUpdate, initializeNotifications]);

  if (errorMsg) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={['#0a0a0a', '#1a1a1a', '#2a2a2a']}
          style={styles.gradient}
        >
          <View style={styles.errorContainer}>
            <MapPin color="#ff4444" size={48} />
            <Text style={styles.errorText}>GPS Проблем</Text>
            <Text style={styles.errorSubtext}>{errorMsg}</Text>
            <View style={styles.errorTips}>
              <Text style={styles.tipTitle}>Съвети за решаване:</Text>
              <Text style={styles.tipText}>• Проверете дали GPS-ът е включен</Text>
              <Text style={styles.tipText}>• Излезте на открито за по-добър сигнал</Text>
              <Text style={styles.tipText}>• Рестартирайте приложението</Text>
              <Text style={styles.tipText}>• Проверете разрешенията в настройките</Text>
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <OfflineIndicator />
      <LinearGradient
        colors={['#0a0a0a', '#1a1a1a', '#2a2a2a']}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <View style={styles.statusBar}>
            <View style={styles.statusItem}>
              <Navigation color={location ? "#00ff88" : "#ff4444"} size={16} />
              <Text style={[styles.statusText, { color: location ? "#00ff88" : "#ff4444" }]}>
                {gpsStatus}
              </Text>
            </View>
            <View style={styles.statusItem}>
              <Clock color="#00ff88" size={16} />
              <Text style={styles.statusText}>
                {new Date().toLocaleTimeString('bg-BG', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </Text>
            </View>

          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.mapContainer}>
            <MapViewComponent location={location} />
          </View>
          
          <View style={styles.bottomSection}>
            {currentSector ? (
              <UnifiedSectorDisplay sector={currentSector} />
            ) : (
              <View style={styles.noSectorContainer}>
                <Text style={styles.noSectorText}>Няма активен сектор</Text>
                <View style={styles.speedRow}>
                  <View style={styles.speedItem}>
                    <Text style={styles.speedLabel}>Текуща</Text>
                    <Text style={styles.currentSpeedOnly}>{currentSpeed.toFixed(0)} км/ч</Text>
                  </View>
                  <View style={styles.speedDivider} />
                  <View style={styles.speedItem}>
                    <Text style={styles.speedLabel}>Средна</Text>
                    <Text style={styles.averageSpeedOnly}>{averageSpeed.toFixed(0)} км/ч</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>
      </LinearGradient>
      

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  gradient: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  statusBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  mapContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  bottomSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 10,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    color: '#ff4444',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 16,
  },
  errorSubtext: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  errorTips: {
    marginTop: 24,
    padding: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  tipTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  tipText: {
    color: '#ccc',
    fontSize: 14,
    marginBottom: 4,
    lineHeight: 18,
  },
  noSectorContainer: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    marginTop: 16,
  },
  noSectorText: {
    color: '#888',
    fontSize: 14,
    marginBottom: 12,
  },
  speedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  speedItem: {
    alignItems: 'center',
  },
  speedLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  speedDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  currentSpeedOnly: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  averageSpeedOnly: {
    color: '#00ff88',
    fontSize: 32,
    fontWeight: 'bold',
  },
});