import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Smartphone, CheckCircle, AlertCircle } from 'lucide-react-native';
import { useSettingsStore } from '@/stores/settings-store';

export function BackgroundTrackingStatus() {
  const { backgroundTrackingEnabled, backgroundTrackingActive } = useSettingsStore();

  if (!backgroundTrackingEnabled) {
    return null;
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={backgroundTrackingActive ? ['#1a3d1a', '#0d2a0d'] : ['#3d1a1a', '#2a0d0d']}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <Smartphone 
              color={backgroundTrackingActive ? '#00ff88' : '#ff4444'} 
              size={16} 
            />
            {backgroundTrackingActive ? (
              <CheckCircle color="#00ff88" size={12} style={styles.statusIcon} />
            ) : (
              <AlertCircle color="#ff4444" size={12} style={styles.statusIcon} />
            )}
          </View>
          <Text style={[
            styles.text, 
            { color: backgroundTrackingActive ? '#00ff88' : '#ff4444' }
          ]}>
            Background режим {backgroundTrackingActive ? 'активен' : 'неактивен'}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 10,
    borderRadius: 8,
    overflow: 'hidden',
  },
  gradient: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconContainer: {
    position: 'relative',
  },
  statusIcon: {
    position: 'absolute',
    top: -2,
    right: -2,
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
  },
});