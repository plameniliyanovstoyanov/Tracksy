import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,

  TouchableOpacity,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { X, AlertTriangle, TrendingDown, TrendingUp, Navigation } from 'lucide-react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface SpeedMonitorData {
  sectorName: string;
  speedLimit: number;
  currentSpeed: number;
  averageSpeed: number;
  timeInSector: number;
  distanceRemaining: number;
  recommendedSpeed: number | null;
  isOverSpeed: boolean;
  entryTime: number;
  speedReadings: number[];
}

interface SpeedMonitorOverlayProps {
  visible: boolean;
  onClose: () => void;
  data: SpeedMonitorData | null;
}



export const SpeedMonitorOverlay: React.FC<SpeedMonitorOverlayProps> = ({
  visible,
  onClose,
  data,
}) => {
  const insets = useSafeAreaInsets();
  const [slideAnim] = useState(new Animated.Value(-400));
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();

      // Pulse animation for warnings
      if (data?.isOverSpeed) {
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.05,
              duration: 500,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 500,
              useNativeDriver: true,
            }),
          ])
        ).start();
      }
    } else {
      Animated.timing(slideAnim, {
        toValue: -400,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, data?.isOverSpeed, slideAnim, pulseAnim]);

  if (!visible || !data) return null;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getSpeedColor = (): string => {
    const speedDiff = data.currentSpeed - data.speedLimit;
    
    // Червено - значително превишение (над +10 км/ч)
    if (speedDiff > 10) return '#FF3B30';
    
    // Оранжево/жълто - умерено превишение (+3 до +10 км/ч)
    if (speedDiff > 3) return '#FF9500';
    
    // Жълто - близо до лимита (0 до +3 км/ч)
    if (speedDiff > 0) return '#FFCC00';
    
    // Зелено - в рамките на лимита
    return '#34C759';
  };

  const getRecommendationText = (): string => {
    if (!data.recommendedSpeed) return '';
    
    if (data.recommendedSpeed < 0) {
      return 'Превишили сте средната скорост! Спрете или карайте много бавно!';
    }
    
    if (data.recommendedSpeed < data.currentSpeed - 10) {
      return `Намалете до ${data.recommendedSpeed.toFixed(0)} км/ч`;
    }
    
    if (data.recommendedSpeed > data.currentSpeed + 10) {
      return `Можете да увеличите до ${data.recommendedSpeed.toFixed(0)} км/ч`;
    }
    
    return `Препоръчителна скорост: ${data.recommendedSpeed.toFixed(0)} км/ч`;
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          paddingTop: insets.top + 10,
        },
      ]}
    >
      {Platform.OS === 'ios' ? (
        <BlurView intensity={95} tint="dark" style={styles.blurContainer}>
          <View style={styles.content}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={24} color="#FFF" />
            </TouchableOpacity>

            <View style={styles.header}>
              <Navigation size={20} color="#FFF" />
              <Text style={styles.sectorName}>{data.sectorName}</Text>
            </View>

            <Animated.View
              style={[
                styles.speedContainer,
                data.isOverSpeed && { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <Text style={[styles.currentSpeed, { color: getSpeedColor() }]}>
                {data.currentSpeed.toFixed(0)}
              </Text>
              <Text style={styles.speedUnit}>км/ч</Text>
            </Animated.View>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Ограничение</Text>
                <Text style={styles.statValue}>{data.speedLimit} км/ч</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Средна скорост</Text>
                <Text
                  style={[
                    styles.statValue,
                    data.averageSpeed > data.speedLimit && styles.warningText,
                  ]}
                >
                  {data.averageSpeed.toFixed(1)} км/ч
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Време</Text>
                <Text style={styles.statValue}>{formatTime(data.timeInSector)}</Text>
              </View>
            </View>

            {data.distanceRemaining > 0 && (
              <View style={styles.distanceContainer}>
                <Text style={styles.distanceLabel}>Остават</Text>
                <Text style={styles.distanceValue}>
                  {data.distanceRemaining < 1000
                    ? `${data.distanceRemaining.toFixed(0)} м`
                    : `${(data.distanceRemaining / 1000).toFixed(1)} км`}
                </Text>
              </View>
            )}

            {data.recommendedSpeed !== null && (
              <View
                style={[
                  styles.recommendationContainer,
                  data.isOverSpeed && styles.warningContainer,
                ]}
              >
                {data.isOverSpeed && <AlertTriangle size={20} color="#FF3B30" />}
                <Text
                  style={[
                    styles.recommendationText,
                    data.isOverSpeed && styles.warningText,
                  ]}
                >
                  {getRecommendationText()}
                </Text>
                {data.recommendedSpeed > data.currentSpeed ? (
                  <TrendingUp size={20} color="#34C759" />
                ) : data.recommendedSpeed < data.currentSpeed ? (
                  <TrendingDown size={20} color="#FF9500" />
                ) : null}
              </View>
            )}
          </View>
        </BlurView>
      ) : (
        <View style={[styles.blurContainer, styles.androidContainer]}>
          <View style={styles.content}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <X size={24} color="#FFF" />
            </TouchableOpacity>

            <View style={styles.header}>
              <Navigation size={20} color="#FFF" />
              <Text style={styles.sectorName}>{data.sectorName}</Text>
            </View>

            <Animated.View
              style={[
                styles.speedContainer,
                data.isOverSpeed && { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <Text style={[styles.currentSpeed, { color: getSpeedColor() }]}>
                {data.currentSpeed.toFixed(0)}
              </Text>
              <Text style={styles.speedUnit}>км/ч</Text>
            </Animated.View>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Ограничение</Text>
                <Text style={styles.statValue}>{data.speedLimit} км/ч</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Средна скорост</Text>
                <Text
                  style={[
                    styles.statValue,
                    data.averageSpeed > data.speedLimit && styles.warningText,
                  ]}
                >
                  {data.averageSpeed.toFixed(1)} км/ч
                </Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statLabel}>Време</Text>
                <Text style={styles.statValue}>{formatTime(data.timeInSector)}</Text>
              </View>
            </View>

            {data.distanceRemaining > 0 && (
              <View style={styles.distanceContainer}>
                <Text style={styles.distanceLabel}>Остават</Text>
                <Text style={styles.distanceValue}>
                  {data.distanceRemaining < 1000
                    ? `${data.distanceRemaining.toFixed(0)} м`
                    : `${(data.distanceRemaining / 1000).toFixed(1)} км`}
                </Text>
              </View>
            )}

            {data.recommendedSpeed !== null && (
              <View
                style={[
                  styles.recommendationContainer,
                  data.isOverSpeed && styles.warningContainer,
                ]}
              >
                {data.isOverSpeed && <AlertTriangle size={20} color="#FF3B30" />}
                <Text
                  style={[
                    styles.recommendationText,
                    data.isOverSpeed && styles.warningText,
                  ]}
                >
                  {getRecommendationText()}
                </Text>
                {data.recommendedSpeed > data.currentSpeed ? (
                  <TrendingUp size={20} color="#34C759" />
                ) : data.recommendedSpeed < data.currentSpeed ? (
                  <TrendingDown size={20} color="#FF9500" />
                ) : null}
              </View>
            )}
          </View>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    elevation: 1000,
  },
  blurContainer: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    overflow: 'hidden',
  },
  androidContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  content: {
    padding: 20,
    paddingTop: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 20,
    zIndex: 1,
    padding: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
    gap: 8,
  },
  sectorName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
    flex: 1,
  },
  speedContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    marginBottom: 20,
  },
  currentSpeed: {
    fontSize: 72,
    fontWeight: '700',
  },
  speedUnit: {
    fontSize: 24,
    color: '#999',
    marginLeft: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 15,
  },
  statItem: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  distanceContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'baseline',
    marginBottom: 15,
    gap: 8,
  },
  distanceLabel: {
    fontSize: 14,
    color: '#999',
  },
  distanceValue: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFF',
  },
  recommendationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  warningContainer: {
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
  },
  recommendationText: {
    flex: 1,
    fontSize: 14,
    color: '#FFF',
    textAlign: 'center',
  },
  warningText: {
    color: '#FF3B30',
  },
});