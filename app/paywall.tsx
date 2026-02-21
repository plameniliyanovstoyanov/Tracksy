import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Shield, BadgeDollarSign, Ban } from 'lucide-react-native';
import { useSubscriptionStore } from '@/stores/subscription-store';
import { useAuth } from '@/stores/auth-store';

export default function PaywallScreen() {
  const router = useRouter();
  const { isPremium, subscriptionLoading, purchasePremium, restorePurchases } = useSubscriptionStore();
  const { isAuthenticated } = useAuth();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Ако isPremium стане true (реактивно), автоматично навигираме
  useEffect(() => {
    if (isPremium) {
      router.replace('/(tabs)');
    }
  }, [isPremium, router]);

  const handleContinueFree = () => {
    router.back();
  };

  const handlePurchasePremium = async () => {
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    setErrorMessage(null);
    try {
      await purchasePremium();
      // isPremium ще се обнови реактивно чрез useEffect по-горе
    } catch (error: unknown) {
      const isUserCancelled = error instanceof Object && 'userCancelled' in error && (error as { userCancelled: boolean }).userCancelled;
      const msg = isUserCancelled
        ? null // Потребителят е натиснал Cancel – не показваме грешка
        : 'Неуспешна покупка. Моля, опитайте отново.';
      if (msg) {
        setErrorMessage(msg);
        Alert.alert('Грешка', msg);
      }
    }
  };

  const handleRestore = async () => {
    setErrorMessage(null);
    try {
      await restorePurchases();
      // Ако няма premium entitlement, показваме съобщение
      const { isPremium: restored } = useSubscriptionStore.getState();
      if (!restored) {
        Alert.alert('Информация', 'Не бяха намерени предишни покупки за този акаунт.');
      }
      // Ако е premium – useEffect ще навигира автоматично
    } catch {
      setErrorMessage('Неуспешно възстановяване на покупки.');
      Alert.alert('Грешка', 'Неуспешно възстановяване на покупки. Моля, опитайте отново.');
    }
  };

  if (isPremium) {
    return null;
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0a0a0a', '#151515', '#1f1f1f']}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Как искаш да ползваш Tracksy?</Text>
          <Text style={styles.subtitle}>
            Избери между безплатна версия с реклами или Premium без реклами.
          </Text>
        </View>

        <View style={styles.cardsRow}>
          <View style={styles.card}>
            <LinearGradient
              colors={['#1a1a1a', '#101010']}
              style={styles.cardGradient}
            >
              <View style={styles.cardIcon}>
                <Ban color="#ffb347" size={28} />
              </View>
              <Text style={styles.cardTitle}>Free</Text>
              <Text style={styles.cardSubtitle}>Безплатно, с реклами</Text>
              <Text style={styles.cardDescription}>
                Пълна функционалност, но от време на време показваме реклама на
                цял екран.
              </Text>
            </LinearGradient>
          </View>

          <View style={[styles.card, styles.cardPremium]}>
            <LinearGradient
              colors={['#00ff88', '#00cc66']}
              style={styles.cardGradient}
            >
              <View style={styles.cardIconPremium}>
                <Shield color="#000000" size={28} />
              </View>
              <Text style={styles.cardTitlePremium}>Premium</Text>
              <Text style={styles.cardSubtitlePremium}>Без реклами</Text>
              <Text style={styles.cardDescriptionPremium}>
                Премахваш всички реклами и подкрепяш развитието на приложението.
              </Text>
            </LinearGradient>
          </View>
        </View>

        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.freeButton}
            onPress={handleContinueFree}
            activeOpacity={0.8}
            disabled={subscriptionLoading}
          >
            <Text style={styles.freeButtonText}>Продължи безплатно с реклами</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.premiumButton, subscriptionLoading && styles.disabledButton]}
            onPress={handlePurchasePremium}
            activeOpacity={0.8}
            disabled={subscriptionLoading}
          >
            <LinearGradient
              colors={['#00ff88', '#00cc66']}
              style={styles.premiumButtonGradient}
            >
              {subscriptionLoading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <BadgeDollarSign color="#000" size={20} />
                  <Text style={styles.premiumButtonText}>Премахни рекламите (Premium)</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.restoreButton}
            onPress={handleRestore}
            activeOpacity={0.7}
            disabled={subscriptionLoading}
          >
            <Text style={styles.restoreText}>
              Вече имаш абонамент? Възстанови покупките.
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  gradient: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 32,
    justifyContent: 'space-between',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 20,
  },
  cardsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  card: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  cardPremium: {
    borderWidth: 1,
    borderColor: '#00ff88',
  },
  cardGradient: {
    padding: 16,
    height: 200,
    justifyContent: 'space-between',
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 179, 71, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardIconPremium: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  cardSubtitle: {
    color: '#ffb347',
    fontSize: 14,
    fontWeight: '500',
  },
  cardDescription: {
    color: '#ccc',
    fontSize: 13,
    lineHeight: 18,
  },
  cardTitlePremium: {
    color: '#000',
    fontSize: 18,
    fontWeight: '700',
  },
  cardSubtitlePremium: {
    color: '#001500',
    fontSize: 14,
    fontWeight: '600',
  },
  cardDescriptionPremium: {
    color: '#002200',
    fontSize: 13,
    lineHeight: 18,
  },
  footer: {
    marginTop: 24,
  },
  freeButton: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#444',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    backgroundColor: '#151515',
  },
  freeButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  premiumButton: {
    height: 52,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  premiumButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  premiumButtonText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.7,
  },
  restoreButton: {
    alignItems: 'center',
  },
  restoreText: {
    color: '#aaa',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
});











