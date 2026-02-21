import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { create } from 'zustand';
import { combine } from 'zustand/middleware';
import { Sector } from '@/data/sectors';
import { logger } from '@/utils/logger';

interface OfflineState {
  isOnline: boolean;
  cachedSectors: Sector[];
  cachedMapTiles: { [key: string]: string }; // Base64 encoded tiles
  lastSyncTime: number;
  pendingNotifications: PendingNotification[];
  _netInfoUnsubscribe: (() => void) | null;
}

interface PendingNotification {
  id: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

interface OfflineActions {
  initializeOfflineMode: () => Promise<void>;
  cacheSectors: (sectors: Sector[]) => Promise<void>;
  cacheMapTile: (tileKey: string, tileData: string) => Promise<void>;
  getCachedMapTile: (tileKey: string) => string | null;
  syncPendingData: () => Promise<void>;
  setOnlineStatus: (isOnline: boolean) => void;
  addPendingNotification: (notification: PendingNotification) => void;
}

const CACHE_KEYS = {
  SECTORS: 'offline-sectors',
  MAP_TILES: 'offline-map-tiles',
  LAST_SYNC: 'offline-last-sync',
  PENDING_NOTIFICATIONS: 'offline-pending-notifications',
};

export const useOfflineStore = create(
  combine(
    {
      isOnline: true,
      cachedSectors: [] as Sector[],
      cachedMapTiles: {} as { [key: string]: string },
      lastSyncTime: 0,
      pendingNotifications: [] as PendingNotification[],
      _netInfoUnsubscribe: null as (() => void) | null,
    } as OfflineState,
    (set, get) => ({
      initializeOfflineMode: async () => {
        try {
          // Зареждаме кеширани данни
          const [sectorsStr, tilesStr, lastSyncStr, pendingStr] = await Promise.all([
            AsyncStorage.getItem(CACHE_KEYS.SECTORS),
            AsyncStorage.getItem(CACHE_KEYS.MAP_TILES),
            AsyncStorage.getItem(CACHE_KEYS.LAST_SYNC),
            AsyncStorage.getItem(CACHE_KEYS.PENDING_NOTIFICATIONS),
          ]);

          const cachedSectors = sectorsStr ? JSON.parse(sectorsStr) : [];
          const cachedMapTiles = tilesStr ? JSON.parse(tilesStr) : {};
          const lastSyncTime = lastSyncStr ? parseInt(lastSyncStr) : 0;
          const pendingNotifications = pendingStr ? JSON.parse(pendingStr) : [];

          set({
            cachedSectors,
            cachedMapTiles,
            lastSyncTime,
            pendingNotifications,
          });

          // Почистваме предишен listener ако има (при повторно извикване)
          const prevUnsub = get()._netInfoUnsubscribe;
          if (prevUnsub) prevUnsub();

          // Слушаме за промени в мрежовата свързаност
          const unsubscribe = NetInfo.addEventListener(state => {
            const isOnline = state.isConnected && state.isInternetReachable !== false;
            set({ isOnline });

            // Ако се върнем онлайн, синхронизираме
            if (isOnline && get().pendingNotifications.length > 0) {
              get().syncPendingData();
            }
          });
          set({ _netInfoUnsubscribe: unsubscribe });

          // Проверяваме текущия статус
          const netState = await NetInfo.fetch();
          set({ isOnline: netState.isConnected && netState.isInternetReachable !== false });

          logger.log('Offline mode initialized');
        } catch (error) {
          logger.error('Failed to initialize offline mode:', error);
        }
      },

      cacheSectors: async (sectors: Sector[]) => {
        try {
          await AsyncStorage.setItem(CACHE_KEYS.SECTORS, JSON.stringify(sectors));
          await AsyncStorage.setItem(CACHE_KEYS.LAST_SYNC, Date.now().toString());
          
          set({ 
            cachedSectors: sectors,
            lastSyncTime: Date.now()
          });
          
          logger.log(`Cached ${sectors.length} sectors for offline use`);
        } catch (error) {
          logger.error('Failed to cache sectors:', error);
        }
      },

      cacheMapTile: async (tileKey: string, tileData: string) => {
        try {
          const { cachedMapTiles } = get();
          const updatedTiles = { ...cachedMapTiles, [tileKey]: tileData };
          
          // Ограничаваме броя на кешираните плочки
          const tileKeys = Object.keys(updatedTiles);
          if (tileKeys.length > 100) {
            // Премахваме най-старите плочки
            const keysToRemove = tileKeys.slice(0, tileKeys.length - 100);
            keysToRemove.forEach(key => delete updatedTiles[key]);
          }
          
          await AsyncStorage.setItem(CACHE_KEYS.MAP_TILES, JSON.stringify(updatedTiles));
          set({ cachedMapTiles: updatedTiles });
        } catch (error) {
          logger.error('Failed to cache map tile:', error);
        }
      },

      getCachedMapTile: (tileKey: string) => {
        const { cachedMapTiles } = get();
        return cachedMapTiles[tileKey] || null;
      },

      syncPendingData: async () => {
        try {
          const { pendingNotifications, isOnline } = get();
          
          if (!isOnline || pendingNotifications.length === 0) {
            return;
          }

          logger.log(`Syncing ${pendingNotifications.length} pending notifications`);
          
          // TODO: Изпращаме pending notifications към сървър
          // За сега просто ги изчистваме
          
          await AsyncStorage.removeItem(CACHE_KEYS.PENDING_NOTIFICATIONS);
          set({ pendingNotifications: [] });
        } catch (error) {
          logger.error('Failed to sync pending data:', error);
        }
      },

      setOnlineStatus: (isOnline: boolean) => {
        set({ isOnline });
      },

      addPendingNotification: async (notification: PendingNotification) => {
        try {
          const { pendingNotifications } = get();
          const updated = [...pendingNotifications, notification];
          
          await AsyncStorage.setItem(CACHE_KEYS.PENDING_NOTIFICATIONS, JSON.stringify(updated));
          set({ pendingNotifications: updated });
        } catch (error) {
          logger.error('Failed to add pending notification:', error);
        }
      },
    } as OfflineActions)
  )
);