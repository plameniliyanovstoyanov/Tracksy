import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, trpcClient } from "@/lib/trpc";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState, ErrorInfo, ReactNode } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSpeedStore } from "@/stores/speed-store";
import { useSectorStore } from "@/stores/sector-store";
import { useSettingsStore } from "@/stores/settings-store";
import { StyleSheet, Platform, View, Text, ScrollView } from 'react-native';
import { AuthProvider, useAuth } from "@/stores/auth-store";
import { DeviceProvider } from "@/stores/device-store";
import { ViolationHistoryProvider } from "@/stores/violation-history-store";
import { validateEnv } from "@/utils/env";

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient();

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('💥 ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorBoundaryContainer}>
          <ScrollView contentContainerStyle={styles.errorBoundaryContent}>
            <Text style={styles.errorBoundaryTitle}>⚠️ Грешка в приложението</Text>
            <Text style={styles.errorBoundaryMessage}>
              {this.state.error?.message || 'Неочаквана грешка'}
            </Text>
            <Text style={styles.errorBoundaryStack}>
              {this.state.error?.stack}
            </Text>
            <Text style={styles.errorBoundaryHint}>
              Моля, рестартирайте приложението. Ако проблемът продължава, свържете се с поддръжката.
            </Text>
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}



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
    backgroundColor: '#0a0a0a',
  },
  loadingText: {
    color: '#fff',
    fontSize: 18,
    textAlign: 'center',
    marginTop: '50%',
  },
  errorContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorTitle: {
    color: '#ff4444',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    marginBottom: 16,
    textAlign: 'center',
  },
  errorHint: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
  },
  errorBoundaryContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  errorBoundaryContent: {
    padding: 20,
    paddingTop: 60,
  },
  errorBoundaryTitle: {
    color: '#ff4444',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  errorBoundaryMessage: {
    color: '#fff',
    fontSize: 18,
    marginBottom: 16,
  },
  errorBoundaryStack: {
    color: '#888',
    fontSize: 12,
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    marginBottom: 16,
  },
  errorBoundaryHint: {
    color: '#888',
    fontSize: 14,
    marginTop: 16,
  },
});

export default function RootLayout() {
  const loadSpeedData = useSpeedStore((state) => state.loadFromStorage);
  const loadSectorData = useSectorStore((state) => state.loadFromStorage);
  const loadSettings = useSettingsStore((state) => state.loadFromStorage);
  const requestNotificationPermissions = useSettingsStore((state) => state.requestNotificationPermissions);
  const checkBackgroundTrackingStatus = useSettingsStore((state) => state.checkBackgroundTrackingStatus);
  
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('🚀 Starting app initialization...');
        
        // Validate environment variables first
        const envValidation = validateEnv();
        if (!envValidation.valid) {
          const errorMsg = `Missing environment variables: ${envValidation.errors.join(', ')}`;
          console.error('⚠️', errorMsg);
          // Don't block the app, just log the error
          // The app should still work for basic features
        } else {
          console.log('✅ All environment variables loaded successfully!');
        }
        
        // Load settings first (with timeout)
        console.log('📱 Loading settings...');
        await Promise.race([
          loadSettings(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Settings load timeout')), 10000)
          )
        ]).catch(err => {
          console.warn('⚠️ Settings load failed or timed out:', err);
        });
        
        // Then load other data in parallel (without waiting for sector routes)
        console.log('📦 Loading app data...');
        await Promise.all([
          loadSpeedData().catch(err => {
            console.warn('⚠️ Speed data load failed:', err);
          }),
          loadSectorData().catch(err => {
            console.warn('⚠️ Sector data load failed:', err);
          }),
        ]);
        
        // Request permissions if needed (don't wait too long)
        if (Platform.OS !== 'web') {
          console.log('🔔 Requesting permissions...');
          requestNotificationPermissions().catch(err => {
            console.warn('⚠️ Permission request failed:', err);
          });
        }
        
        // Check background tracking status (optional, don't block)
        console.log('📍 Checking background tracking...');
        checkBackgroundTrackingStatus().catch(err => {
          console.warn('⚠️ Background tracking check failed:', err);
        });
        
        console.log('✅ App initialization completed');
        setIsReady(true);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error('💥 Failed to initialize app:', error);
        setInitializationError(errorMessage);
      } finally {
        // Always hide splash screen, even if there's an error
        await SplashScreen.hideAsync().catch(() => {});
        console.log('✅ Splash screen hidden');
      }
    };

    initializeApp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show error screen if initialization failed
  if (initializationError) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>⚠️ Грешка при стартиране</Text>
        <Text style={styles.errorText}>{initializationError}</Text>
        <Text style={styles.errorHint}>
          Моля, рестартирайте приложението. Ако проблемът продължава, проверете конзолата за повече детайли.
        </Text>
      </View>
    );
  }

  // Show loading screen briefly while initializing
  if (!isReady) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Зареждане...</Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
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
    </ErrorBoundary>
  );
}