import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, Clock, TrendingUp, AlertTriangle } from 'lucide-react-native';
import { Sector } from '@/data/sectors';
import { useSectorStore } from '@/stores/sector-store';
import { useSpeedStore } from '@/stores/speed-store';

interface UnifiedSectorDisplayProps {
  sector: Sector;
}

export const UnifiedSectorDisplay: React.FC<UnifiedSectorDisplayProps> = ({ sector }) => {
  const { currentSpeed, lastNonZeroSpeed } = useSpeedStore();
  const { 
    sectorEntryTime,
    currentSectorAverageSpeed,
    predictedAverageSpeed,
    willExceedLimit,
    sectorProgress,
    recommendedSpeed,
    sectorTotalDistance
  } = useSectorStore();
  
  const [pulseAnim] = useState(new Animated.Value(1));
  
  useEffect(() => {
    if (willExceedLimit) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    }
  }, [willExceedLimit, pulseAnim]);
  
  const timeInSector = sectorEntryTime 
    ? Math.floor((Date.now() - sectorEntryTime) / 1000)
    : 0;
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const remainingDistance = Math.max(0, sectorTotalDistance - (sectorTotalDistance * sectorProgress));
  const progressPercentage = Math.round(sectorProgress * 100);
  
  // Individual color logic for each speed metric
  const getCurrentSpeedColor = () => {
    const limit = sector.speedLimit;
    if (currentSpeed > limit) return '#ff4444'; // Red - over limit
    if (currentSpeed >= limit * 0.95) return '#ffaa00'; // Yellow - close to limit
    return '#00ff88'; // Green - safe
  };

  const getAverageSpeedColor = () => {
    const limit = sector.speedLimit;
    if (currentSectorAverageSpeed > limit) return '#ff4444'; // Red - over limit
    if (currentSectorAverageSpeed >= limit * 0.95) return '#ffaa00'; // Yellow - close to limit
    return '#00ff88'; // Green - safe
  };

  const getPredictedSpeedColor = () => {
    const limit = sector.speedLimit;
    if (predictedAverageSpeed > limit) return '#ff4444'; // Red - will exceed
    if (predictedAverageSpeed >= limit * 0.95) return '#ffaa00'; // Yellow - close to limit
    return '#00ff88'; // Green - safe
  };

  // Background color based on average speed
  const getBackgroundColors = (): [string, string] => {
    const avgColor = getAverageSpeedColor();
    if (avgColor === '#ff4444') return ['#3a1a1a', '#2a1010']; // Red background
    if (avgColor === '#ffaa00') return ['#3a2a1a', '#2a1810']; // Yellow background
    return ['#1a3a1a', '#102a10']; // Green background
  };

  const getProgressColor = () => {
    return getAverageSpeedColor();
  };

  // Use recommended speed from store
  const shouldShowRecommendation = recommendedSpeed !== null && recommendedSpeed > 0 && currentSectorAverageSpeed > sector.speedLimit;

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: pulseAnim }] }]}>
      <LinearGradient
        colors={getBackgroundColors()}
        style={styles.gradient}
      >
        {/* Header with sector name and limit */}
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <MapPin color="#fff" size={16} />
            <Text style={styles.sectorName}>{sector.name}</Text>
          </View>
          <View style={styles.limitContainer}>
            <Text style={styles.limitLabel}>Лимит: {sector.speedLimit} км/ч</Text>
          </View>
        </View>

        {/* Main speed display - like first component */}
        <View style={styles.mainSpeedContainer}>
          <View style={styles.currentSpeedDisplay}>
            <Text style={[styles.currentSpeedValue, { color: getCurrentSpeedColor() }]}>
              {Math.round(currentSpeed)}
            </Text>
            <Text style={styles.speedUnit}>км/ч</Text>
          </View>
          
          <View style={styles.averageSpeedDisplay}>
            <Text style={styles.averageLabel}>Средна</Text>
            <Text style={[styles.averageValue, { color: getAverageSpeedColor() }]}>
              {currentSectorAverageSpeed.toFixed(1)} км/ч
            </Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <TrendingUp color={getPredictedSpeedColor()} size={14} />
            <Text style={styles.statLabel}>Прогноза</Text>
            <Text style={[
              styles.statValue,
              { color: getPredictedSpeedColor() }
            ]}>
              {predictedAverageSpeed.toFixed(1)} км/ч
            </Text>
          </View>

          <View style={styles.statItem}>
            <Clock color="#888" size={14} />
            <Text style={styles.statLabel}>Време</Text>
            <Text style={styles.statValue}>
              {formatTime(timeInSector)}
            </Text>
          </View>

          <View style={styles.statItem}>
            <Text style={styles.statLabel}>Оставащи км</Text>
            <Text style={styles.statValue}>
              {(remainingDistance / 1000).toFixed(1)}
            </Text>
          </View>
        </View>

        {/* Recommended speed section */}
        {currentSectorAverageSpeed > sector.speedLimit ? (
          shouldShowRecommendation ? (
            <View style={styles.recommendationContainer}>
              <Text style={styles.recommendationLabel}>
                💡 Препоръчителна ≤ {recommendedSpeed} км/ч
              </Text>
              <Text style={styles.recommendationSubtext}>
                За да паднете под лимита
              </Text>
            </View>
          ) : (
            <View style={[styles.recommendationContainer, styles.impossibleContainer]}>
              <Text style={styles.impossibleLabel}>
                ⚠️ Няма как да паднете под лимита
              </Text>
              <Text style={styles.recommendationSubtext}>
                Твърде късно за корекция
              </Text>
            </View>
          )
        ) : currentSectorAverageSpeed > 0 ? (
          <View style={[styles.recommendationContainer, styles.okContainer]}>
            <Text style={styles.okLabel}>
              ✅ Всичко е наред - под лимита сте
            </Text>
          </View>
        ) : null}

        {/* Progress bar - from second component */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  width: `${Math.min(100, progressPercentage)}%`,
                  backgroundColor: getProgressColor()
                }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            {progressPercentage}%
          </Text>
        </View>


      </LinearGradient>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  gradient: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  sectorName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  limitContainer: {
    alignItems: 'flex-end',
  },
  limitLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  mainSpeedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  currentSpeedDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  currentSpeedValue: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  speedUnit: {
    fontSize: 16,
    color: '#888',
    marginLeft: 4,
  },
  averageSpeedDisplay: {
    alignItems: 'flex-end',
  },
  averageLabel: {
    color: '#888',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  averageValue: {
    fontSize: 20,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
    gap: 2,
    flex: 1,
  },
  statLabel: {
    color: '#888',
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  recommendationContainer: {
    alignItems: 'center',
    marginBottom: 12,
    padding: 10,
    backgroundColor: 'rgba(0, 170, 255, 0.15)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 170, 255, 0.3)',
  },
  recommendationLabel: {
    color: '#00aaff',
    fontSize: 15,
    fontWeight: '600',
  },
  recommendationSubtext: {
    color: '#888',
    fontSize: 11,
    fontWeight: '400',
    marginTop: 2,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    minWidth: 40,
    textAlign: 'right',
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    padding: 10,
    backgroundColor: 'rgba(255, 68, 68, 0.2)',
    borderRadius: 6,
  },
  warningText: {
    color: '#ff4444',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  caution: {
    backgroundColor: 'rgba(255, 170, 0, 0.2)',
  },
  cautionText: {
    color: '#ffaa00',
  },
  okContainer: {
    backgroundColor: 'rgba(0, 255, 136, 0.15)',
    borderColor: 'rgba(0, 255, 136, 0.3)',
  },
  okLabel: {
    color: '#00ff88',
    fontSize: 14,
    fontWeight: '600',
  },
  impossibleContainer: {
    backgroundColor: 'rgba(255, 68, 68, 0.15)',
    borderColor: 'rgba(255, 68, 68, 0.3)',
  },
  impossibleLabel: {
    color: '#ff4444',
    fontSize: 14,
    fontWeight: '600',
  },
});