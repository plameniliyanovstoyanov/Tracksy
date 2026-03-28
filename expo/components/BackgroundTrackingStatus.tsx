import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Smartphone, CheckCircle, AlertCircle, Battery, Zap, Settings, AlertTriangle, Play, Square } from 'lucide-react-native';
import { useSettingsStore } from '@/stores/settings-store';
import { BackgroundLocationService } from '@/stores/location-service';
import { useBatteryOptimization } from '@/stores/battery-optimization';

// Добавяме warning цвят ако не съществува
const colors = {
  warning: '#ff9500',
  success: '#00ff88',
  error: '#ff4444',
  text: '#ffffff',
  textSecondary: '#cccccc',
  primary: '#007AFF',
  surface: '#1c1c1e',
};

export function BackgroundTrackingStatus() {
  const { backgroundTrackingEnabled, backgroundTrackingActive } = useSettingsStore();
  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasPermissions, setHasPermissions] = useState(false);
  const { 
    batteryLevel, 
    isLowPowerMode, 
    locationUpdateInterval, 
    initializeBatteryOptimization,
    requestBatteryOptimizationDisable,
    showBatteryOptimizationInstructions,
    requestAlwaysLocationPermission
  } = useBatteryOptimization();

  useEffect(() => {
    checkStatus();
    initializeBatteryOptimization();
    checkPermissions();
  }, []);

  const checkStatus = async () => {
    try {
      const running = await BackgroundLocationService.isBackgroundLocationRunning();
      setIsRunning(running);
    } catch (error) {
      console.error('Failed to check background location status:', error);
    }
  };

  const checkPermissions = async () => {
    try {
      const hasAlwaysPermission = await requestAlwaysLocationPermission();
      setHasPermissions(hasAlwaysPermission);
    } catch (error) {
      console.error('Failed to check permissions:', error);
      setHasPermissions(false);
    }
  };

  const handleToggleTracking = async () => {
    if (isLoading) return;
    
    // Първо проверяваме разрешенията
    if (!hasPermissions) {
      Alert.alert(
        '⚠️ Нужни са разрешения',
        'За да работи приложението с максимална точност, трябва да разрешите:\n\n• Достъп до местоположение: "Винаги"\n• Изключване на battery optimization\n\nИскате ли да отворя настройките?',
        [
          { text: 'Отказ', style: 'cancel' },
          { 
            text: 'Настройки', 
            onPress: async () => {
              await requestAlwaysLocationPermission();
              await requestBatteryOptimizationDisable();
              // Проверяваме отново след 2 секунди
              setTimeout(checkPermissions, 2000);
            }
          }
        ]
      );
      return;
    }
    
    setIsLoading(true);
    try {
      if (isRunning) {
        await BackgroundLocationService.stopBackgroundLocationTracking();
        setIsRunning(false);
      } else {
        const success = await BackgroundLocationService.startBackgroundLocationTracking();
        if (success) {
          setIsRunning(true);
        } else {
          Alert.alert(
            'Грешка',
            'Не можах да стартирам background tracking. Моля, проверете разрешенията за местоположение и battery optimization.'
          );
        }
      }
    } catch (error) {
      console.error('Failed to toggle tracking:', error);
      Alert.alert('Грешка', 'Възникна грешка при стартиране на tracking.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOptimizeSettings = async () => {
    Alert.alert(
      '⚡ Оптимизация за максимална точност',
      'За най-добра работа на приложението:\n\n🔋 Изключете battery optimization\n📍 Разрешете "винаги" достъп до местоположение\n🚀 Включете автостарт (Android)\n\nИскате ли да отворя настройките?',
      [
        { text: 'Отказ', style: 'cancel' },
        { 
          text: 'Настройки', 
          onPress: async () => {
            await requestBatteryOptimizationDisable();
            await showBatteryOptimizationInstructions();
            await requestAlwaysLocationPermission();
          }
        }
      ]
    );
  };

  if (!backgroundTrackingEnabled) {
    return null;
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={isRunning ? ['#1a3d1a', '#0d2a0d'] : ['#3d1a1a', '#2a0d0d']}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <View style={styles.statusIndicator}>
            <View style={styles.iconContainer}>
              <Smartphone 
                color={isRunning ? '#00ff88' : '#ff4444'} 
                size={16} 
              />
              {isRunning ? (
                <CheckCircle color="#00ff88" size={12} style={styles.statusIcon} />
              ) : (
                <AlertCircle color="#ff4444" size={12} style={styles.statusIcon} />
              )}
            </View>
            <Text style={[
              styles.statusText, 
              { color: isRunning ? '#00ff88' : '#ff4444' }
            ]}>
              Background режим {isRunning ? 'активен' : 'неактивен'}
            </Text>
          </View>
          
          {!hasPermissions && (
            <TouchableOpacity style={styles.warningButton} onPress={handleOptimizeSettings}>
              <AlertTriangle size={14} color="#ff9500" />
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.infoContainer}>
          <View style={styles.infoRow}>
            <Battery size={12} color={batteryLevel < 0.2 ? '#ff4444' : '#ffffff'} />
            <Text style={styles.infoText}>
              Батерия: {(batteryLevel * 100).toFixed(0)}%
              {isLowPowerMode && ' (Икономичен режим)'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Zap size={12} color="#ffffff" />
            <Text style={styles.infoText}>
              GPS: {locationUpdateInterval}ms (Максимална точност)
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Settings size={12} color={hasPermissions ? '#00ff88' : '#ff4444'} />
            <Text style={[styles.infoText, { color: hasPermissions ? '#00ff88' : '#ff4444' }]}>
              Разрешения: {hasPermissions ? '✅ Конфигурирани' : '❌ Нужна настройка'}
            </Text>
          </View>
        </View>

        <View style={styles.buttonContainer}>
          {!hasPermissions && (
            <TouchableOpacity style={styles.optimizeButton} onPress={handleOptimizeSettings}>
              <Zap size={12} color="white" />
              <Text style={styles.optimizeButtonText}>
                ⚡ Оптимизирай за максимална точност
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={[styles.button, isRunning ? styles.stopButton : styles.startButton]} 
            onPress={handleToggleTracking}
            disabled={isLoading}
          >
            {isRunning ? (
              <Square size={14} color="white" fill="white" />
            ) : (
              <Play size={14} color="white" fill="white" />
            )}
            <Text style={styles.buttonText}>
              {isLoading ? 'Зарежда...' : isRunning ? 'Спри' : 'Стартирай'}
            </Text>
          </TouchableOpacity>
        </View>
        
        {Platform.OS === 'android' && (
          <Text style={styles.disclaimer}>
            💡 За най-добра работа изключете battery optimization от настройките на устройството
          </Text>
        )}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 10,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  gradient: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    position: 'relative',
    marginRight: 8,
  },
  statusIcon: {
    position: 'absolute',
    top: -2,
    right: -2,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  warningButton: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 149, 0, 0.2)',
  },
  infoContainer: {
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 11,
    color: '#ffffff',
    marginLeft: 6,
    opacity: 0.9,
  },
  buttonContainer: {
    gap: 8,
  },
  optimizeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#ff9500',
  },
  optimizeButtonText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  startButton: {
    backgroundColor: '#00ff88',
  },
  stopButton: {
    backgroundColor: '#ff4444',
  },
  buttonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  disclaimer: {
    fontSize: 10,
    color: '#ffffff',
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.7,
    fontStyle: 'italic',
  },
});