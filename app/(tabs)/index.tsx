import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, Navigation, Clock, Smartphone } from 'lucide-react-native';
import * as Location from 'expo-location';
import { useSpeedStore } from '@/stores/speed-store';
import { useSectorStore } from '@/stores/sector-store';
import { useSettingsStore } from '@/stores/settings-store';
import { SpeedDisplay } from '@/components/SpeedDisplay';
import { SectorPanel } from '@/components/SectorPanel';
import { MapViewComponent } from '@/components/MapView';
import { BackgroundTrackingStatus } from '@/components/BackgroundTrackingStatus';
import { OfflineIndicator } from '@/components/OfflineIndicator';

export default function HomeScreen() {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  
  const { 
    currentSpeed, 
    averageSpeed, 
    updateSpeed, 
    startTracking, 
    stopTracking,
    isTracking 
  } = useSpeedStore();
  
  const { 
    currentSector, 
    checkSectorEntry, 
    checkSectorExit,
    updateSectorSpeed,
    updateSectorProgress,
    initializeNotifications
  } = useSectorStore();
  
  const {
    backgroundTrackingEnabled,
    backgroundTrackingActive,
    startBackgroundTracking,
    checkBackgroundTrackingStatus
  } = useSettingsStore();

  const handleLocationUpdate = useCallback((location: Location.LocationObject) => {
    setLocation(location);
    const speed = location.coords.speed ? location.coords.speed * 3.6 : 0;
    updateSpeed(speed);
    updateSectorSpeed(speed);
    updateSectorProgress(location.coords);
    checkSectorEntry(location.coords);
    checkSectorExit(location.coords);
  }, [updateSpeed, updateSectorSpeed, updateSectorProgress, checkSectorEntry, checkSectorExit]);

  useEffect(() => {
    (async () => {
      // Initialize notifications first
      await initializeNotifications();
      
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      // Check and start background tracking if enabled
      await checkBackgroundTrackingStatus();
      if (backgroundTrackingEnabled) {
        console.log('Starting background tracking...');
        await startBackgroundTracking();
      }

      startTracking();
      
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 500, // По-честа проверка - всеки 0.5 секунди
          distanceInterval: 1, // При всеки метър движение
        },
        handleLocationUpdate
      );

      return () => {
        subscription.remove();
        stopTracking();
      };
    })();
  }, [startTracking, stopTracking, handleLocationUpdate, initializeNotifications, backgroundTrackingEnabled, startBackgroundTracking, checkBackgroundTrackingStatus]);

  if (errorMsg) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.errorContainer}>
          <MapPin color="#ff4444" size={48} />
          <Text style={styles.errorText}>{errorMsg}</Text>
          <Text style={styles.errorSubtext}>
            Моля, разрешете достъп до местоположението за да работи приложението
          </Text>
        </View>
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
              <Navigation color="#00ff88" size={16} />
              <Text style={styles.statusText}>GPS</Text>
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
            {backgroundTrackingActive && (
              <View style={styles.statusItem}>
                <Smartphone color="#ff8800" size={16} />
                <Text style={[styles.statusText, { color: '#ff8800' }]}>BG</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.mapContainer}>
            <MapViewComponent location={location} />
          </View>
          
          <View style={styles.bottomSection}>
            <BackgroundTrackingStatus />
            
            <SpeedDisplay 
              currentSpeed={currentSpeed}
              averageSpeed={averageSpeed}
              isTracking={isTracking}
            />
            
            {currentSector && (
              <SectorPanel sector={currentSector} />
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
});