import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MapPin, Gauge } from 'lucide-react-native';
import { sectors } from '@/data/sectors';
import { useSectorStore } from '@/stores/sector-store';

export default function SectorsScreen() {
  const { sectorHistory } = useSectorStore();
  const insets = useSafeAreaInsets();

  const formatDistance = (distance: number) => {
    return `${distance.toFixed(1)} км`;
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleString('bg-BG');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#0a0a0a', '#1a1a1a', '#2a2a2a']}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Сектори за средна скорост</Text>
          <Text style={styles.subtitle}>
            {sectors.length} активни сектора в България
          </Text>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Всички сектори</Text>
            {sectors.map((sector) => (
              <TouchableOpacity key={sector.id} style={styles.sectorCard}>
                <LinearGradient
                  colors={['#2a2a2a', '#1a1a1a']}
                  style={styles.cardGradient}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.sectorName}>{sector.name}</Text>
                    <View style={styles.speedLimit}>
                      <Gauge color="#00ff88" size={16} />
                      <Text style={styles.speedLimitText}>{sector.speedLimit} км/ч</Text>
                    </View>
                  </View>
                  
                  <View style={styles.cardDetails}>
                    <View style={styles.detailItem}>
                      <MapPin color="#888" size={14} />
                      <Text style={styles.detailText}>
                        {formatDistance(sector.distance)}
                      </Text>
                    </View>
                    <View style={styles.detailItem}>
                      <Text style={styles.routeText}>{sector.route}</Text>
                    </View>
                  </View>

                  <Text style={styles.description}>{sector.description}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>

          {sectorHistory.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>История</Text>
              {sectorHistory.slice(0, 10).map((entry, index) => (
                <View key={index} style={styles.historyCard}>
                  <LinearGradient
                    colors={['#2a2a2a', '#1a1a1a']}
                    style={styles.cardGradient}
                  >
                    <View style={styles.historyHeader}>
                      <Text style={styles.historyName}>{entry.sectorName}</Text>
                      <Text style={styles.historyTime}>
                        {formatTime(entry.timestamp)}
                      </Text>
                    </View>
                    
                    <View style={styles.historyDetails}>
                      <Text style={styles.historySpeed}>
                        Средна скорост: {entry.averageSpeed.toFixed(1)} км/ч
                      </Text>
                      <Text style={[
                        styles.historyStatus,
                        { color: entry.exceeded ? '#ff4444' : '#00ff88' }
                      ]}>
                        {entry.exceeded ? 'Превишена' : 'В норма'}
                      </Text>
                    </View>
                  </LinearGradient>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  gradient: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  sectorCard: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  historyCard: {
    marginBottom: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  cardGradient: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectorName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  speedLimit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#333',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  speedLimitText: {
    color: '#00ff88',
    fontSize: 12,
    fontWeight: '600',
  },
  cardDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 8,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    color: '#888',
    fontSize: 12,
  },
  routeText: {
    color: '#00ff88',
    fontSize: 12,
    fontWeight: '500',
  },
  description: {
    color: '#aaa',
    fontSize: 12,
    lineHeight: 16,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  historyTime: {
    color: '#888',
    fontSize: 11,
  },
  historyDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historySpeed: {
    color: '#aaa',
    fontSize: 12,
  },
  historyStatus: {
    fontSize: 12,
    fontWeight: '600',
  },
});