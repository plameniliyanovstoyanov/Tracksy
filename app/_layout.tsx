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
import { StyleSheet, Platform, View, Text, ScrollView, Linking } from 'react-native';
import { AuthProvider, useAuth } from "@/stores/auth-store";
import { DeviceProvider } from "@/stores/device-store";
import { ViolationHistoryProvider } from "@/stores/violation-history-store";
import { validateEnv } from "@/utils/env";
import * as Notifications from 'expo-notifications';
import { supabase } from "@/lib/supabase";
import * as WebBrowser from 'expo-web-browser';

// КРИТИЧНО: За Android да затваря таба след OAuth login
WebBrowser.maybeCompleteAuthSession();

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
  console.log('🔍 RootLayoutNav starting...');
  
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const loadSettings = useSettingsStore((state) => state.loadFromStorage);
  const segments = useSegments();
  const router = useRouter();
  
  console.log('🔍 RootLayoutNav rendered:', { isAuthenticated, hasUser: !!user, authLoading, segments });

  // Load settings from database when user is authenticated
  useEffect(() => {
      if (isAuthenticated && user?.id) {
        loadSettings(user.id).catch(err => {
          console.error('Failed to load settings:', err);
        });
      } else {
        // Load from local storage for anonymous users
        loadSettings().catch(err => {
          console.error('Failed to load settings:', err);
        });
      }
    }, [isAuthenticated, user?.id, loadSettings]);

    // Handle deep links for OAuth redirects
    const handleDeepLink = async (url: string): Promise<void> => {
      try {
      // Check if it's an OAuth redirect with tokens
      if (url.includes('access_token') || url.includes('refresh_token')) {
        console.log('✅ OAuth deep link detected, parsing tokens...');
        
        const urlObj = new URL(url);
        
        // Try hash first (most common)
        let params: URLSearchParams;
        if (urlObj.hash && urlObj.hash.length > 1) {
          const hash = urlObj.hash.substring(1);
          params = new URLSearchParams(hash);
          console.log('📋 Tokens in hash:', hash);
        } else if (urlObj.search && urlObj.search.length > 1) {
          params = new URLSearchParams(urlObj.search.substring(1));
          console.log('📋 Tokens in query:', urlObj.search);
        } else {
          // Try to get from path or fragment
          const fragment = url.split('#')[1] || url.split('?')[1];
          params = new URLSearchParams(fragment || '');
          console.log('📋 Tokens from fragment:', fragment);
        }
        
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');

        if (access_token && refresh_token) {
          console.log('✅ Tokens found in deep link, setting session...');
          const { data: { session }, error } = await supabase.auth.setSession({
            access_token,
            refresh_token,
          });
          
          if (error) {
            console.error('❌ Error setting session:', error);
            return;
          }
          
          // Session will be updated automatically via auth state listener in auth-store
          console.log('✅ Session set successfully from deep link!');
        } else {
          console.error('❌ No tokens found in deep link URL');
        }
      }
    } catch (error: any) {
      console.error('❌ Error handling deep link:', error.message);
    }
  };

  // Handle deep links for OAuth redirects
  useEffect(() => {
    // Handle initial URL (if app was opened via deep link)
    Linking.getInitialURL().then((url) => {
      if (url) {
        console.log('🔗 App opened with URL:', url);
        handleDeepLink(url);
      }
    });

    // Listen for deep links while app is running
    const subscription = Linking.addEventListener('url', (event) => {
      console.log('🔗 Deep link received:', event.url);
      handleDeepLink(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Auto-redirect based on auth state
  useEffect(() => {
    if (authLoading) {
      console.log('⏳ Auth still loading, waiting...');
      return;
    }

    const inAuthGroup = segments[0] === 'login';
    const inTabsGroup = segments[0] === '(tabs)';

    console.log('🔍 Auth state check:', { isAuthenticated, inAuthGroup, inTabsGroup, segments });

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to login if not authenticated and not already on login
      console.log('🔐 Not authenticated, redirecting to login...');
      router.replace('/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to tabs if authenticated and on login page
      console.log('✅ Authenticated, redirecting to tabs...');
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, segments, authLoading, router]);

  console.log('🔍 RootLayoutNav returning Stack navigator');
  
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
  console.log('🚀 RootLayout component starting...');
  
  const loadSpeedData = useSpeedStore((state) => state.loadFromStorage);
  const loadSectorData = useSectorStore((state) => state.loadFromStorage);
  const loadSettings = useSettingsStore((state) => state.loadFromStorage);
  const requestNotificationPermissions = useSettingsStore((state) => state.requestNotificationPermissions);
  const checkBackgroundTrackingStatus = useSettingsStore((state) => state.checkBackgroundTrackingStatus);
  
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  
  console.log('✅ RootLayout hooks initialized');

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
        // Settings will be loaded in SettingsLoader component after auth is ready
        Promise.allSettled([
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
  console.log('🔍 RootLayout rendering, isReady:', isReady);
  
  try {
    console.log('🔍 RootLayout attempting to render app structure');
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
    console.error('❌ RootLayout render error:', renderError);
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