import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Sector } from '@/data/sectors';
import { useSectorStore } from '@/stores/sector-store';

interface SectorInfoCardProps {
  sector: Sector;
}

export const SectorInfoCard: React.FC<SectorInfoCardProps> = ({ sector }) => {
  const { 
    sectorEntryTime, 
    currentSectorAverageSpeed,
    sectorProgress,
    sectorTotalDistance
  } = useSectorStore();
  
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
  
  // Calculate recommended speed to stay under limit
  const recommendedSpeed = Math.max(0, Math.min(sector.speedLimit - 5, sector.speedLimit * 0.9));
  
  // Determine colors based on average speed vs limit
  const isOverLimit = currentSectorAverageSpeed > sector.speedLimit;
  const averageSpeedColor = isOverLimit ? '#FF3B30' : '#34C759';
  const progressColor = isOverLimit ? '#FF3B30' : '#34C759';
  
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['rgba(42, 42, 42, 0.95)', 'rgba(26, 26, 26, 0.95)']}
        style={styles.gradient}
      >
        <View style={styles.content}>
          {/* Header row */}
          <View style={styles.headerRow}>
            <View style={styles.headerLeft}>
              <Text style={styles.sectorName}>{sector.name}</Text>
            </View>
            <View style={styles.headerRight}>
              <Text style={styles.limitLabel}>Ограничение</Text>
              <Text style={styles.limitValue}>{sector.speedLimit} км/ч</Text>
            </View>
          </View>
          
          {/* Middle row */}
          <View style={styles.middleRow}>
            <View style={styles.middleLeft}>
              <Text style={styles.label}>Средна за сектора</Text>
              <Text style={[styles.averageValue, { color: averageSpeedColor }]}>
                {currentSectorAverageSpeed.toFixed(0)} км/ч
              </Text>
            </View>
            <View style={styles.middleRight}>
              <Text style={styles.label}>Време</Text>
              <Text style={styles.timeValue}>{formatTime(timeInSector)}</Text>
            </View>
          </View>
          
          {/* Bottom left */}
          <View style={styles.bottomLeft}>
            <Text style={styles.label}>Оставащи км</Text>
            <Text style={styles.distanceValue}>{remainingDistance.toFixed(1)}</Text>
          </View>
          
          {/* Separator line */}
          <View style={styles.separator} />
          
          {/* Recommendation */}
          <View style={styles.recommendation}>
            <Text style={styles.recommendationText}>
              Препоръчителна ≤ {recommendedSpeed.toFixed(0)} км/ч
            </Text>
          </View>
          
          {/* Progress bar */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    width: `${progressPercentage}%`,
                    backgroundColor: progressColor
                  }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>{progressPercentage}%</Text>
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
    marginTop: 10,
  },
  gradient: {
    padding: 16,
  },
  content: {
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
  },
  sectorName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  limitLabel: {
    color: '#888',
    fontSize: 12,
    fontWeight: '500',
  },
  limitValue: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 2,
  },
  middleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  middleLeft: {
    flex: 1,
  },
  middleRight: {
    alignItems: 'flex-end',
  },
  bottomLeft: {
    alignSelf: 'flex-start',
  },
  label: {
    color: '#888',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 2,
  },
  value: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  averageValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  timeValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  distanceValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(136, 136, 136, 0.3)',
    marginVertical: 8,
  },
  recommendation: {
    alignItems: 'center',
  },
  recommendationText: {
    color: '#888',
    fontSize: 16,
    fontWeight: '500',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBar: {
    flex: 1,
    height: 12,
    backgroundColor: 'rgba(136, 136, 136, 0.3)',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
  },
  progressText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    minWidth: 50,
    textAlign: 'right',
  },
});