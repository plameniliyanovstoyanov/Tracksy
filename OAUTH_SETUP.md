# Настройка на OAuth Login (Google & Facebook)

**Кодът е готов!** Трябва само да настроиш OAuth providers в Supabase и да създадеш credentials в Google Cloud Console и Facebook Developers.

## Стъпка 1: Google OAuth Setup

### 1.1. Създаване на Google OAuth Credentials

1. Отиди на [Google Cloud Console](https://console.cloud.google.com/)
2. Създай нов проект или избери съществуващ
3. Отиди на **APIs & Services** → **Credentials**
4. Кликни **Create Credentials** → **OAuth client ID**
5. Ако те пита за OAuth consent screen:
   - Избери **External** (или Internal ако използваш Google Workspace)
   - Попълни App name: `Tracksy`
   - Добави Support email
   - Save and Continue
   - Добави scopes: `email`, `profile`, `openid`
   - Save and Continue
   - Добави test users (ако е External)
   - Save and Continue
6. Създаване на OAuth Client:
   - **Application type**: Web application
   - **Name**: Tracksy Web Client
   - **Authorized redirect URIs**: 
     ```
     https://ztlyoketfstcsjylvfyq.supabase.co/auth/v1/callback
     ```
   - **Authorized JavaScript origins** (optional):
     ```
     https://ztlyoketfstcsjylvfyq.supabase.co
     ```
7. Кликни **Create**
8. Копирай **Client ID** и **Client Secret**

### 1.2. Конфигуриране в Supabase

1. Отиди на [Supabase Dashboard](https://supabase.com/dashboard)
2. Избери проекта си (Tracsy)
3. Отиди на **Authentication** → **Providers** (или **Auth** → **Providers**)
4. Намери **Google** и кликни **Enable** или toggle switch-а
5. Въведи:
   - **Client ID (for OAuth)**: твоя Google Client ID (от Google Cloud Console)
   - **Client Secret (for OAuth)**: твоя Google Client Secret (от Google Cloud Console)
6. **Redirect URL** (автоматично се попълва):
   ```
   https://ztlyoketfstcsjylvfyq.supabase.co/auth/v1/callback
   ```
7. Кликни **Save**

**Важно:** Redirect URL-ът трябва да е точно същият в Google Cloud Console и в Supabase!

## Стъпка 2: Facebook OAuth Setup

### 2.1. Създаване на Facebook App

1. Отиди на [Facebook Developers](https://developers.facebook.com/)
2. Кликни **My Apps** → **Create App**
3. Избери **Consumer** като тип на приложението
4. Попълни:
   - **App Display Name**: Tracksy
   - **App Contact Email**: твоя email
   - **Business Account** (optional)
5. Кликни **Create App**

### 2.2. Добавяне на Facebook Login

1. В **Product Setup**, намери **Facebook Login**
2. Кликни **Set Up**
3. Избери **Web** като платформа
4. В **Settings** → **Basic**:
   - **App ID**: Копирай го (ще го използваме)
   - **App Secret**: Кликни **Show** и копирай го
5. В **Settings** → **Basic**, добави:
   - **App Domains**: `ztlyoketfstcsjylvfyq.supabase.co`
6. В **Facebook Login** → **Settings**:
   - **Valid OAuth Redirect URIs**: 
     ```
     https://ztlyoketfstcsjylvfyq.supabase.co/auth/v1/callback
     ```
   - **Deauthorize Callback URL**: (optional)
   - **Data Deletion Request URL**: (optional)
7. Кликни **Save Changes**

### 2.3. Конфигуриране в Supabase

1. В Supabase Dashboard → **Authentication** → **Providers**
2. Намери **Facebook** и кликни **Enable** или toggle switch-а
3. Въведи:
   - **App ID**: твоя Facebook App ID (от Facebook Developers)
   - **App Secret**: твоя Facebook App Secret (от Facebook Developers)
4. **Redirect URL** (автоматично се попълва):
   ```
   https://ztlyoketfstcsjylvfyq.supabase.co/auth/v1/callback
   ```
5. Кликни **Save**

**Важно:** Redirect URL-ът трябва да е точно същият в Facebook Developers и в Supabase!

## Стъпка 3: Тестване

### 3.1. Тест в приложението

1. Стартирай приложението
2. Отиди на Login screen
3. Кликни **"Влез с Google"** или **"Влез с Facebook"**
4. Трябва да се отвори браузър/външна страница за авторизация
5. След успешна авторизация, трябва да се върнеш в приложението

### 3.2. Проверка в Supabase

1. Отиди на **Authentication** → **Users**
2. Трябва да видиш нов потребител с email от Google/Facebook
3. Провери **user_profiles** таблицата - трябва да има нов запис

## Стъпка 4: Apple OAuth (Optional)

Ако искаш да добавиш и Apple Sign In (само за iOS):

### 4.1. Създаване на Service ID в Apple Developer

1. Отиди на [Apple Developer](https://developer.apple.com/)
2. Влез в акаунта си
3. Отиди на **Certificates, Identifiers & Profiles**
4. Вляво кликни на **Identifiers**
5. Кликни **+** (Create a new identifier)
6. Избери **Services IDs** и кликни **Continue**
7. Попълни:
   - **Description**: `Tracksy Sign In Service`
   - **Identifier**: `bg.tracksy.app.signin` (или подобно, уникално)
8. Кликни **Continue** → **Register**

### 4.2. Конфигуриране на Sign in with Apple

1. След като създадеш Service ID, кликни върху него
2. Маркирай **Sign in with Apple**
3. Кликни **Configure**
4. В **Primary App ID** избери `bg.tracksy.app`
5. В **Website URLs** → **Domains and Subdomains**:
   - Добави: `ztlyoketfstcsjylvfyq.supabase.co`
6. В **Return URLs**:
   - Добави: `https://ztlyoketfstcsjylvfyq.supabase.co/auth/v1/callback`
7. Кликни **Save** → **Continue** → **Register**

### 4.3. Създаване на Key за Sign in with Apple

1. В **Certificates, Identifiers & Profiles** → **Keys**
2. Кликни **+** (Create a new key)
3. Попълни:
   - **Key Name**: `Tracksy Sign In Key`
   - Маркирай **Sign in with Apple**
4. Кликни **Continue** → **Register**
5. **Важно**: Кликни **Download** и запази `.p8` файла (ще го използваш)
6. Копирай **Key ID** (ще го използваш в Supabase)

### 4.4. Конфигуриране в Supabase

1. Отиди на **Supabase Dashboard** → **Authentication** → **Providers**
2. Намери **Apple** и кликни **Configure**
3. Въведи:
   - **Services ID**: `bg.tracksy.app.signin` (от стъпка 4.1)
   - **Secret Key**: Отвори `.p8` файла в text editor и копирай цялото съдържание (включително `-----BEGIN PRIVATE KEY-----` и `-----END PRIVATE KEY-----`)
   - **Key ID**: Копирай Key ID от стъпка 4.3
   - **Team ID**: Намери го в Apple Developer → Membership (в горния десен ъгъл)
4. **Redirect URL** (автоматично се попълва):
   ```
   https://ztlyoketfstcsjylvfyq.supabase.co/auth/v1/callback
   ```
5. Кликни **Save**

**Важно:** 
- Apple Sign In работи **само на iOS устройства**
- В Android версията бутонът не се показва (виж `app/login.tsx`)
- Private Key (`.p8` файлът) можеш да го видиш само веднъж - ако го загубиш, трябва да създадеш нов

## Troubleshooting

### Проблем: "Redirect URI mismatch"

**Решение**: Уверете се че redirect URI в Google/Facebook точно съвпада с:
```
https://ztlyoketfstcsjylvfyq.supabase.co/auth/v1/callback
```

### Проблем: "OAuth provider not configured"

**Решение**: Проверете че provider-ът е enabled в Supabase Dashboard

### Проблем: "Invalid client"

**Решение**: Проверете че Client ID и Client Secret са правилно копирани

### Проблем: Не се връща в приложението след login

**Решение**: Проверете че `getRedirectUrl()` в `lib/supabase.ts` връща правилния URL за вашата платформа

## Важни забележки

1. **Redirect URI трябва да е точно същият** в Google/Facebook и в Supabase
2. **Client Secret** не трябва да се споделя публично - само в Supabase Dashboard
3. За **production**, може да се наложи да добавиш допълнителни redirect URIs
4. **Facebook App** може да е в "Development Mode" - за production трябва да го одобриш

## Допълнителни настройки

### За Production

- Google: Добави production domain в Authorized redirect URIs
- Facebook: Преминаване от Development към Live режим
- Проверка на Privacy Policy и Terms of Service URLs

### Security

- Редовно обновяване на OAuth credentials
- Използване на App Passwords ако е необходимо
- Мониторинг на OAuth usage в Google Cloud Console / Facebook Developers

