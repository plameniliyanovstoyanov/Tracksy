import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, trpcClient } from "@/lib/trpc";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSpeedStore } from "@/stores/speed-store";
import { useSectorStore } from "@/stores/sector-store";
import { useSettingsStore } from "@/stores/settings-store";
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SpeedMonitorOverlay } from "@/components/SpeedMonitorOverlay";
import { AppState, AppStateStatus, StyleSheet, Platform } from 'react-native';
import { AuthProvider, useAuth } from "@/stores/auth-store";
import { DeviceProvider } from "@/stores/device-store";
import { ViolationHistoryProvider } from "@/stores/violation-history-store";

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient();

// Configure notification handler
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

interface SpeedMonitorData {
  sectorName: string;
  speedLimit: number;
  currentSpeed: number;
  averageSpeed: number;
  timeInSector: number;
  distanceRemaining: number;
  recommendedSpeed: number | null;
  isOverSpeed: boolean;
  entryTime: number;
  speedReadings: number[];
}

function RootLayoutNav() {
  const { isAuthenticated, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'login';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to tabs if authenticated and on login page
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, segments, loading]);

  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="modal" options={{ presentation: "modal" }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default function RootLayout() {
  const loadSpeedData = useSpeedStore((state) => state.loadFromStorage);
  const loadSectorData = useSectorStore((state) => state.loadFromStorage);
  const loadSettings = useSettingsStore((state) => state.loadFromStorage);
  const requestNotificationPermissions = useSettingsStore((state) => state.requestNotificationPermissions);
  const checkBackgroundTrackingStatus = useSettingsStore((state) => state.checkBackgroundTrackingStatus);
  
  const [monitorVisible, setMonitorVisible] = useState(false);
  const [monitorData, setMonitorData] = useState<SpeedMonitorData | null>(null);
  const appState = useRef(AppState.currentState);
  const monitorInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadMonitorData = useCallback(async () => {
    try {
      const dataStr = await AsyncStorage.getItem('sector-monitor-data');
      if (dataStr) {
        const data = JSON.parse(dataStr) as SpeedMonitorData;
        setMonitorData(data);
        setMonitorVisible(true);
      }
    } catch (error) {
      console.error('Failed to load monitor data:', error);
    }
  }, []);

  const checkCurrentSector = useCallback(async () => {
    try {
      const currentSectorStr = await AsyncStorage.getItem('current-sector');
      if (currentSectorStr) {
        // We're in a sector, load and show monitor data
        await loadMonitorData();
      } else {
        // Not in a sector, hide monitor if visible
        setMonitorVisible(false);
      }
    } catch (error) {
      console.error('Failed to check current sector:', error);
    }
  }, [loadMonitorData]);

  // Handle notification interactions
  useEffect(() => {
    if (Platform.OS === 'web') return;
    
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
      const data = notification.request.content.data;
      
      if (data?.type === 'sector-entry' || data?.type === 'speed-warning') {
        // Load monitor data and show overlay
        loadMonitorData();
      }
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification clicked:', response);
      const data = response.notification.request.content.data;
      
      if (data?.type === 'sector-entry' || data?.type === 'speed-warning') {
        // Load monitor data and show overlay when notification is clicked
        loadMonitorData();
      }
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener);
      Notifications.removeNotificationSubscription(responseListener);
    };
  }, [loadMonitorData]);

  // Monitor app state and update overlay data
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App has come to foreground, check if we're in a sector
        checkCurrentSector();
      }
      appState.current = nextAppState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [checkCurrentSector]);

  // Update monitor data periodically when visible
  useEffect(() => {
    if (monitorVisible) {
      // Start updating monitor data every second
      monitorInterval.current = setInterval(() => {
        loadMonitorData();
      }, 1000);
    } else {
      // Clear interval when not visible
      if (monitorInterval.current) {
        clearInterval(monitorInterval.current);
        monitorInterval.current = null;
      }
    }

    return () => {
      if (monitorInterval.current) {
        clearInterval(monitorInterval.current);
      }
    };
  }, [monitorVisible, loadMonitorData]);

  const handleCloseMonitor = async () => {
    setMonitorVisible(false);
    // Clear monitor data from storage when closed
    await AsyncStorage.removeItem('sector-monitor-data');
  };

  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Load settings first
        await loadSettings();
        
        // Then load other data in parallel
        await Promise.all([
          loadSpeedData(),
          loadSectorData(),
        ]);
        
        // Request permissions if needed
        if (Platform.OS !== 'web') {
          await requestNotificationPermissions();
        }
        
        // Check background tracking status
        await checkBackgroundTrackingStatus();
        
        // Check if we're currently in a sector
        await checkCurrentSector();
      } catch (error) {
        console.error('Failed to initialize app:', error);
      } finally {
        await SplashScreen.hideAsync().catch(() => {});
      }
    };

    initializeApp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <DeviceProvider>
            <ViolationHistoryProvider>
              <GestureHandlerRootView style={styles.container}>
                <RootLayoutNav />
                <SpeedMonitorOverlay
                  visible={monitorVisible}
                  onClose={handleCloseMonitor}
                  data={monitorData}
                />
              </GestureHandlerRootView>
            </ViolationHistoryProvider>
          </DeviceProvider>
        </AuthProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}