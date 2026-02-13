import { Platform } from 'react-native';
import {
  InterstitialAd,
  AdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';

// ─── Ad Unit ID-та ───────────────────────────────────────────
// В dev режим (__DEV__) използваме официални тестови ID-та от Google.
// В production използваме реалните Ad Unit ID-та от твоя AdMob акаунт.

const ANDROID_INTERSTITIAL_ID = __DEV__
  ? TestIds.INTERSTITIAL
  : 'ca-app-pub-4016172638513790/9260477494'; // Твоят реален Android interstitial Ad Unit ID

const IOS_INTERSTITIAL_ID = __DEV__
  ? TestIds.INTERSTITIAL
  : 'ca-app-pub-4016172638513790/9260477494'; // TODO: смени с реален iOS Ad Unit ID когато създадеш iOS app в AdMob

// ─── Състояние ───────────────────────────────────────────────
let appStartAdShown = false;

// ─── Помощна функция за показване на interstitial ────────────
function showInterstitial(placement: 'app_start' | 'post_sector'): Promise<void> {
  if (Platform.OS === 'web') return Promise.resolve();

  return new Promise((resolve) => {
    try {
      const adUnitId =
        Platform.OS === 'ios' ? IOS_INTERSTITIAL_ID : ANDROID_INTERSTITIAL_ID;

      const interstitial = InterstitialAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: true,
      });

      // Timeout – ако рекламата не се зареди за 8 секунди, продължаваме без нея
      const timeout = setTimeout(() => {
        console.warn(`Ad timed out (${placement}) - continuing without ad`);
        resolve();
      }, 8000);

      const unsubscribeLoaded = interstitial.addAdEventListener(
        AdEventType.LOADED,
        () => {
          clearTimeout(timeout);
          interstitial.show().catch((err) => {
            console.warn(`Failed to show ad (${placement}):`, err);
            resolve();
          });
        }
      );

      const unsubscribeClosed = interstitial.addAdEventListener(
        AdEventType.CLOSED,
        () => {
          unsubscribeLoaded();
          unsubscribeClosed();
          unsubscribeError();
          resolve();
        }
      );

      const unsubscribeError = interstitial.addAdEventListener(
        AdEventType.ERROR,
        (error) => {
          clearTimeout(timeout);
          console.warn(`Ad error (${placement}):`, error);
          unsubscribeLoaded();
          unsubscribeClosed();
          unsubscribeError();
          resolve();
        }
      );

      interstitial.load();
    } catch (error) {
      console.warn(`Failed to create interstitial ad (${placement}) (non-blocking):`, error);
      resolve();
    }
  });
}

// ─── Публични функции ────────────────────────────────────────

/**
 * Показва interstitial реклама при стартиране на приложението.
 * Показва се само веднъж и само ако потребителят НЕ е Premium.
 */
export async function showAppStartAd(isPremium: boolean): Promise<void> {
  if (isPremium || appStartAdShown) return;
  appStartAdShown = true;

  await showInterstitial('app_start');
}

/**
 * Показва interstitial реклама след приключване на сектор.
 * Показва се само ако потребителят НЕ е Premium.
 */
export async function showPostSectorAd(isPremium: boolean): Promise<void> {
  if (isPremium) return;

  await showInterstitial('post_sector');
}
