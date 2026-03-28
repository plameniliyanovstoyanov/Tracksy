import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, Clock, Gauge, TrendingUp, AlertTriangle } from 'lucide-react-native';
import { Sector } from '@/data/sectors';
import { useSectorStore } from '@/stores/sector-store';
import { useSpeedStore } from '@/stores/speed-store';

interface SectorPanelProps {
  sector: Sector;
}

// Floating notification bubble component
const FloatingNotification: React.FC<{ sector: Sector }> = ({ sector }) => {
  const { currentSpeed } = useSpeedStore();
  const { 
    currentSectorAverageSpeed,
    predictedAverageSpeed,
    willExceedLimit
  } = useSectorStore();
  
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(-100));
  
  useEffect(() => {
    // Show notification
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
    
    return () => {
      // Hide notification
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: -100,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    };
  }, [fadeAnim, slideAnim]);
  
  if (Platform.OS === 'web') {
    return null; // Don't show floating notification on web
  }
  
  return (
    <Animated.View 
      style={[
        styles.floatingNotification,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <LinearGradient
        colors={willExceedLimit ? ['#3a1a1a', '#2a1010'] : ['#1a1a1a', '#0a0a0a']}
        style={styles.floatingGradient}
      >
        <View style={styles.floatingHeader}>
          <Text style={styles.floatingTitle}>{sector.name}</Text>
          <Text style={styles.floatingSubtitle}>Лимит: {sector.speedLimit} км/ч</Text>
        </View>
        
        <View style={styles.floatingStats}>
          <View style={styles.floatingStatItem}>
            <Text style={styles.floatingStatLabel}>Текуща</Text>
            <Text style={styles.floatingStatValue}>{currentSpeed.toFixed(0)} км/ч</Text>
          </View>
          
          <View style={styles.floatingStatItem}>
            <Text style={styles.floatingStatLabel}>Средна</Text>
            <Text style={[
              styles.floatingStatValue,
              { color: currentSectorAverageSpeed > sector.speedLimit ? '#ff4444' : '#00ff88' }
            ]}>
              {currentSectorAverageSpeed.toFixed(1)} км/ч
            </Text>
          </View>
          
          <View style={styles.floatingStatItem}>
            <Text style={styles.floatingStatLabel}>Прогноза</Text>
            <Text style={[
              styles.floatingStatValue,
              { color: willExceedLimit ? '#ff4444' : '#ffaa00' }
            ]}>
              {predictedAverageSpeed.toFixed(1)} км/ч
            </Text>
          </View>
        </View>
        
        {willExceedLimit && (
          <View style={styles.floatingWarning}>
            <Text style={styles.floatingWarningText}>⚠️ Ще превишите лимита!</Text>
          </View>
        )}
      </LinearGradient>
    </Animated.View>
  );
};

export const SectorPanel: React.FC<SectorPanelProps> = ({ sector }) => {
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

  const isCurrentlyExceeded = currentSectorAverageSpeed > sector.speedLimit;
  const willExceed = willExceedLimit;

  return (
    <>
      <FloatingNotification sector={sector} />
      <Animated.View style={[styles.container, { transform: [{ scale: pulseAnim }] }]}>
        <LinearGradient
          colors={willExceed ? ['#3a1a1a', '#2a1010'] : isCurrentlyExceeded ? ['#3a2a1a', '#2a1810'] : ['#1a3a1a', '#102a10']}
          style={styles.gradient}
        >
        <View style={styles.header}>
          <View style={styles.titleRow}>
            <MapPin color="#fff" size={16} />
            <Text style={styles.sectorName}>{sector.name}</Text>
          </View>
          <Text style={styles.route}>{sector.route}</Text>
        </View>

        <View style={styles.stats}>
          <View style={styles.statItem}>
            <Gauge color={isCurrentlyExceeded ? '#ff4444' : '#00ff88'} size={16} />
            <Text style={styles.statLabel}>Текуща средна</Text>
            <Text style={[
              styles.statValue,
              { color: isCurrentlyExceeded ? '#ff4444' : '#00ff88' }
            ]}>
              {currentSectorAverageSpeed.toFixed(1)} км/ч
            </Text>
          </View>

          <View style={styles.statItem}>
            <TrendingUp color={willExceed ? '#ff4444' : '#ffaa00'} size={16} />
            <Text style={styles.statLabel}>Прогноза</Text>
            <Text style={[
              styles.statValue,
              { color: willExceed ? '#ff4444' : '#ffaa00' }
            ]}>
              {predictedAverageSpeed.toFixed(1)} км/ч
            </Text>
          </View>

          <View style={styles.statItem}>
            <Clock color="#888" size={16} />
            <Text style={styles.statLabel}>Време</Text>
            <Text style={styles.statValue}>
              {formatTime(timeInSector)}
            </Text>
          </View>
        </View>

        <View style={styles.limitRow}>
          <Text style={styles.limitLabel}>Лимит: {sector.speedLimit} км/ч</Text>
          <Text style={styles.distanceLabel}>Дължина: {sector.distance} км</Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  width: `${Math.min(100, sectorProgress * 100)}%`,
                  backgroundColor: isCurrentlyExceeded ? '#ff4444' : '#00ff88'
                }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            {Math.round(sectorProgress * 100)}% изминати
          </Text>
        </View>

        {/* Recommended speed if exceeding */}
        {recommendedSpeed !== null && isCurrentlyExceeded && (
          <View style={styles.recommendationBox}>
            <Text style={styles.recommendationLabel}>Препоръчителна скорост:</Text>
            <Text style={styles.recommendationValue}>
              ≤{recommendedSpeed.toFixed(0)} км/ч
            </Text>
            <Text style={styles.recommendationNote}>
              за да останете под лимита
            </Text>
          </View>
        )}

        {(willExceed || isCurrentlyExceeded) && (
          <View style={[styles.warning, !willExceed && styles.caution]}>
            <AlertTriangle color={willExceed ? "#ff4444" : "#ffaa00"} size={16} />
            <Text style={[styles.warningText, !willExceed && styles.cautionText]}>
              {willExceed 
                ? "Ако продължите така, ще превишите лимита!" 
                : "Текущо превишавате средната скорост"}
            </Text>
          </View>
        )}
        </LinearGradient>
      </Animated.View>
    </>
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
    marginBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  sectorName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  route: {
    color: '#888',
    fontSize: 12,
    fontWeight: '500',
  },
  stats: {
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
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  limitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  limitLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '500',
  },
  distanceLabel: {
    color: '#888',
    fontSize: 11,
    fontWeight: '500',
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
  progressContainer: {
    marginTop: 12,
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    color: '#888',
    fontSize: 10,
    fontWeight: '500',
    textAlign: 'center',
  },
  recommendationBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(255, 136, 0, 0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 136, 0, 0.3)',
    alignItems: 'center',
  },
  recommendationLabel: {
    color: '#ff8800',
    fontSize: 11,
    fontWeight: '500',
    marginBottom: 4,
  },
  recommendationValue: {
    color: '#ff8800',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  recommendationNote: {
    color: '#888',
    fontSize: 10,
    fontWeight: '500',
  },
  // Floating notification styles
  floatingNotification: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    zIndex: 1000,
    borderRadius: 12,
    overflow: 'hidden',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  floatingGradient: {
    padding: 12,
  },
  floatingHeader: {
    marginBottom: 8,
  },
  floatingTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  floatingSubtitle: {
    color: '#888',
    fontSize: 11,
    fontWeight: '500',
  },
  floatingStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  floatingStatItem: {
    alignItems: 'center',
    flex: 1,
  },
  floatingStatLabel: {
    color: '#888',
    fontSize: 9,
    fontWeight: '500',
  },
  floatingStatValue: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  floatingWarning: {
    marginTop: 8,
    padding: 6,
    backgroundColor: 'rgba(255, 68, 68, 0.2)',
    borderRadius: 4,
  },
  floatingWarningText: {
    color: '#ff4444',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
});