import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { trpc, trpcClient } from "@/lib/trpc";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as React from "react";
import { useEffect, useState } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useSpeedStore } from "@/stores/speed-store";
import { useSectorStore } from "@/stores/sector-store";
import { useSettingsStore } from "@/stores/settings-store";
import { StyleSheet, Platform, View, Text, ScrollView } from 'react-native';
import { AuthProvider, useAuth } from "@/stores/auth-store";
import { DeviceProvider } from "@/stores/device-store";
import { ViolationHistoryProvider } from "@/stores/violation-history-store";
import { validateEnv } from "@/utils/env";
import * as Notifications from 'expo-notifications';

// КРИТИЧНО: Настройка за foreground нотификации - иначе в app-foreground няма звук
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient();

// Error Boundary Component
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('💥 ErrorBoundary caught an error:', error, errorInfo);
  }

  render(): ReactNode {
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
    let isMounted = true;
    let timeoutId: NodeJS.Timeout;
    let initComplete = false;
    
    // CRITICAL: Always show app after maximum 3 seconds, no matter what
    const FORCE_SHOW_TIME = 3000; // 3 seconds max wait
    
    // Force show after timeout - this is critical for production
    timeoutId = setTimeout(() => {
      if (isMounted && !initComplete) {
        initComplete = true;
        setIsReady(true);
        SplashScreen.hideAsync().catch(() => {});
      }
    }, FORCE_SHOW_TIME);
    
    const initializeApp = async () => {
      try {
        // Validate environment variables (non-blocking)
        try {
          validateEnv();
        } catch (error) {
          // Silent fail - we have fallbacks
        }
        
        // Fire and forget - don't wait for anything
        Promise.allSettled([
          loadSettings().catch(() => {}),
          loadSpeedData().catch(() => {}),
          loadSectorData().catch(() => {}),
        ]).catch(() => {});
        
        // Fire and forget permissions
        if (Platform.OS !== 'web') {
          requestNotificationPermissions().catch(() => {});
          checkBackgroundTrackingStatus().catch(() => {});
        }
        
        // Mark as ready immediately - don't wait for anything
        if (isMounted && !initComplete) {
          initComplete = true;
          clearTimeout(timeoutId);
          setIsReady(true);
          await SplashScreen.hideAsync().catch(() => {});
        }

      } catch (error) {
        // Silent fail - always show app
        if (isMounted && !initComplete) {
          initComplete = true;
          clearTimeout(timeoutId);
          setIsReady(true);
          await SplashScreen.hideAsync().catch(() => {});
        }
      }
    };

    // Start initialization but don't wait
    initializeApp();
    
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
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

  // Show loading screen very briefly - but always show app quickly
  // Maximum 3 seconds wait enforced by timeout in useEffect
  if (!isReady) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Зареждане...</Text>
      </View>
    );
  }

  // CRITICAL: Wrap everything in try-catch to prevent white screen
  // If anything fails, at least show error screen
  try {
    return (
      <ErrorBoundary>
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <DeviceProvider>
                <ViolationHistoryProvider>
                  <GestureHandlerRootView style={styles.container}>
                    <ErrorBoundary>
                      <RootLayoutNav />
                    </ErrorBoundary>
                  </GestureHandlerRootView>
                </ViolationHistoryProvider>
              </DeviceProvider>
            </AuthProvider>
          </QueryClientProvider>
        </trpc.Provider>
      </ErrorBoundary>
    );
  } catch (renderError) {
    // If rendering fails completely, show error screen instead of white screen
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>⚠️ Грешка при зареждане</Text>
        <Text style={styles.errorText}>
          Моля, рестартирайте приложението.
        </Text>
      </View>
    );
  }
}