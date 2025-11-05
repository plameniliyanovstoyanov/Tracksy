# Mapbox Native SDK Migration Guide

## Преминаване от Mapbox GL JS (WebView) към @rnmapbox/maps (Native SDK)

### Предимства
- ✅ **25,000 Monthly Active Users** безплатно (вместо 50,000 Map Loads)
- ✅ По-добра производителност (native rendering)
- ✅ По-малко батерия (оптимизирано за mobile)
- ✅ По-добра интеграция с React Native

### Какво е променено

1. **Package.json**: Добавен `@rnmapbox/maps`
2. **iOS Configuration**:
   - Добавен `MBXAccessToken` в `Info.plist`
   - Добавен `import MapboxMaps` в `AppDelegate.swift`
   - Инициализация на Mapbox в `didFinishLaunchingWithOptions`
   - Добавени `pre_install` и `post_install` hooks в `Podfile`

3. **Android Configuration**:
   - Добавен Mapbox Maven repository в `build.gradle`
   - Добавен `MAPBOX_DOWNLOADS_TOKEN` в `gradle.properties`
   - **ВАЖНО**: Трябва да зададеш **secret token** (не public token!)

4. **MapView Component**: Преписан за native SDK

### Стъпки за инсталация

#### 1. Инсталирай зависимостите
```bash
npm install
# или
yarn install
```

#### 2. iOS Setup
```bash
cd ios
pod install
cd ..
```

**ВАЖНО**: Трябва да зададеш `MAPBOX_DOWNLOADS_TOKEN` в `.netrc` файл за CocoaPods:
```
machine api.mapbox.com
login mapbox
password YOUR_SECRET_TOKEN_HERE
```

#### 3. Android Setup

**ВАЖНО**: Трябва да получиш **Secret Token** (не public token):
1. Отиди на https://account.mapbox.com/access-tokens/
2. Създай нов **Secret Token** (ск.eyJ...)
3. Добави го в `android/gradle.properties`:
   ```
   MAPBOX_DOWNLOADS_TOKEN=sk.eyJ1Ijoi...
   ```

#### 4. Ребилд проекта
```bash
# iOS
npx expo run:ios

# Android
npx expo run:android
```

### Разлики в API

#### Старо (WebView):
```typescript
const map = new mapboxgl.Map({...});
map.on('load', () => {...});
```

#### Ново (Native):
```typescript
<MapboxMapView
  ref={mapRef}
  onDidFinishLoadingMap={() => {...}}
>
  <Camera ref={cameraRef} />
</MapboxMapView>
```

### Проблеми и решения

#### Проблем: "Mapbox token not found"
**Решение**: Провери дали `MBXAccessToken` е в `Info.plist` и `Mapbox.setAccessToken()` се вика преди рендериране.

#### Проблем: Android build fails с "401 Unauthorized"
**Решение**: Уверете се че използваш **Secret Token** (sk.eyJ...), не public token (pk.eyJ...)

#### Проблем: iOS pod install fails
**Решение**: Добави `.netrc` файл с secret token за CocoaPods.

### Следващи стъпки

1. Тествай на iOS и Android устройства
2. Провери дали всички сектори се показват правилно
3. Тествай user location tracking
4. Тествай auto-center функционалността
5. Провери дали маркерите (start/end) се показват

### Документация

- [@rnmapbox/maps Docs](https://rnmapbox.github.io/docs/)
- [Mapbox iOS SDK](https://docs.mapbox.com/ios/maps/guides/)
- [Mapbox Android SDK](https://docs.mapbox.com/android/maps/guides/)

