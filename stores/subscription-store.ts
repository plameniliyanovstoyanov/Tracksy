import { create } from 'zustand';
import type { CustomerInfo } from 'react-native-purchases';
import { getCustomerInfo as rcGetCustomerInfo, purchasePremium as rcPurchasePremium, restorePurchases as rcRestorePurchases } from '@/lib/revenuecat';
import { supabase } from '@/lib/supabase';

type SubscriptionState = {
  isPremium: boolean;
  subscriptionLoading: boolean;
  customerInfo: CustomerInfo | null;
  lastUpdatedAt: number | null;
  initSubscriptions: () => Promise<void>;
  refreshEntitlements: () => Promise<void>;
  purchasePremium: () => Promise<void>;
  restorePurchases: () => Promise<void>;
};

export const useSubscriptionStore = create<SubscriptionState>((set, get) => {
  const updateFromCustomerInfo = async (customerInfo: CustomerInfo | null) => {
    const prevIsPremium = get().isPremium;
    const isPremium = !!customerInfo?.entitlements?.active?.premium;

    set({
      customerInfo,
      isPremium,
      lastUpdatedAt: Date.now(),
    });

    // Синхронизация към Supabase само при промяна
    if (isPremium !== prevIsPremium) {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) {
          console.warn('Failed to get Supabase user for subscription sync (non-blocking):', error);
          return;
        }
        const user = data?.user;
        if (!user?.id) {
          return;
        }

        await supabase
          .from('user_profiles')
          .update({ is_premium: isPremium })
          .eq('id', user.id);
      } catch (error) {
        console.warn('Failed to sync premium flag to Supabase (non-blocking):', error);
      }
    }
  };

  return {
    isPremium: false,
    subscriptionLoading: false,
    customerInfo: null,
    lastUpdatedAt: null,

    initSubscriptions: async () => {
      if (get().subscriptionLoading) {
        return;
      }

      set({ subscriptionLoading: true });
      try {
        const info = await rcGetCustomerInfo();
        await updateFromCustomerInfo(info);
      } catch (error) {
        console.warn('Failed to init subscriptions (non-blocking):', error);
      } finally {
        set({ subscriptionLoading: false });
      }
    },

    refreshEntitlements: async () => {
      try {
        const info = await rcGetCustomerInfo();
        await updateFromCustomerInfo(info);
      } catch (error) {
        console.warn('Failed to refresh entitlements (non-blocking):', error);
      }
    },

    purchasePremium: async () => {
      try {
        await rcPurchasePremium();
        await get().refreshEntitlements();
      } catch (error) {
        console.warn('Failed to purchase premium (non-blocking):', error);
      }
    },

    restorePurchases: async () => {
      try {
        await rcRestorePurchases();
        await get().refreshEntitlements();
      } catch (error) {
        console.warn('Failed to restore purchases (non-blocking):', error);
      }
    },
  };
});











