# 🍎 Apple OAuth Setup - От нулата

## Стъпка 1: Проверка на Apple Developer Portal

### 1.1. Проверка на Service ID

1. Отиди на [Apple Developer](https://developer.apple.com/)
2. Влез в акаунта си
3. Отиди на **Certificates, Identifiers & Profiles**
4. Кликни на **Identifiers** (вляво)
5. Намери Service ID: `bg.tracksy.app.signin`
6. Ако не го има, създай го:
   - Кликни **+** (Create a new identifier)
   - Избери **Services IDs** → **Continue**
   - Description: `Tracksy Sign In Service`
   - Identifier: `bg.tracksy.app.signin`
   - **Continue** → **Register**

### 1.2. Конфигуриране на Sign in with Apple

1. Кликни на Service ID: `bg.tracksy.app.signin`
2. Маркирай **Sign in with Apple**
3. Кликни **Configure**
4. В **Primary App ID** избери: `bg.tracksy.app` (или твоя App ID)
5. В **Domains and Subdomains** добави:
   ```
   ztlyoketfstcsjylvfyq.supabase.co
   ```
6. В **Return URLs** добави:
   ```
   https://ztlyoketfstcsjylvfyq.supabase.co/auth/v1/callback
   ```
7. Кликни **Save** → **Continue** → **Register**

### 1.3. Проверка на Key

1. Отиди на **Keys** (вляво в менюто)
2. Намери Key: `SA5LZMLW98` (или твоя Key ID)
3. Ако не го има, създай нов:
   - Кликни **+** (Create a new key)
   - Key Name: `Tracksy Sign In Key`
   - Маркирай **Sign in with Apple**
   - **Continue** → **Register**
   - **ВАЖНО**: Кликни **Download** и запази `.p8` файла
   - Копирай **Key ID**

### 1.4. Проверка на Team ID

1. Отиди на **Membership** (горния десен ъгъл)
2. Копирай **Team ID**: `5RQ9CQARF6` (или твоя Team ID)

---

## Стъпка 2: Генериране на JWT токен

### 2.1. Проверка на .p8 файла

1. Провери дали файлът съществува: `C:\Users\PC\Desktop\AuthKey_SA5LZMLW98.p8`
2. Ако не съществува, изтегли го от Apple Developer → Keys

### 2.2. Генериране на JWT

1. Отвори терминала в проекта
2. Изпълни:
   ```bash
   node generate-apple-jwt.js
   ```
3. Копирай **целия JWT токен** (дълъг string, започва с `eyJ...`)

---

## Стъпка 3: Конфигуриране в Supabase Dashboard

### 3.1. Проверка на Site URL

1. Отиди на **Supabase Dashboard** → **Authentication** → **URL Configuration**
2. Провери **Site URL**:
   ```
   https://ztlyoketfstcsjylvfyq.supabase.co
   ```
3. Ако не е правилен, поправи и запази

### 3.2. Проверка на Redirect URLs

1. В същия екран, в секцията **Redirect URLs**
2. Провери дали има:
   - `tracksy://auth/callback`
   - `https://ztlyoketfstcsjylvfyq.supabase.co/auth/v1/callback`
3. Ако липсва втория, добави го:
   - Кликни **Add URL**
   - Добави: `https://ztlyoketfstcsjylvfyq.supabase.co/auth/v1/callback`
   - Запази

### 3.3. Конфигуриране на Apple Provider

1. Отиди на **Authentication** → **Providers**
2. Намери **Apple** и кликни **Configure**
3. Провери/поправи всички полета:
   - **Services ID**: `bg.tracksy.app.signin`
   - **Secret Key**: Постави целия JWT токен (от стъпка 2.2)
   - **Key ID**: `SA5LZMLW98`
   - **Team ID**: `5RQ9CQARF6`
4. Провери **Callback URL** (автоматично):
   ```
   https://ztlyoketfstcsjylvfyq.supabase.co/auth/v1/callback
   ```
5. Кликни **Save**

---

## Стъпка 4: Проверка на кода

### 4.1. Проверка на URL-ите в кода

Всички URL-и в кода трябва да са:
```
https://ztlyoketfstcsjylvfyq.supabase.co
```
(с "j" в домейна)

### 4.2. Рестартиране на приложението

1. Затвори приложението напълно
2. Спри Metro bundler (`Ctrl+C`)
3. Стартирай отново: `npm start`
4. Рестартирай приложението в емулатора

---

## Стъпка 5: Тестване

1. Отвори приложението
2. Кликни "Влез с Apple"
3. Провери конзолата за логове
4. Ако има грешки, провери коя стъпка не е направена правилно

---

## Често срещани проблеми

### Проблем: "Invalid web redirect url"
**Решение**: Провери Return URLs в Apple Developer Portal

### Проблем: "OAuth state parameter missing"
**Решение**: Провери Secret Key в Supabase (трябва да е JWT, не .p8 файл)

### Проблем: "Unable to exchange external code"
**Решение**: Провери Key ID, Team ID и Services ID в Supabase

### Проблем: DNS грешка
**Решение**: Провери Site URL в Supabase Dashboard













