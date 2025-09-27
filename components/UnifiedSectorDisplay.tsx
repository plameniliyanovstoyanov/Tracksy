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
  const { currentSpeed } = useSpeedStore();
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

  const remainingDistance = sectorTotalDistance * (1 - sectorProgress);
  const progressPercentage = Math.round(sectorProgress * 100);
  
  const isCurrentlyExceeded = currentSectorAverageSpeed > sector.speedLimit;
  const willExceed = willExceedLimit;

  // Color logic based on current state
  const getSpeedColor = () => {
    if (willExceed) return '#ff4444';
    if (isCurrentlyExceeded) return '#ff8800';
    return '#00ff88';
  };

  const getProgressColor = () => {
    if (willExceed) return '#ff4444';
    if (isCurrentlyExceeded) return '#ff8800';
    return '#00ff88';
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: pulseAnim }] }]}>
      <LinearGradient
        colors={willExceed ? ['#3a1a1a', '#2a1010'] : isCurrentlyExceeded ? ['#3a2a1a', '#2a1810'] : ['#1a3a1a', '#102a10']}
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
            <Text style={[styles.currentSpeedValue, { color: getSpeedColor() }]}>
              {currentSpeed.toFixed(0)}
            </Text>
            <Text style={styles.speedUnit}>км/ч</Text>
          </View>
          
          <View style={styles.averageSpeedDisplay}>
            <Text style={styles.averageLabel}>Средна</Text>
            <Text style={[styles.averageValue, { color: getSpeedColor() }]}>
              {currentSectorAverageSpeed.toFixed(1)} км/ч
            </Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <TrendingUp color={willExceed ? '#ff4444' : '#ffaa00'} size={14} />
            <Text style={styles.statLabel}>Прогноза</Text>
            <Text style={[
              styles.statValue,
              { color: willExceed ? '#ff4444' : '#ffaa00' }
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
              {remainingDistance.toFixed(1)}
            </Text>
          </View>
        </View>

        {/* Recommended speed section - from second component */}
        {recommendedSpeed !== null && (
          <View style={styles.recommendationContainer}>
            <Text style={styles.recommendationLabel}>
              Препоръчителна ≤ {recommendedSpeed.toFixed(0)} км/ч
            </Text>
          </View>
        )}

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

        {/* Warning section */}
        {(willExceed || isCurrentlyExceeded) && (
          <View style={[styles.warning, !willExceed && styles.caution]}>
            <AlertTriangle color={willExceed ? "#ff4444" : "#ffaa00"} size={16} />
            <Text style={[styles.warningText, !willExceed && styles.cautionText]}>
              {willExceed 
                ? "Ще превишите лимита!" 
                : "Превишавате лимита!"}
            </Text>
          </View>
        )}
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
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
  },
  recommendationLabel: {
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
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
});