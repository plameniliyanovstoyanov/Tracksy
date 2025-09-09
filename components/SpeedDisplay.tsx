import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gauge, TrendingUp } from 'lucide-react-native';

interface SpeedDisplayProps {
  currentSpeed: number;
  averageSpeed: number;
  isTracking: boolean;
}

export const SpeedDisplay: React.FC<SpeedDisplayProps> = ({
  currentSpeed,
  averageSpeed,
  isTracking,
}) => {
  const getSpeedColor = (speed: number) => {
    if (speed < 50) return '#00ff88';
    if (speed < 90) return '#ffaa00';
    if (speed < 130) return '#ff6600';
    return '#ff4444';
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#2a2a2a', '#1a1a1a']}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <View style={styles.mainSpeed}>
            <Gauge color={getSpeedColor(currentSpeed)} size={20} />
            <Text style={[styles.speedValue, { color: getSpeedColor(currentSpeed) }]}>
              {currentSpeed.toFixed(0)}
            </Text>
            <Text style={styles.speedUnit}>км/ч</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.stats}>
            <View style={styles.statItem}>
              <TrendingUp color="#888" size={14} />
              <Text style={styles.statLabel}>Средна</Text>
              <Text style={styles.statValue}>{averageSpeed.toFixed(1)} км/ч</Text>
            </View>
            
            <View style={styles.statusIndicator}>
              <View style={[
                styles.statusDot,
                { backgroundColor: isTracking ? '#00ff88' : '#ff4444' }
              ]} />
              <Text style={styles.statusText}>
                {isTracking ? 'Проследяване' : 'Спряно'}
              </Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  gradient: {
    padding: 12,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mainSpeed: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  speedValue: {
    fontSize: 36,
    fontWeight: 'bold',
    lineHeight: 36,
  },
  speedUnit: {
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
  },
  divider: {
    width: 1,
    height: 40,
    backgroundColor: '#333',
    marginHorizontal: 16,
  },
  stats: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  statItem: {
    alignItems: 'center',
    gap: 2,
  },
  statLabel: {
    color: '#888',
    fontSize: 10,
    fontWeight: '500',
  },
  statValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    color: '#888',
    fontSize: 11,
    fontWeight: '500',
  },
});