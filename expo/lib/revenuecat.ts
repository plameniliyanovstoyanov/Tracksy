import { Platform } from 'react-native';
import Purchases, { CustomerInfo } from 'react-native-purchases';

/**
 * Инициализация на RevenueCat.
 *
 * Важно:
 * - За iOS задайте EXPO_PUBLIC_RC_IOS_API_KEY в .env
 * - За Android задайте EXPO_PUBLIC_RC_ANDROID_API_KEY в .env
 *
 * Пример .env:
 * EXPO_PUBLIC_RC_IOS_API_KEY=appl_...
 * EXPO_PUBLIC_RC_ANDROID_API_KEY=goog_...
 */
export async function initRevenueCat(appUserId?: string): Promise<void> {
  const apiKey =
    Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_RC_IOS_API_KEY
      : process.env.EXPO_PUBLIC_RC_ANDROID_API_KEY;

  if (!apiKey) {
    console.warn('RevenueCat API key is missing');
    return;
  }

  try {
    await Purchases.setLogLevel(Purchases.LOG_LEVEL.WARN);
    await Purchases.configure({ apiKey, appUserID: appUserId });
  } catch (error) {
    console.warn('Failed to configure RevenueCat (non-blocking):', error);
  }
}

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  try {
    const info = await Purchases.getCustomerInfo();
    return info;
  } catch (error) {
    console.warn('Failed to fetch RevenueCat customer info (non-blocking):', error);
    return null;
  }
}

/**
 * Купува entitlement "premium".
 *
 * В RevenueCat трябва да имате entitlement с ключ "premium",
 * закачен към активен пакет в текущото Offering.
 */
export async function purchasePremium(): Promise<CustomerInfo | null> {
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;

    if (!current) {
      console.warn('No active RevenueCat offering found');
      return null;
    }

    const availablePackage = current.availablePackages[0];

    if (!availablePackage) {
      console.warn('No available RevenueCat packages found');
      return null;
    }

    const { customerInfo } = await Purchases.purchasePackage(availablePackage);
    return customerInfo;
  } catch (error) {
    console.warn('Failed to purchase premium (non-blocking):', error);
    return null;
  }
}

export async function restorePurchases(): Promise<CustomerInfo | null> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    return customerInfo;
  } catch (error) {
    console.warn('Failed to restore purchases (non-blocking):', error);
    return null;
  }
}











