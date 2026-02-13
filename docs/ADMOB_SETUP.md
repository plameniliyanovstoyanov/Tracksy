# AdMob интеграция - Ръководство за настройка

## 📋 Преглед

Приложението използва **Google Mobile Ads (AdMob)** за показване на interstitial реклами само на **безплатни потребители** (non-premium). Premium потребителите не виждат реклами.

## 🎯 Бизнес модел

- **Free (с реклами)**: Потребителят получава пълна функционалност, но вижда рекламни съобщения в безопасни моменти:
  - При стартиране на приложението (само веднъж)
  - След приключване на сектор за средна скорост
  
- **Premium (без реклами)**: Купува се през RevenueCat, премахва всички реклами.

## 🛠 Текуща имплементация

### Кодова структура

- **`lib/ads.ts`** - Основна логика за зареждане и показване на interstitial реклами
- **`app/(tabs)/index.tsx`** - Интегриране на рекламите в Home екрана
- **`app.config.js`** - Конфигурация на AdMob App ID за Android и iOS

### Използвани Ad Unit ID-та (текущи)

#### Android
- **App ID**: `ca-app-pub-4016172638513790~8457519952`
- **Interstitial Ad Unit ID**: `ca-app-pub-4016172638513790/9260477494`

#### iOS
- **App ID**: `ca-app-pub-4016172638513790~8457519952` ⚠️ **TODO: Създай iOS app в AdMob**
- **Interstitial Ad Unit ID**: `ca-app-pub-4016172638513790/9260477494` ⚠️ **TODO: Създай iOS Ad Unit**

> **Важно**: Когато създадеш iOS app в AdMob, трябва да обновиш `app.config.js` и `lib/ads.ts` с реалните iOS ID-та.

## 🚀 Как да пуснеш рекламите в Production

### 1. Провери AdMob конфигурацията

В [AdMob конзола](https://apps.admob.google.com/):
- Потвърди че Android app (`bg.tracksy.app`) е създаден и approved
- Потвърди че имаш interstitial Ad Unit за Android
- (Ако планираш iOS build) Създай iOS app и iOS interstitial Ad Unit

### 2. Обнови iOS конфигурацията (ако е приложимо)

След като създадеш iOS app в AdMob:

**В `app.config.js`** (линии 23 и 28):
```js
config: {
  googleMobileAdsAppId: "ca-app-pub-XXXXXXXX~YYYYYYYYYY", // твоето iOS App ID
},
infoPlist: {
  // ...
  GADApplicationIdentifier: "ca-app-pub-XXXXXXXX~YYYYYYYYYY", // твоето iOS App ID
  // ...
}
```

**В `lib/ads.ts`** (линия 18):
```ts
const IOS_INTERSTITIAL_ID = __DEV__
  ? TestIds.INTERSTITIAL
  : 'ca-app-pub-XXXXXXXX/ZZZZZZZZZZ'; // твоето iOS Ad Unit ID
```

### 3. Build за Production

#### Чрез EAS (препоръчително)

```bash
# Android
eas build --platform android --profile production

# iOS
eas build --platform ios --profile production
```

#### Местен build (за разработка/тестване)

```bash
# Android
npx expo run:android --variant release

# iOS
npx expo run:ios --configuration Release
```

### 4. Тестване преди пускане

- В **dev режим** (`__DEV__ === true`) приложението автоматично ползва тестови Ad Unit ID-та от Google.
- В **production build** се използват реалните ID-та от AdMob.

**Как да тестваш:**
1. Направи production build
2. Инсталирай на реално устройство
3. Уверете се, че НЕ си логнат като Premium потребител
4. Стартирай приложението → трябва да видиш interstitial реклама (при старт)
5. Влез и излез от сектор → трябва да видиш interstitial реклама (след излизане)

## 🧪 Тестови режим (Development)

В dev режим (`__DEV__ === true`):
- Автоматично се използват официалните тестови Ad Unit ID-та на Google
- Рекламите се показват нормално, но **не генерират приходи**
- Безопасно за development билдове

## 🎨 UX потоци

### Потребител стартира приложението (Free)
1. Приложението се зарежда
2. След като GPS стане активен, се показва **interstitial реклама** (само веднъж за сесията)
3. След затваряне на рекламата, потребителят вижда Home екрана

### Потребител завършва преминаване на сектор (Free)
1. Потребителят излиза от сектор (`currentSector → null`)
2. Показва се **interstitial реклама**
3. След затваряне на рекламата, потребителят продължава да ползва приложението

### Premium потребител
- **Никога** не вижда реклами
- Всички `showAppStartAd` и `showPostSectorAd` извиквания автоматично се пропускат поради проверката `if (isPremium) return;`

## 🔒 Премахване на рекламите (Premium)

Потребителят може да закупи Premium в екрана **Paywall** (`/paywall`):
1. Натиска "Премахни рекламите (Premium)"
2. Прави покупка през RevenueCat
3. `useSubscriptionStore().isPremium` става `true`
4. Всички реклами се премахват автоматично

Paywall се показва автоматично в Settings след:
- Минимум 2 стартирания на приложението
- Минимум 24 часа след последно показване

## 📊 Проследяване на приходи

Всички Ad impressions, clicks и приходи се проследяват автоматично в AdMob Dashboard:
- [AdMob Console](https://apps.admob.google.com/)
- Секция "Tracksy (Android)" → "Ad units" → "Performance"

## ⚠️ Важни бележки

- **GDPR/Consent**: `react-native-google-mobile-ads` поддържа Funding Choices (AdMob consent). Добави UMP (User Messaging Platform) ако планираш да пуснеш в EU.
- **Test Ads в Production**: Винаги ползвай test Ad Unit ID-та в development. **Никога** не тествай с реални ID-та на емулатор или dev устройство – може да получиш ban от AdMob.
- **Ad frequency**: В момента приложението показва максимум 2 реклами на сесия (старт + край на сектор). Това е балансирано за добър UX.

## 🆘 Troubleshooting

### Рекламите не се показват в production

1. Провери дали AdMob акаунтът е approved и активен
2. Провери дали App ID и Ad Unit ID са правилно въведени
3. Нови Ad Unit ID-та може да отнемат до 1 час докато станат активни
4. Провери AdMob Console за errors/warnings

### "Ad failed to load" грешки

- Нормално е рекламите да не се зареждат 100% от времето (липса на ad inventory, мрежови проблеми и т.н.)
- Кодът е написан да handle тези грешки gracefully – приложението продължава без реклама
- Timeout от 8 секунди - ако рекламата не се зареди, се пропуска

### Premium потребител вижда реклами

- Провери дали `useSubscriptionStore().isPremium` връща `true`
- Провери дали RevenueCat entitlement "premium" е активен
- Провери логовете в конзолата

## 📞 Поддръжка

При въпроси или проблеми:
- Официална документация: [react-native-google-mobile-ads](https://docs.page/invertase/react-native-google-mobile-ads)
- AdMob Help Center: [support.google.com/admob](https://support.google.com/admob)
