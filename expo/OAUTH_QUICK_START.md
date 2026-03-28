# OAuth Quick Start - Google & Facebook

## Бързо ръководство за активиране на OAuth

### ✅ Стъпка 1: Google OAuth

1. **Google Cloud Console** → [Създай OAuth Client](https://console.cloud.google.com/apis/credentials)
   - Application type: **Web application**
   - Authorized redirect URI: 
     ```
     https://ztlyoketfstcsjylvfyq.supabase.co/auth/v1/callback
     ```
   - Копирай **Client ID** и **Client Secret**

2. **Supabase Dashboard** → Authentication → Providers → **Google**
   - Enable Google
   - Въведи Client ID и Client Secret
   - Save

### ✅ Стъпка 2: Facebook OAuth

1. **Facebook Developers** → [Създай App](https://developers.facebook.com/apps/)
   - Добави **Facebook Login** продукт
   - Settings → Basic → копирай **App ID** и **App Secret**
   - Facebook Login → Settings → Valid OAuth Redirect URIs:
     ```
     https://ztlyoketfstcsjylvfyq.supabase.co/auth/v1/callback
     ```

2. **Supabase Dashboard** → Authentication → Providers → **Facebook**
   - Enable Facebook
   - Въведи App ID и App Secret
   - Save

### ✅ Стъпка 3: Тествай

1. Стартирай приложението
2. Кликни "Влез с Google" или "Влез с Facebook"
3. Трябва да се отвори браузър за авторизация
4. След успех, трябва да се върнеш в приложението

## ⚠️ Често срещани проблеми

**"Redirect URI mismatch"**
- Провери че redirect URI е точно същият навсякъде
- В Google/Facebook: `https://ztlyoketfstcsjylvfyq.supabase.co/auth/v1/callback`
- В Supabase: автоматично се попълва

**"OAuth provider not configured"**
- Провери че provider-ът е Enabled в Supabase
- Провери че Client ID/Secret са правилно копирани

**Не се връща в приложението**
- Провери че scheme "myapp" е конфигуриран (вече е в app.config.js)
- Провери Info.plist за CFBundleURLSchemes

## 📝 Забележки

- Redirect URL трябва да е **точно** същият навсякъде
- За production може да се наложи да добавиш допълнителни redirect URIs
- Facebook App може да е в "Development Mode" - за production трябва да го одобриш

За подробни инструкции виж [OAUTH_SETUP.md](./OAUTH_SETUP.md)

