import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/stores/auth-store';

function extractTokensFromUrl(url: string): { access_token?: string; refresh_token?: string } {
  try {
    // В Supabase мобилен flow токените обикновено са в hash частта (#access_token=...)
    // но може да са и в query (?access_token=...)
    const hashIndex = url.indexOf('#');
    const queryIndex = url.indexOf('?');

    let fragment = '';
    if (hashIndex !== -1) {
      fragment = url.substring(hashIndex + 1);
    } else if (queryIndex !== -1) {
      fragment = url.substring(queryIndex + 1);
    }

    if (!fragment) {
      console.log('⚠️ No hash/query fragment in URL:', url);
      return {};
    }

    const params = new URLSearchParams(fragment);
    const access_token = params.get('access_token') || undefined;
    const refresh_token = params.get('refresh_token') || undefined;

    console.log('📋 Extracted tokens from URL fragment:', {
      hasAccessToken: !!access_token,
      hasRefreshToken: !!refresh_token,
    });

    return { access_token, refresh_token };
  } catch (e) {
    console.error('❌ Failed to extract tokens from URL:', e);
    return {};
  }
}

/**
 * Единствен OAuth callback екран:
 * - чете URL-а, извлича токените
 * - setSession в Supabase
 * - (по желание) обновява локалния store
 * - навигира към /(tabs) или /login
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const { loading } = useAuth();

  useEffect(() => {
    const run = async () => {
      try {
        console.log('🔗 auth/callback mounted');

        const url = await Linking.getInitialURL();
        console.log('🔗 callback URL:', url);

        if (!url) {
          console.log('❌ No URL in callback, redirecting to /login');
          router.replace('/login');
          return;
        }

        const { access_token, refresh_token } = extractTokensFromUrl(url);

        if (!access_token || !refresh_token) {
          console.log('❌ No tokens in URL, redirecting to /login');
          router.replace('/login');
          return;
        }

        console.log('✅ Tokens extracted, calling supabase.auth.setSession...');

        const { data: { session }, error } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (error || !session) {
          console.log('❌ Error setting session in supabase:', error);
          router.replace('/login');
          return;
        }

        console.log('✅ Session set successfully in callback, navigating to tabs...');
        router.replace('/(tabs)');
      } catch (e) {
        console.error('❌ auth/callback error:', e);
        router.replace('/login');
      }
    };

    run();
  }, [router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#00FF88" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
  },
});
