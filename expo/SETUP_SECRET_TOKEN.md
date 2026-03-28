# Настройка на Mapbox Secret Token

## Проблем
Secret токените в Mapbox се скриват след създаване за сигурност. Трябва да създадеш нов и веднага да го копираш.

## Стъпки

### 1. Създай нов Secret Token

1. Отиди на https://account.mapbox.com/access-tokens/
2. Кликни на синия бутон **"+ Create a token"**
3. Въведи име: `Tracksy Secret Token` (или друго име)
4. Избери scope: **Downloads:Read** (трябва да е checked)
5. Кликни **"Create token"**
6. **ВАЖНО**: Веднага копирай токена! Той започва с `sk.eyJ...` и ще се скрие след като напуснеш страницата.

### 2. Добави токена в Android

Отвори `android/gradle.properties` и обнови:
```properties
MAPBOX_DOWNLOADS_TOKEN=sk.eyJ1Ijoi... (твоя нов secret token)
```

### 3. Добави токена в .netrc за iOS (CocoaPods)

Създай или редактирай `.netrc` файл:

**Windows**: `C:\Users\PC\.netrc`
**Mac/Linux**: `~/.netrc`

Съдържание:
```
machine api.mapbox.com
login mapbox
password sk.eyJ1Ijoi... (твоя нов secret token)
```

**Забележка**: Ако файлът не съществува, създай го. Уверете се че няма разширение (.txt).

### 4. Ребилд проекта

```bash
# iOS
cd ios
pod install
cd ..
npx expo run:ios

# Android
npx expo run:android
```

## Разлика между токените

- **Public Token** (`pk.eyJ...`): Използва се в клиента (app) за достъп до Mapbox API
- **Secret Token** (`sk.eyJ...`): Използва се в build процеса за изтегляне на native SDK dependencies

## Security

⚠️ **ВАЖНО**: 
- Secret токенът НИКОГА не трябва да се комитва в Git
- Добави `.netrc` в `.gitignore`
- Добави `android/gradle.properties` в `.gitignore` ако има secret токен там

## Troubleshooting

### Ако забравиш токена:
Създай нов secret token и обнови конфигурацията.

### Ако Android build fail-ва с 401:
- Провери дали `MAPBOX_DOWNLOADS_TOKEN` в `gradle.properties` е правилен
- Уверете се че започва с `sk.eyJ...` (не `pk.eyJ...`)

### Ако iOS pod install fail-ва:
- Провери дали `.netrc` файлът е правилно форматиран
- Уверете се че няма разширение (.txt)
- Уверете се че token-ът започва с `sk.eyJ...`

