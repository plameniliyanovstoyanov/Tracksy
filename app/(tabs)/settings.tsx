import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, Vibrate, MapPin, Smartphone, Info, Navigation, AlertTriangle, Ruler, Wifi, Battery, Download, User, LogOut } from 'lucide-react-native';
import { useSettingsStore } from '@/stores/settings-store';
import { useOfflineStore } from '@/stores/offline-store';
import { useBatteryOptimization } from '@/stores/battery-optimization';
import { useAuth } from '@/stores/auth-store';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';

export default function SettingsScreen() {
  const offlineStore = useOfflineStore();
  const batteryStore = useBatteryOptimization();
  const { user, isAuthenticated, signOut } = useAuth();
  const router = useRouter();
  
  React.useEffect(() => {
    offlineStore.initializeOfflineMode();
    if (Platform.OS !== 'web') {
      batteryStore.initializeBatteryOptimization();
    }
  }, []);
  
  const {
    notificationsEnabled,
    vibrationEnabled,
    soundEnabled,
    backgroundTrackingEnabled,
    backgroundTrackingActive,
    earlyWarningEnabled,
    warningDistances,
    toggleNotifications,
    toggleVibration,
    toggleSound,
    toggleBackgroundTracking,
    toggleEarlyWarning,
    toggleWarningDistance,
  } = useSettingsStore();
  const insets = useSafeAreaInsets();

  const SettingItem = ({ 
    icon, 
    title, 
    subtitle, 
    value, 
    onToggle,
    disabled = false,
    status
  }: {
    icon: React.ReactNode;
    title: string;
    subtitle: string;
    value: boolean;
    onToggle: () => void;
    disabled?: boolean;
    status?: string;
  }) => (
    <TouchableOpacity 
      style={[styles.settingItem, disabled && styles.disabledItem]} 
      onPress={disabled ? undefined : onToggle}
    >
      <LinearGradient
        colors={disabled ? ['#1a1a1a', '#0a0a0a'] : ['#2a2a2a', '#1a1a1a']}
        style={styles.settingGradient}
      >
        <View style={styles.settingContent}>
          <View style={styles.settingIcon}>
            {icon}
          </View>
          <View style={styles.settingText}>
            <Text style={[styles.settingTitle, disabled && styles.disabledText]}>{title}</Text>
            <Text style={[styles.settingSubtitle, disabled && styles.disabledText]}>
              {subtitle}
              {status && (
                <Text style={styles.statusText}> • {status}</Text>
              )}
            </Text>
          </View>
          <Switch
            value={value}
            onValueChange={disabled ? undefined : onToggle}
            disabled={disabled}
            trackColor={{ false: '#333', true: '#00ff88' }}
            thumbColor={value ? '#fff' : '#888'}
          />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#0a0a0a', '#1a1a1a', '#2a2a2a']}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Настройки</Text>
          <Text style={styles.subtitle}>
            Персонализирайте вашето изживяване
          </Text>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* User Profile Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Профил</Text>
            
            {isAuthenticated && user ? (
              <View style={styles.profileCard}>
                <LinearGradient
                  colors={['#2a2a2a', '#1a1a1a']}
                  style={styles.profileGradient}
                >
                  <View style={styles.profileContent}>
                    <View style={styles.profileAvatar}>
                      {user.user_metadata?.avatar_url ? (
                        <Image 
                          source={{ uri: user.user_metadata.avatar_url }}
                          style={styles.avatarImage}
                        />
                      ) : (
                        <User color="#00ff88" size={32} />
                      )}
                    </View>
                    <View style={styles.profileInfo}>
                      <Text style={styles.profileName}>
                        {user.user_metadata?.full_name || user.email?.split('@')[0] || 'Потребител'}
                      </Text>
                      <Text style={styles.profileEmail}>{user.email}</Text>
                      <Text style={styles.profileProvider}>
                        Влезли сте с {user.app_metadata?.provider || 'email'}
                      </Text>
                    </View>
                  </View>
                  
                  <TouchableOpacity 
                    style={styles.logoutButton}
                    onPress={async () => {
                      await signOut();
                      router.replace('/login');
                    }}
                  >
                    <LogOut color="#ff4444" size={18} />
                    <Text style={styles.logoutText}>Изход</Text>
                  </TouchableOpacity>
                </LinearGradient>
              </View>
            ) : (
              <TouchableOpacity 
                style={styles.loginCard}
                onPress={() => router.push('/login')}
              >
                <LinearGradient
                  colors={['#00ff88', '#00cc66']}
                  style={styles.loginGradient}
                >
                  <User color="#000" size={24} />
                  <Text style={styles.loginText}>Влезте в профила си</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Известия</Text>
            
            <SettingItem
              icon={<Bell color="#00ff88" size={20} />}
              title="Известия"
              subtitle="Получавайте известия при влизане в сектор"
              value={notificationsEnabled}
              onToggle={toggleNotifications}
            />

            <SettingItem
              icon={<Vibrate color="#00ff88" size={20} />}
              title="Вибрация"
              subtitle="Вибрация при известия"
              value={vibrationEnabled}
              onToggle={toggleVibration}
            />

            <SettingItem
              icon={<Smartphone color="#00ff88" size={20} />}
              title="Звук"
              subtitle="Звукови сигнали при известия"
              value={soundEnabled}
              onToggle={toggleSound}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Предупреждения</Text>
            
            <SettingItem
              icon={<AlertTriangle color="#00ff88" size={20} />}
              title="Ранни предупреждения"
              subtitle="Предупреждения преди влизане в сектор (като Waze)"
              value={earlyWarningEnabled}
              onToggle={toggleEarlyWarning}
            />

            {earlyWarningEnabled && (
              <View style={styles.distanceSelector}>
                <View style={styles.distanceHeader}>
                  <Ruler color="#00ff88" size={16} />
                  <Text style={styles.distanceTitle}>Разстояния за предупреждение</Text>
                </View>
                <View style={styles.distanceOptions}>
                  {[1000, 2000, 3000].map((distance) => (
                    <TouchableOpacity
                      key={distance}
                      style={[
                        styles.distanceOption,
                        warningDistances.includes(distance) && styles.distanceOptionActive
                      ]}
                      onPress={() => toggleWarningDistance(distance)}
                    >
                      <Text style={[
                        styles.distanceOptionText,
                        warningDistances.includes(distance) && styles.distanceOptionTextActive
                      ]}>
                        {distance / 1000}км
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.distanceDescription}>
                  Ще получавате предупреждения на: {warningDistances.map(d => `${d/1000}км`).join(', ')} преди сектор
                </Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Офлайн и оптимизация</Text>
            
            <SettingItem
              icon={<Wifi color="#00ff88" size={20} />}
              title="Офлайн режим"
              subtitle="Кеширане на сектори и карти за офлайн използване"
              value={!offlineStore.isOnline}
              onToggle={() => {}}
              disabled={true}
              status={offlineStore.isOnline ? 'Онлайн' : 'Офлайн'}
            />
            
            <SettingItem
              icon={<Download color="#00ff88" size={20} />}
              title="Кеширани данни"
              subtitle={`${offlineStore.cachedSectors.length} сектора, ${Object.keys(offlineStore.cachedMapTiles).length} карти`}
              value={offlineStore.cachedSectors.length > 0}
              onToggle={() => {}}
              disabled={true}
            />
            
            {Platform.OS !== 'web' && (
              <SettingItem
                icon={<Battery color="#00ff88" size={20} />}
                title="GPS Точност"
                subtitle="Винаги максимална точност (адаптивният режим е премахнат)"
                value={true}
                onToggle={() => {}}
                status={`${(batteryStore.batteryLevel * 100).toFixed(0)}% батерия`}
                disabled={true}
              />
            )}
            
            {Platform.OS !== 'web' && (
              <View style={styles.batteryInfo}>
                <Text style={styles.batteryInfoText}>
                  📍 GPS интервал: {batteryStore.locationUpdateInterval / 1000}сек (макс. точност)
                </Text>
                <Text style={styles.batteryInfoText}>
                  🎯 GPS точност: Най-висока (винаги)
                </Text>
                {batteryStore.isLowPowerMode && (
                  <Text style={[styles.batteryInfoText, { color: '#ffaa44' }]}>
                    ⚡ Режим за пестене на батерия активен (но GPS остава максимален)
                  </Text>
                )}
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Проследяване</Text>
            
            <SettingItem
              icon={<Navigation color="#00ff88" size={20} />}
              title="Background режим"
              subtitle="Следи за сектори дори когато приложението е затворено"
              value={backgroundTrackingEnabled}
              onToggle={toggleBackgroundTracking}
              status={backgroundTrackingActive ? 'Активен' : backgroundTrackingEnabled ? 'Стартира...' : undefined}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Информация</Text>
            
            <TouchableOpacity style={styles.infoItem}>
              <LinearGradient
                colors={['#2a2a2a', '#1a1a1a']}
                style={styles.settingGradient}
              >
                <View style={styles.settingContent}>
                  <View style={styles.settingIcon}>
                    <Info color="#00ff88" size={20} />
                  </View>
                  <View style={styles.settingText}>
                    <Text style={styles.settingTitle}>За приложението</Text>
                    <Text style={styles.settingSubtitle}>
                      Версия 1.0.0 - Следене на скорост в сектори
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity style={styles.infoItem}>
              <LinearGradient
                colors={['#2a2a2a', '#1a1a1a']}
                style={styles.settingGradient}
              >
                <View style={styles.settingContent}>
                  <View style={styles.settingIcon}>
                    <MapPin color="#00ff88" size={20} />
                  </View>
                  <View style={styles.settingText}>
                    <Text style={styles.settingTitle}>GPS точност</Text>
                    <Text style={styles.settingSubtitle}>
                      Използва най-високата точност за проследяване
                    </Text>
                  </View>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Background режим</Text>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                🔋 <Text style={styles.boldText}>Батерия:</Text> Background режимът може да намали живота на батерията.
              </Text>
              <Text style={styles.infoText}>
                📍 <Text style={styles.boldText}>Местоположение:</Text> Приложението ще следи местоположението ви дори когато е затворено.
              </Text>
              <Text style={styles.infoText}>
                🔔 <Text style={styles.boldText}>Известия:</Text> Ще получавате известия при влизане/излизане от сектори.
              </Text>
              <Text style={styles.infoText}>
                ⚠️ <Text style={styles.boldText}>Ранни предупреждения:</Text> Предупреждения преди влизане в сектор (като Waze).
              </Text>
              <Text style={styles.infoText}>
                🚨 <Text style={styles.boldText}>Превишена скорост:</Text> Автоматични предупреждения при превишена скорост.
              </Text>
            </View>
          </View>

          <View style={styles.disclaimer}>
            <Text style={styles.disclaimerText}>
              ⚠️ Това приложение е само за информационни цели. Винаги спазвайте 
              пътните правила и ограниченията за скорост. Не използвайте телефона 
              по време на шофиране.
            </Text>
          </View>
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
  settingItem: {
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
  },
  infoItem: {
    marginBottom: 8,
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingGradient: {
    padding: 16,
  },
  settingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  settingSubtitle: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  disclaimer: {
    backgroundColor: '#2a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  disclaimerText: {
    color: '#ffaa44',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  disabledItem: {
    opacity: 0.6,
  },
  disabledText: {
    color: '#555',
  },
  statusText: {
    color: '#00ff88',
    fontSize: 11,
    fontWeight: '500',
  },
  infoBox: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  infoText: {
    color: '#ccc',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 8,
  },
  boldText: {
    fontWeight: '600',
    color: '#fff',
  },
  distanceSelector: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  distanceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  distanceTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  distanceOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  distanceOption: {
    flex: 1,
    backgroundColor: '#333',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginHorizontal: 4,
    alignItems: 'center',
  },
  distanceOptionActive: {
    backgroundColor: '#00ff88',
  },
  distanceOptionText: {
    color: '#ccc',
    fontSize: 13,
    fontWeight: '500',
  },
  distanceOptionTextActive: {
    color: '#000',
    fontWeight: '600',
  },
  distanceDescription: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 16,
  },
  batteryInfo: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  batteryInfoText: {
    color: '#888',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 4,
  },
  profileCard: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  profileGradient: {
    padding: 16,
  },
  profileContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profileAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  profileEmail: {
    color: '#888',
    fontSize: 14,
    marginBottom: 2,
  },
  profileProvider: {
    color: '#00ff88',
    fontSize: 12,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2a1a1a',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  logoutText: {
    color: '#ff4444',
    fontSize: 14,
    fontWeight: '500',
  },
  loginCard: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  loginGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    gap: 12,
  },
  loginText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
});