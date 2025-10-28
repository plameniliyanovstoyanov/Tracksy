import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, trpcClient } from "@/lib/trpc";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSpeedStore } from "@/stores/speed-store";
import { useSectorStore } from "@/stores/sector-store";
import { useSettingsStore } from "@/stores/settings-store";
import { StyleSheet, Platform, Alert } from 'react-native';
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
        if (!envValidation.valid && Platform.OS !== 'web') {
          console.error('⚠️ App started with missing environment variables:', envValidation.errors);
          // Show alert to user (ALWAYS, even in production for debugging)
          Alert.alert(
            '⚠️ Configuration Error',
            `Missing environment variables:\n\n${envValidation.errors.join('\n')}\n\nPlease contact support if this persists.`,
            [{ text: 'OK' }]
          );
        } else if (envValidation.valid) {
          console.log('✅ All environment variables loaded successfully!');
        }
        
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

              </GestureHandlerRootView>
            </ViolationHistoryProvider>
          </DeviceProvider>
        </AuthProvider>
      </QueryClientProvider>
    </trpc.Provider>
  );
}