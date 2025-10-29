import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, trpcClient } from "@/lib/trpc";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSpeedStore } from "@/stores/speed-store";
import { useSectorStore } from "@/stores/sector-store";
import { useSettingsStore } from "@/stores/settings-store";
import { StyleSheet, Platform } from 'react-native';
import { AuthProvider, useAuth } from "@/stores/auth-store";
import { DeviceProvider } from "@/stores/device-store";
import { ViolationHistoryProvider } from "@/stores/violation-history-store";
import { validateEnv } from "@/utils/env";

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient();



function RootLayoutNav() {
  // const { isAuthenticated, loading } = useAuth();
  // const segments = useSegments();
  // const router = useRouter();

  // useEffect(() => {
  //   if (loading) return;

  //   const inAuthGroup = segments[0] === 'login';

  //   if (!isAuthenticated && !inAuthGroup) {
  //     // Redirect to login if not authenticated
  //     router.replace('/login');
  //   } else if (isAuthenticated && inAuthGroup) {
  //     // Redirect to tabs if authenticated and on login page
  //     router.replace('/(tabs)');
  //   }
  // }, [isAuthenticated, segments, loading, router]);

  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      {/* <Stack.Screen name="login" options={{ headerShown: false }} /> */}
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
  


  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Validate environment variables first
        const envValidation = validateEnv();
        if (!envValidation.valid) {
          console.error('⚠️ App started with missing environment variables:', envValidation.errors);
          console.error('Please ensure all required environment variables are set in .env file');
          // Don't show alert immediately as it blocks the UI - let the app load first
          // User will see errors in specific features when they try to use them
        } else {
          console.log('✅ All environment variables loaded successfully!');
        }
        
        // Load settings first
        await loadSettings();
        
        // Then load other data in parallel (without waiting for sector routes)
        await Promise.all([
          loadSpeedData(),
          // Load sector data but don't wait for routes to load
          loadSectorData().catch(err => console.error('Error loading sector data:', err)),
        ]);
        
        // Request permissions if needed
        if (Platform.OS !== 'web') {
          await requestNotificationPermissions();
        }
        
        // Check background tracking status
        await checkBackgroundTrackingStatus();
        

      } catch (error) {
        console.error('Failed to initialize app:', error);
      } finally {
        // Hide splash screen immediately after basic initialization
        await SplashScreen.hideAsync().catch(() => {});
        console.log('✅ Splash screen hidden, app is ready');
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

              </GestureHandlerRootView>
            </ViolationHistoryProvider>
          </DeviceProvider>
        </AuthProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}