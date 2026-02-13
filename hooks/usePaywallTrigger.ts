import AsyncStorage from '@react-native-async-storage/async-storage';

const MIN_APP_OPENS = 2;
const PAYWALL_INTERVAL_MS = 24 * 60 * 60 * 1000;

const APP_OPENS_KEY = 'app_opens';
const LAST_PAYWALL_SHOWN_AT_KEY = 'last_paywall_shown_at';

export async function registerAppOpen(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(APP_OPENS_KEY);
    const current = raw ? parseInt(raw, 10) || 0 : 0;
    const next = current + 1;
    await AsyncStorage.setItem(APP_OPENS_KEY, String(next));
  } catch (error) {
    console.warn('Failed to register app open (non-blocking):', error);
  }
}

export async function shouldShowPaywall(isPremium: boolean): Promise<boolean> {
  if (isPremium) return false;

  try {
    const [appOpensRaw, lastShownRaw] = await Promise.all([
      AsyncStorage.getItem(APP_OPENS_KEY),
      AsyncStorage.getItem(LAST_PAYWALL_SHOWN_AT_KEY),
    ]);

    const appOpens = appOpensRaw ? parseInt(appOpensRaw, 10) || 0 : 0;
    const lastShown = lastShownRaw ? parseInt(lastShownRaw, 10) || 0 : 0;

    if (appOpens < MIN_APP_OPENS) return false;

    const now = Date.now();
    if (now - lastShown < PAYWALL_INTERVAL_MS) return false;

    return true;
  } catch (error) {
    console.warn('Failed to evaluate paywall visibility (non-blocking):', error);
    return false;
  }
}

export async function markPaywallShown(): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_PAYWALL_SHOWN_AT_KEY, String(Date.now()));
  } catch (error) {
    console.warn('Failed to mark paywall as shown (non-blocking):', error);
  }
}











