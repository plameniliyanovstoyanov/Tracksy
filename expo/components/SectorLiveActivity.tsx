import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { MapPin, Clock, Gauge } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sector } from '@/data/sectors';

interface SectorLiveActivityProps {
  visible: boolean;
  sector: Sector | null;
  currentSpeed: number;
  averageSpeed: number;
  timeInSector: number;
  progress: number; // 0 to 1
  isOverSpeed: boolean;
  willExceedLimit: boolean;
}



export const SectorLiveActivity: React.FC<SectorLiveActivityProps> = ({
  visible,
  sector,
  currentSpeed,
  averageSpeed,
  timeInSector,
  progress,
  isOverSpeed,
  willExceedLimit,
}) => {
  const insets = useSafeAreaInsets();
  const [slideAnim] = useState(new Animated.Value(200));
  const [pulseAnim] = useState(new Animated.Value(1));
  const [progressAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (visible && sector) {
      // Slide up animation
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();

      // Pulse animation for warnings
      if (isOverSpeed || willExceedLimit) {
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, {
              toValue: 1.05,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(pulseAnim, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
          ])
        ).start();
      } else {
        pulseAnim.setValue(1);
      }
    } else {
      // Slide down animation
      Animated.timing(slideAnim, {
        toValue: 200,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, sector, isOverSpeed, willExceedLimit, slideAnim, pulseAnim]);

  useEffect(() => {
    // Animate progress
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  if (!visible || !sector) return null;

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusColor = (): string => {
    if (isOverSpeed) return '#FF3B30'; // Red
    if (willExceedLimit) return '#FF9500'; // Orange
    return '#34C759'; // Green
  };

  const getStatusText = (): string => {
    if (isOverSpeed) return 'Превишавате лимита!';
    if (willExceedLimit) return 'Внимание - ще превишите!';
    return 'Всичко е наред';
  };

  const progressPercentage = Math.round(progress * 100);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }, { scale: pulseAnim }],
          bottom: insets.bottom + 20,
        },
      ]}
    >
      {Platform.OS === 'ios' ? (
        <BlurView intensity={95} tint="systemMaterialDark" style={styles.blurContainer}>
          <View style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <MapPin size={16} color="#FFF" />
                <Text style={styles.sectorName}>{sector.name}</Text>
              </View>
              <Text style={styles.speedLimit}>{sector.speedLimit} км/ч</Text>
            </View>

            {/* Main content */}
            <View style={styles.mainContent}>
              {/* Progress circle */}
              <View style={styles.progressContainer}>
                <View style={styles.progressCircle}>
                  {/* Background circle */}
                  <View style={styles.progressBackground} />
                  
                  {/* Progress arc */}
                  <View style={styles.progressArcContainer}>
                    <Animated.View
                      style={[
                        styles.progressArc,
                        {
                          borderTopColor: getStatusColor(),
                          transform: [
                            { rotate: '-90deg' },
                            {
                              rotate: progressAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0deg', `${360 * progress}deg`],
                              }),
                            },
                          ],
                        },
                      ]}
                    />
                  </View>
                  
                  {/* Time in center */}
                  <View style={styles.timeContainer}>
                    <Text style={styles.timeText}>{formatTime(timeInSector)}</Text>
                    <Text style={styles.timeLabel}>време</Text>
                  </View>
                </View>
              </View>

              {/* Stats */}
              <View style={styles.stats}>
                <View style={styles.statItem}>
                  <Gauge size={14} color={getStatusColor()} />
                  <Text style={styles.statLabel}>Текуща</Text>
                  <Text style={[styles.statValue, { color: getStatusColor() }]}>
                    {currentSpeed.toFixed(0)}
                  </Text>
                  <Text style={styles.statUnit}>км/ч</Text>
                </View>

                <View style={styles.statItem}>
                  <Clock size={14} color={averageSpeed > sector.speedLimit ? '#FF3B30' : '#34C759'} />
                  <Text style={styles.statLabel}>Средна</Text>
                  <Text style={[
                    styles.statValue,
                    { color: averageSpeed > sector.speedLimit ? '#FF3B30' : '#34C759' }
                  ]}>
                    {averageSpeed.toFixed(1)}
                  </Text>
                  <Text style={styles.statUnit}>км/ч</Text>
                </View>
              </View>
            </View>

            {/* Status */}
            <View style={[styles.statusContainer, { backgroundColor: `${getStatusColor()}20` }]}>
              <Text style={[styles.statusText, { color: getStatusColor() }]}>
                {getStatusText()}
              </Text>
              <Text style={styles.progressText}>{progressPercentage}% изминати</Text>
            </View>
          </View>
        </BlurView>
      ) : (
        <View style={[styles.blurContainer, styles.androidContainer]}>
          <View style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerLeft}>
                <MapPin size={16} color="#FFF" />
                <Text style={styles.sectorName}>{sector.name}</Text>
              </View>
              <Text style={styles.speedLimit}>{sector.speedLimit} км/ч</Text>
            </View>

            {/* Main content */}
            <View style={styles.mainContent}>
              {/* Progress circle */}
              <View style={styles.progressContainer}>
                <View style={styles.progressCircle}>
                  {/* Background circle */}
                  <View style={styles.progressBackground} />
                  
                  {/* Progress arc */}
                  <View style={styles.progressArcContainer}>
                    <Animated.View
                      style={[
                        styles.progressArc,
                        {
                          borderTopColor: getStatusColor(),
                          transform: [
                            { rotate: '-90deg' },
                            {
                              rotate: progressAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: ['0deg', `${360 * progress}deg`],
                              }),
                            },
                          ],
                        },
                      ]}
                    />
                  </View>
                  
                  {/* Time in center */}
                  <View style={styles.timeContainer}>
                    <Text style={styles.timeText}>{formatTime(timeInSector)}</Text>
                    <Text style={styles.timeLabel}>време</Text>
                  </View>
                </View>
              </View>

              {/* Stats */}
              <View style={styles.stats}>
                <View style={styles.statItem}>
                  <Gauge size={14} color={getStatusColor()} />
                  <Text style={styles.statLabel}>Текуща</Text>
                  <Text style={[styles.statValue, { color: getStatusColor() }]}>
                    {currentSpeed.toFixed(0)}
                  </Text>
                  <Text style={styles.statUnit}>км/ч</Text>
                </View>

                <View style={styles.statItem}>
                  <Clock size={14} color={averageSpeed > sector.speedLimit ? '#FF3B30' : '#34C759'} />
                  <Text style={styles.statLabel}>Средна</Text>
                  <Text style={[
                    styles.statValue,
                    { color: averageSpeed > sector.speedLimit ? '#FF3B30' : '#34C759' }
                  ]}>
                    {averageSpeed.toFixed(1)}
                  </Text>
                  <Text style={styles.statUnit}>км/ч</Text>
                </View>
              </View>
            </View>

            {/* Status */}
            <View style={[styles.statusContainer, { backgroundColor: `${getStatusColor()}20` }]}>
              <Text style={[styles.statusText, { color: getStatusColor() }]}>
                {getStatusText()}
              </Text>
              <Text style={styles.progressText}>{progressPercentage}% изминати</Text>
            </View>
          </View>
        </View>
      )}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 999,
    elevation: 999,
  },
  blurContainer: {
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  androidContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sectorName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    flex: 1,
  },
  speedLimit: {
    fontSize: 14,
    fontWeight: '500',
    color: '#999',
  },
  mainContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    marginBottom: 16,
  },
  progressContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCircle: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  progressBackground: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  progressArcContainer: {
    position: 'absolute',
    width: 80,
    height: 80,
  },
  progressArc: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: 'transparent',
    borderTopColor: '#34C759',
  },
  timeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  timeLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: '#999',
    marginTop: 2,
  },
  stats: {
    flex: 1,
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#999',
    minWidth: 50,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    minWidth: 35,
    textAlign: 'right',
  },
  statUnit: {
    fontSize: 12,
    fontWeight: '500',
    color: '#999',
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#999',
  },
});