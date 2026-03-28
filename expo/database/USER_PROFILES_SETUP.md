# Настройка на Профили и История

Системата сега поддържа профили на потребители и история на секторите за всеки профил.

## Стъпки за Setup

### 1. Създаване на таблиците

Изпълнете SQL миграциите в Supabase SQL Editor в следния ред:

#### Миграция 1: User Profiles
```sql
-- Файл: database/migrations/003_create_user_profiles.sql
```
Тази миграция:
- Създава таблица `user_profiles` за допълнителна информация за потребителите
- Автоматично създава профил когато потребител се регистрира
- Настройва Row Level Security (RLS) политики

#### Миграция 2: Violations Table
```sql
-- Файл: database/migrations/004_update_violations_table.sql
```
Тази миграция:
- Създава таблица `violations` за история на секторите
- Свързва violations с `user_id` (аутентифицирани потребители) или `device_id` (анонимни)
- Настройва RLS политики за достъп

### 2. Настройка на OAuth Providers в Supabase

За да работят социалните влезове, трябва да конфигурирате OAuth providers в Supabase:

1. Отидете на **Supabase Dashboard** → **Authentication** → **Providers**
2. Активирайте желаните providers:
   - **Google** - нужни са Client ID и Client Secret от Google Cloud Console
   - **Apple** - нужни са Service ID, Key ID, и Private Key от Apple Developer
   - **Facebook** - нужни са App ID и App Secret от Facebook Developers

#### Google Setup:
1. Създайте проект в [Google Cloud Console](https://console.cloud.google.com)
2. Активирайте Google+ API
3. Създайте OAuth 2.0 Client ID
4. Добавете Redirect URI: `https://ztlyoketfstcsjylvfyq.supabase.co/auth/v1/callback`
5. Копирайте Client ID и Client Secret в Supabase

#### Apple Setup:
1. Отидете на [Apple Developer](https://developer.apple.com)
2. Създайте Service ID
3. Конфигурирайте Sign in with Apple
4. Добавете Redirect URI: `https://ztlyoketfstcsjylvfyq.supabase.co/auth/v1/callback`
5. Генерирайте Key и добавете в Supabase

#### Facebook Setup:
1. Отидете на [Facebook Developers](https://developers.facebook.com)
2. Създайте ново приложение
3. Добавете Facebook Login продукт
4. Конфигурирайте Valid OAuth Redirect URIs
5. Копирайте App ID и App Secret в Supabase

### 3. Тестване

След като всичко е настроено:

1. **Регистрация**: Отворете приложението и кликнете на "Влез с Google/Apple/Facebook"
2. **Проверка на профил**: След влизане, проверете в Supabase Dashboard → Table Editor → `user_profiles`
3. **Тестване на история**: Минете през някой сектор и проверете `violations` таблицата

## Структура на данните

### user_profiles таблица
- `id` (UUID) - референция към `auth.users`
- `email` (TEXT) - email на потребителя
- `full_name` (TEXT) - пълно име
- `avatar_url` (TEXT) - URL на профилна снимка
- `provider` (TEXT) - OAuth provider ('google', 'apple', 'facebook')
- `created_at`, `updated_at`, `last_seen` (TIMESTAMP)

### violations таблица
- `id` (UUID) - уникален идентификатор
- `user_id` (UUID, nullable) - референция към `auth.users` (ако е аутентифициран)
- `device_id` (TEXT, nullable) - device ID (за анонимни потребители)
- `sector_id` (TEXT) - референция към `sectors`
- `sector_name` (TEXT) - име на сектора
- `speed_limit` (INTEGER) - ограничение на скоростта
- `current_speed` (REAL) - средна скорост
- `violation_type` (TEXT) - 'speeding' или 'normal'
- `location` (JSONB) - координати {latitude, longitude}
- `timestamp` (TIMESTAMP) - кога е записано
- `duration` (INTEGER) - продължителност в секунди

## Как работи

1. **Анонимни потребители**: Използват `device_id` за записване на история
2. **Аутентифицирани потребители**: Използват `user_id` за записване на история
3. **История**: Зарежда се от базата данни в `history.tsx` ако потребителят е аутентифициран
4. **Fallback**: Ако няма аутентификация, показва локална история

## Backend Routes

- `users.profile` - получаване на профил на потребител
- `users.violations` - получаване на история на violations за потребител
- `violations.save` - записване на violation (автоматично свързва с user_id ако има)

## Следващи стъпки

- Добавяне на статистики по профили
- Експорт на история
- Споделяне на статистики
- Админ панел за управление на потребители

