import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Clock, CheckCircle, XCircle, Gauge, MapPin, Calendar } from 'lucide-react-native';
import { useSectorStore } from '@/stores/sector-store';

export default function HistoryScreen() {
  const { sectorHistory } = useSectorStore();
  const insets = useSafeAreaInsets();

  const stats = useMemo(() => {
    const total = sectorHistory.length;
    const violations = sectorHistory.filter(entry => entry.exceeded).length;
    const compliant = total - violations;
    const violationRate = total > 0 ? (violations / total) * 100 : 0;
    
    return {
      total,
      violations,
      compliant,
      violationRate
    };
  }, [sectorHistory]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('bg-BG', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (duration: number) => {
    const minutes = Math.floor(duration / 60000);
    const seconds = Math.floor((duration % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const groupedHistory = useMemo(() => {
    const groups: { [key: string]: typeof sectorHistory } = {};
    
    sectorHistory.forEach(entry => {
      const date = new Date(entry.timestamp).toLocaleDateString('bg-BG');
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(entry);
    });
    
    return Object.entries(groups).sort(([a], [b]) => {
      return new Date(b.split('.').reverse().join('-')).getTime() - 
             new Date(a.split('.').reverse().join('-')).getTime();
    });
  }, [sectorHistory]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#0a0a0a', '#1a1a1a', '#2a2a2a']}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <Text style={styles.title}>История на секторите</Text>
          <Text style={styles.subtitle}>
            Преглед на всички минати сектори
          </Text>
        </View>

        {/* Statistics Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <LinearGradient
                colors={['#2a2a2a', '#1a1a1a']}
                style={styles.statGradient}
              >
                <Clock color="#00ff88" size={20} />
                <Text style={styles.statNumber}>{stats.total}</Text>
                <Text style={styles.statLabel}>Общо сектори</Text>
              </LinearGradient>
            </View>
            
            <View style={styles.statCard}>
              <LinearGradient
                colors={['#2a2a2a', '#1a1a1a']}
                style={styles.statGradient}
              >
                <CheckCircle color="#00ff88" size={20} />
                <Text style={styles.statNumber}>{stats.compliant}</Text>
                <Text style={styles.statLabel}>В норма</Text>
              </LinearGradient>
            </View>
          </View>
          
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <LinearGradient
                colors={['#2a2a2a', '#1a1a1a']}
                style={styles.statGradient}
              >
                <XCircle color="#ff4444" size={20} />
                <Text style={styles.statNumber}>{stats.violations}</Text>
                <Text style={styles.statLabel}>Нарушения</Text>
              </LinearGradient>
            </View>
            
            <View style={styles.statCard}>
              <LinearGradient
                colors={['#2a2a2a', '#1a1a1a']}
                style={styles.statGradient}
              >
                <Gauge color={stats.violationRate > 20 ? '#ff4444' : '#00ff88'} size={20} />
                <Text style={styles.statNumber}>{stats.violationRate.toFixed(1)}%</Text>
                <Text style={styles.statLabel}>Процент нарушения</Text>
              </LinearGradient>
            </View>
          </View>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {sectorHistory.length === 0 ? (
            <View style={styles.emptyState}>
              <Clock color="#888" size={48} />
              <Text style={styles.emptyTitle}>Няма история</Text>
              <Text style={styles.emptySubtitle}>
                Минете през някой сектор за да видите историята тук
              </Text>
            </View>
          ) : (
            groupedHistory.map(([date, entries]) => (
              <View key={date} style={styles.dateGroup}>
                <View style={styles.dateHeader}>
                  <Calendar color="#00ff88" size={16} />
                  <Text style={styles.dateTitle}>{date}</Text>
                  <Text style={styles.dateCount}>{entries.length} сектора</Text>
                </View>
                
                {entries.map((entry, index) => (
                  <TouchableOpacity key={index} style={styles.historyCard}>
                    <LinearGradient
                      colors={['#2a2a2a', '#1a1a1a']}
                      style={styles.cardGradient}
                    >
                      <View style={styles.cardHeader}>
                        <View style={styles.cardTitleRow}>
                          <Text style={styles.sectorName}>{entry.sectorName}</Text>
                          <View style={[
                            styles.statusBadge,
                            { backgroundColor: entry.exceeded ? '#ff4444' : '#00ff88' }
                          ]}>
                            {entry.exceeded ? (
                              <XCircle color="#fff" size={12} />
                            ) : (
                              <CheckCircle color="#fff" size={12} />
                            )}
                            <Text style={styles.statusText}>
                              {entry.exceeded ? 'Нарушение' : 'В норма'}
                            </Text>
                          </View>
                        </View>
                        
                        <Text style={styles.timestamp}>
                          {formatTime(entry.timestamp)}
                        </Text>
                      </View>
                      
                      <View style={styles.cardDetails}>
                        <View style={styles.detailRow}>
                          <View style={styles.detailItem}>
                            <Gauge color="#888" size={14} />
                            <Text style={styles.detailLabel}>Средна скорост:</Text>
                            <Text style={[
                              styles.detailValue,
                              { color: entry.exceeded ? '#ff4444' : '#00ff88' }
                            ]}>
                              {entry.averageSpeed.toFixed(1)} км/ч
                            </Text>
                          </View>
                        </View>
                        
                        <View style={styles.detailRow}>
                          <View style={styles.detailItem}>
                            <MapPin color="#888" size={14} />
                            <Text style={styles.detailLabel}>Ограничение:</Text>
                            <Text style={styles.detailValue}>
                              {entry.speedLimit} км/ч
                            </Text>
                          </View>
                        </View>
                        
                        <View style={styles.detailRow}>
                          <View style={styles.detailItem}>
                            <Clock color="#888" size={14} />
                            <Text style={styles.detailLabel}>Продължителност:</Text>
                            <Text style={styles.detailValue}>
                              {formatDuration(entry.duration)}
                            </Text>
                          </View>
                        </View>
                        
                        {entry.exceeded && (
                          <View style={styles.violationDetails}>
                            <Text style={styles.violationText}>
                              Превишение с {(entry.averageSpeed - entry.speedLimit).toFixed(1)} км/ч
                            </Text>
                          </View>
                        )}
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </View>
            ))
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
  statsContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  statGradient: {
    padding: 16,
    alignItems: 'center',
    gap: 4,
  },
  statNumber: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  emptyTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtitle: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  dateGroup: {
    marginBottom: 24,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  dateTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  dateCount: {
    color: '#888',
    fontSize: 12,
  },
  historyCard: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardGradient: {
    padding: 16,
  },
  cardHeader: {
    marginBottom: 12,
  },
  cardTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectorName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  timestamp: {
    color: '#888',
    fontSize: 12,
  },
  cardDetails: {
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  detailLabel: {
    color: '#888',
    fontSize: 12,
  },
  detailValue: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  violationDetails: {
    marginTop: 8,
    padding: 8,
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#ff4444',
  },
  violationText: {
    color: '#ff4444',
    fontSize: 12,
    fontWeight: '500',
  },
});