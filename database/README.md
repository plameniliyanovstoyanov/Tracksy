# Database Setup

## 🚀 Бърз старт

**Изпълни всички таблици наведнъж:**

1. Отиди на **Supabase Dashboard → SQL Editor**
2. Копирай и изпълни съдържанието на файла: **`database/migrations/000_COMPLETE_SETUP.sql`**
3. Готово! ✅

Това ще създаде всички нужни таблици:
- ✅ `sectors` - секторите
- ✅ `user_profiles` - профили на потребители
- ✅ `violations` - история на секторите
- ✅ `user_settings` - настройки на потребители

## Сектори в базата данни

Секторите сега се зареждат от Supabase базата данни вместо от локалния файл.

## Профили и История

Системата поддържа:
- **Профили на потребители** - регистрация с Google, Apple, Facebook
- **История на секторите** - запазване на история за всеки профил
- **Настройки на потребители** - запазване на настройки в базата

За подробности вижте [USER_PROFILES_SETUP.md](./USER_PROFILES_SETUP.md)

## Стъпки за setup

### 1. Създаване на таблицата

Изпълнете SQL миграцията в Supabase SQL Editor:

```sql
-- Файл: database/migrations/001_create_sectors_table.sql
```

Или копирайте и изпълнете съдържанието на файла в Supabase Dashboard → SQL Editor.

**Важно:** След създаването на таблицата, изпълнете и втората миграция за INSERT policy:

```sql
-- Файл: database/migrations/002_add_insert_policy.sql
```

Това е необходимо за да може seed скриптът да вкарва данни.

### 2. Запълване на данни (Seed)

След като таблицата е създадена, изпълнете seed скрипта:

```bash
# Използвайки tsx (ако е инсталиран)
npx tsx database/seed-sectors.ts

# Или с ts-node
npx ts-node database/seed-sectors.ts

# Със специфични environment variables
SUPABASE_URL=your_url SUPABASE_SERVICE_KEY=your_key npx tsx database/seed-sectors.ts
```

**Важно:** Скриптът използва `SUPABASE_SERVICE_KEY` или `SUPABASE_ANON_KEY` от environment variables. Ако не са зададени, ще използва fallback стойностите от кода.

### 3. Проверка

След запълване, можете да проверите дали секторите са в базата:

**Чрез скрипт (препоръчително):**
```bash
npm run test:sectors
```

**Чрез Supabase Dashboard:**
1. Отвори Table Editor → `sectors`
2. Или използвай SQL Editor:
```sql
SELECT COUNT(*) FROM sectors;
SELECT * FROM sectors LIMIT 5;
```

## Структура на таблицата

Таблицата `sectors` има следната структура:

- `id` (TEXT, PRIMARY KEY) - уникален идентификатор на сектора
- `name` (TEXT) - име на сектора
- `route` (TEXT) - име на пътя/маршрута
- `speed_limit` (INTEGER) - ограничение на скоростта в км/ч
- `distance` (REAL) - разстояние в километри
- `description` (TEXT) - описание
- `start_point_lat`, `start_point_lng` (REAL) - координати на началната точка
- `start_point_name` (TEXT) - име на началната точка
- `start_point_km` (REAL, nullable) - километраж на началната точка
- `end_point_lat`, `end_point_lng` (REAL) - координати на крайната точка
- `end_point_name` (TEXT) - име на крайната точка
- `end_point_km` (REAL, nullable) - километраж на крайната точка
- `active` (BOOLEAN) - дали секторът е активен
- `created_at`, `updated_at` (TIMESTAMP) - автоматични timestamp-и

## Fallback механизъм

Ако базата данни не е достъпна или таблицата е празна, системата автоматично ще използва данните от `data/sectors.ts` като fallback. Това гарантира, че приложението ще работи дори и без база данни.

## Обновяване на сектори

За да обновите секторите в базата:

1. Редактирайте данните в `data/sectors.ts`
2. Изпълнете seed скрипта отново (той използва `upsert`, така че ще обнови съществуващите записи)

Или можете ръчно да редактирате записите в Supabase Dashboard.

