import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useAuth } from '@/stores/auth-store';
import { useRouter } from 'expo-router';
import { Mail, Chrome, Facebook } from 'lucide-react-native';

export default function LoginScreen() {
  const { signInWithGoogle, signInWithApple, signInWithFacebook, loading } = useAuth();
  const router = useRouter();

  const handleGoogleSignIn = async () => {
    await signInWithGoogle();
    router.replace('/(tabs)');
  };

  const handleAppleSignIn = async () => {
    await signInWithApple();
    router.replace('/(tabs)');
  };

  const handleFacebookSignIn = async () => {
    await signInWithFacebook();
    router.replace('/(tabs)');
  };



  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Speed Tracker</Text>
          <Text style={styles.subtitle}>Влез в профила си</Text>
        </View>

        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={[styles.button, styles.googleButton]}
            onPress={handleGoogleSignIn}
            disabled={loading}
          >
            <Chrome size={24} color="#fff" />
            <Text style={styles.buttonText}>Влез с Google</Text>
          </TouchableOpacity>

          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={[styles.button, styles.appleButton]}
              onPress={handleAppleSignIn}
              disabled={loading}
            >
              <Mail size={24} color="#fff" />
              <Text style={styles.buttonText}>Влез с Apple</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.button, styles.facebookButton]}
            onPress={handleFacebookSignIn}
            disabled={loading}
          >
            <Facebook size={24} color="#fff" />
            <Text style={styles.buttonText}>Влез с Facebook</Text>
          </TouchableOpacity>
        </View>


      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 50,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold' as const,
    color: '#333',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#666',
  },
  buttonsContainer: {
    gap: 15,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  googleButton: {
    backgroundColor: '#4285F4',
  },
  appleButton: {
    backgroundColor: '#000',
  },
  facebookButton: {
    backgroundColor: '#1877F2',
  },

  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600' as const,
  },

});