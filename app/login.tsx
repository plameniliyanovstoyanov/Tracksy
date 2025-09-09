import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  Animated,
  Dimensions,
} from 'react-native';
import { useAuth } from '@/stores/auth-store';
import { useRouter } from 'expo-router';
import { Mail, Chrome, Facebook, Zap } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

export default function LoginScreen() {
  const { signInWithGoogle, signInWithApple, signInWithFacebook, loading } = useAuth();
  const router = useRouter();
  
  // Animation values for light trails
  const trail1 = useRef(new Animated.Value(-width)).current;
  const trail2 = useRef(new Animated.Value(-width * 1.5)).current;
  const trail3 = useRef(new Animated.Value(-width * 0.5)).current;
  const trail4 = useRef(new Animated.Value(-width * 2)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    // Start light trail animations
    const createTrailAnimation = (trail: Animated.Value, duration: number, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(trail, {
            toValue: width * 2,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(trail, {
            toValue: -width,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
    };

    // Start all trail animations
    Animated.parallel([
      createTrailAnimation(trail1, 4000, 0),
      createTrailAnimation(trail2, 3500, 500),
      createTrailAnimation(trail3, 4500, 1000),
      createTrailAnimation(trail4, 3000, 1500),
      // Fade in content
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      // Scale in content
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

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
        <ActivityIndicator size="large" color="#00FF88" />
      </View>
    );
  }

  const renderLightTrail = (animValue: Animated.Value, index: number) => {
    const topPosition = 100 + (index * 150);
    const opacity = 0.3 + (index * 0.1);
    
    return (
      <Animated.View
        key={`trail-${index}`}
        style={[
          styles.lightTrail,
          {
            top: topPosition,
            transform: [{ translateX: animValue }],
            opacity,
          },
        ]}
      >
        <LinearGradient
          colors={['transparent', '#00FF88', '#00FF88', 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.gradientTrail}
        />
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Background with animated light trails */}
      <View style={styles.backgroundContainer}>
        {renderLightTrail(trail1, 0)}
        {renderLightTrail(trail2, 1)}
        {renderLightTrail(trail3, 2)}
        {renderLightTrail(trail4, 3)}
      </View>
      
      {/* Dark overlay gradient */}
      <LinearGradient
        colors={['rgba(15,15,15,0.95)', 'rgba(25,25,25,0.98)', 'rgba(15,15,15,1)']}
        style={styles.overlay}
      />

      <SafeAreaView style={styles.safeArea}>
        <Animated.View 
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Logo and Title */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Zap size={48} color="#00FF88" />
              <View style={styles.logoGlow} />
            </View>
            <Text style={styles.title}>SPEED TRACKER</Text>
            <Text style={styles.subtitle}>Влез в профила си за да продължиш</Text>
          </View>

          {/* Login Buttons */}
          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={styles.button}
              onPress={handleGoogleSignIn}
              disabled={loading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['rgba(0,255,136,0.1)', 'rgba(0,255,136,0.05)']}
                style={styles.buttonGradient}
              />
              <View style={styles.buttonContent}>
                <Chrome size={22} color="#00FF88" />
                <Text style={styles.buttonText}>Влез с Google</Text>
              </View>
            </TouchableOpacity>

            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={styles.button}
                onPress={handleAppleSignIn}
                disabled={loading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['rgba(0,255,136,0.1)', 'rgba(0,255,136,0.05)']}
                  style={styles.buttonGradient}
                />
                <View style={styles.buttonContent}>
                  <Mail size={22} color="#00FF88" />
                  <Text style={styles.buttonText}>Влез с Apple</Text>
                </View>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.button}
              onPress={handleFacebookSignIn}
              disabled={loading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['rgba(0,255,136,0.1)', 'rgba(0,255,136,0.05)']}
                style={styles.buttonGradient}
              />
              <View style={styles.buttonContent}>
                <Facebook size={22} color="#00FF88" />
                <Text style={styles.buttonText}>Влез с Facebook</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Bottom decoration */}
          <View style={styles.bottomDecoration}>
            <View style={styles.decorLine} />
            <Text style={styles.decorText}>SECURE LOGIN</Text>
            <View style={styles.decorLine} />
          </View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  backgroundContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  lightTrail: {
    position: 'absolute',
    width: width * 1.5,
    height: 3,
  },
  gradientTrail: {
    flex: 1,
    height: 3,
  },
  overlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  safeArea: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logoContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    position: 'relative',
  },
  logoGlow: {
    position: 'absolute',
    width: 120,
    height: 120,
    backgroundColor: '#00FF88',
    borderRadius: 60,
    opacity: 0.1,
  },
  title: {
    fontSize: 28,
    fontWeight: '900' as const,
    color: '#FFFFFF',
    letterSpacing: 3,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: '#888888',
    letterSpacing: 0.5,
  },
  buttonsContainer: {
    gap: 16,
    marginBottom: 40,
  },
  button: {
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,255,136,0.2)',
    overflow: 'hidden',
    backgroundColor: 'rgba(30,30,30,0.5)',
  },
  buttonGradient: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  buttonContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
    letterSpacing: 0.5,
  },
  bottomDecoration: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 20,
  },
  decorLine: {
    width: 40,
    height: 1,
    backgroundColor: 'rgba(0,255,136,0.3)',
  },
  decorText: {
    fontSize: 10,
    color: 'rgba(0,255,136,0.5)',
    letterSpacing: 2,
    fontWeight: '600' as const,
  },
});