# Speed Monitoring App - Приложение за следене на скорост

Мобилно приложение за следене на скоростта на автомобила и изчисляване на средната скорост в определени сектори за средна скорост по българските магистрали.

## 🚗 Функционалности

- **GPS проследяване в реално време** - Точно измерване на скоростта
- **Карта с отбелязани сектори** - Визуализация на секторите за средна скорост
- **Автоматично засичане** - Известия при влизане и излизане от сектор
- **История на преминаванията** - Запазване на данни за минали пътувания
- **Персонализирани настройки** - Управление на известията и звуците

## 📍 Включени сектори

- **Тракия - Вакарел до Ихтиман** (15.2 км, лимит 130 км/ч)
- **Тракия - Цалапица до Радиново** (18.7 км, лимит 130 км/ч)
- **Струма - Сандански до Дамяница** (22.3 км, лимит 130 км/ч)
- **Път I-1 - Слатино до Кочериново** (12.8 км, лимит 90 км/ч)
- **Северна тангента - Илиянци до Чепинци** (14.5 км, лимит 90 км/ч)

## 🛠 Инсталация

### Предварителни изисквания

- Node.js (версия 18 или по-нова)
- Expo CLI
- Expo Go приложение на телефона (за тестване)

### Стъпки за инсталация

1. **Клонирайте проекта**
   ```bash
   git clone <repository-url>
   cd speed-monitoring-app
   ```

2. **Инсталирайте зависимостите**
   ```bash
   npm install
   # или
   yarn install
   ```

3. **Стартирайте development сървъра**
   ```bash
   npm start
   # или
   yarn start
   ```

## 📱 Стартиране на устройство

### Android

1. Инсталирайте Expo Go от Google Play Store
2. Сканирайте QR кода от терминала с Expo Go приложението
3. Разрешете достъп до местоположението когато бъдете попитани

### iOS

1. Инсталирайте Expo Go от App Store
2. Сканирайте QR кода с камерата на iPhone или с Expo Go
3. Разрешете достъп до местоположението когато бъдете попитани

### Web (за тестване)

```bash
npm run start-web
# или
yarn start-web
```

Отворете браузъра на `http://localhost:8081`

## 🏗 Build за Production

### Подготовка за App Store/Google Play

1. **Конфигурирайте app.json**
   ```json
   {
     "expo": {
       "name": "Speed Monitor BG",
       "slug": "speed-monitor-bg",
       "version": "1.0.0",
       "platforms": ["ios", "android"],
       "permissions": [
         "ACCESS_FINE_LOCATION",
         "ACCESS_COARSE_LOCATION"
       ]
     }
   }
   ```

2. **Build за Android (APK)**
   ```bash
   expo build:android
   ```

3. **Build за iOS**
   ```bash
   expo build:ios
   ```

### EAS Build (препоръчително)

1. **Инсталирайте EAS CLI**
   ```bash
   npm install -g @expo/eas-cli
   ```

2. **Конфигурирайте EAS**
   ```bash
   eas build:configure
   ```

3. **Build за Android**
   ```bash
   eas build --platform android
   ```

4. **Build за iOS**
   ```bash
   eas build --platform ios
   ```

## 🔧 Разработка

### Структура на проекта

```
├── app/                    # Expo Router страници
│   ├── (tabs)/            # Tab навигация
│   │   ├── index.tsx      # Главен екран с карта
│   │   ├── sectors.tsx    # Списък със сектори
│   │   └── settings.tsx   # Настройки
│   └── _layout.tsx        # Root layout
├── components/            # React компоненти
│   ├── SpeedDisplay.tsx   # Показване на скорост
│   ├── SectorPanel.tsx    # Панел за текущ сектор
│   └── MapView.tsx        # Карта компонент
├── stores/               # Zustand state management
│   ├── speed-store.ts    # Управление на скорост
│   ├── sector-store.ts   # Управление на сектори
│   └── settings-store.ts # Настройки
├── data/                 # Данни
│   └── sectors.ts        # Дефиниции на сектори
└── constants/            # Константи
    └── colors.ts         # Цветова схема
```

### RevenueCat абонаменти (Premium без реклами)

- Добавена е интеграция с **RevenueCat** чрез `react-native-purchases`.
- За да работи, трябва да зададеш публичните API ключове в `.env`:
  - `EXPO_PUBLIC_RC_IOS_API_KEY=appl_...`
  - `EXPO_PUBLIC_RC_ANDROID_API_KEY=goog_...`
- Тези стойности се четат в `app.config.js` и са достъпни в рантайм като `process.env.EXPO_PUBLIC_RC_IOS_API_KEY` / `process.env.EXPO_PUBLIC_RC_ANDROID_API_KEY`.
- В RevenueCat трябва да имаш entitlement с име **"premium"**, който се използва в `lib/revenuecat.ts` и `stores/subscription-store.ts` за определяне на `isPremium` и скриване на рекламите.

#### Обяснение на flow-а

- **Първи старт**
  - `RootLayout` вика `registerAppOpen()` → броим стартирания в AsyncStorage.
  - `AuthProvider` зарежда Supabase с `persistSession: true`, така че ако някой се е логнал преди, ще бъде автоматично логнат при нов старт.
  - Ако не е логнат, може да ползва приложението като анонимен/guest (както до сега); за да купи Premium, задължително трябва да се логне (бутонът за Premium в paywall-а проверява `isAuthenticated` и при нужда праща към `/login`).

- **След 2‑ри / 3‑ти старт и нататък**
  - При всяко влизане в екрана `Settings`, hook-ът проверява с `shouldShowPaywall(isPremium)`:
    - минимум 2 стартирания (`app_opens >= 2`),
    - да не са минали < 24 часа от последния paywall,
    - и само ако `!isPremium`.
  - Ако условията са изпълнени → `markPaywallShown()` + `router.push('/paywall')`.

- **Как работи `isPremium` и скриването на реклами**
  - В `_layout.tsx`, при промяна на `user?.id` се вика `initRevenueCat(user?.id)` → SDK-то се конфигурира с user ID (или анонимен, ако няма).
  - След това `initSubscriptions()` от `useSubscriptionStore` вади `CustomerInfo` от RevenueCat и изчислява `isPremium = !!customerInfo.entitlements.active["premium"]`.
  - При всяка промяна на `isPremium` store-ът:
    - обновява локалния state (`isPremium`, `customerInfo`, `lastUpdatedAt`),
    - прави лек Supabase `update` към таблица `profiles` (`is_premium: isPremium`, по `id = user.id`), ако има логнат Supabase user.
  - Всяко място, където по-късно ще интегрираш реклами, може да ползва:

    ```ts
    const { isPremium } = useSubscriptionStore();
    const shouldShowAds = !isPremium;
    ```

  - UI-то винаги стъпва директно на RevenueCat `isPremium`; Supabase sync е само за бекенда.

### AdMob реклами (само за Free потребители)

Приложението интегрира **Google AdMob** за показване на interstitial реклами само на безплатните потребители:

- **Пакет**: `react-native-google-mobile-ads` (v16+)
- **Основна логика**: `lib/ads.ts`
- **Конфигурация**: `app.config.js` (Android/iOS App ID)
- **Документация**: Виж [`docs/ADMOB_SETUP.md`](./docs/ADMOB_SETUP.md) за пълни инструкции

#### Кога се показват рекламите

- **При стартиране на приложението** (само веднъж за сесия) - само за non-premium
- **След приключване на сектор** - само за non-premium

Premium потребителите **никога** не виждат реклами.

#### Production настройка

1. Създай Android app в [AdMob Console](https://apps.admob.google.com/)
2. Създай **Interstitial Ad Unit**
3. Обнови `app.config.js` с App ID
4. Обнови `lib/ads.ts` с Ad Unit ID
5. (Опционално) Повтори за iOS когато планираш iOS build

За подробни стъпки виж [`docs/ADMOB_SETUP.md`](./docs/ADMOB_SETUP.md).

### Добавяне на нови сектори

Редактирайте `data/sectors.ts`:

```typescript
{
  id: 'unique-sector-id',
  name: 'Име на сектора',
  route: 'Път/Магистрала',
  description: 'Описание',
  startPoint: {
    lat: 42.1234,
    lng: 23.5678,
    name: 'Начална точка'
  },
  endPoint: {
    lat: 42.2345,
    lng: 23.6789,
    name: 'Крайна точка'
  },
  distance: 15.5, // в километри
  speedLimit: 130 // в км/ч
}
```

## ⚠️ Важни бележки

- **Разрешения**: Приложението изисква достъп до местоположението
- **Точност**: GPS точността зависи от устройството и условията
- **Батерия**: Непрекъснатото GPS проследяване консумира батерия
- **Законност**: Използвайте отговорно и спазвайте пътните правила

## 🐛 Отстраняване на проблеми

### GPS не работи
- Проверете дали сте разрешили достъп до местоположението
- Уверете се, че GPS е включен на устройството
- Тествайте на открито за по-добра точност

### Известията не работят
- Проверете настройките за известия в приложението
- Разрешете известия в системните настройки
- На iOS може да се наложи да рестартирате приложението

### Приложението се затваря
- Проверете конзолата за грешки
- Уверете се, че всички зависимости са инсталирани
- Рестартирайте Expo development сървъра

## 📄 Лиценз

Това приложение е създадено за образователни цели. Използвайте отговорно.

## 🤝 Принос

Приветстваме предложения за подобрения! Моля, създайте issue или pull request.