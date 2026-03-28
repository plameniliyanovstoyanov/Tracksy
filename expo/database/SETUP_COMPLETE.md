# Пълна настройка на базата данни

## Стъпки за създаване на всички таблици

Отиди на **Supabase Dashboard → SQL Editor** и изпълни следните SQL скриптове **в този ред**:

### 1. Сектори (Sectors)
```sql
-- Файл: database/migrations/001_create_sectors_table.sql
```
Изпълни съдържанието на файла `database/migrations/001_create_sectors_table.sql`

### 2. INSERT Policy за сектори
```sql
-- Файл: database/migrations/002_add_insert_policy.sql
```
Изпълни съдържанието на файла `database/migrations/002_add_insert_policy.sql`

### 3. Потребителски профили (User Profiles)
```sql
-- Файл: database/migrations/003_create_user_profiles.sql
```
Изпълни съдържанието на файла `database/migrations/003_create_user_profiles.sql`

### 4. История на нарушения (Violations)
```sql
-- Файл: database/migrations/004_update_violations_table.sql
```
Изпълни съдържанието на файла `database/migrations/004_update_violations_table.sql`

### 5. Настройки на потребители (User Settings) ⭐ НОВО
```sql
-- Файл: database/migrations/005_create_user_settings.sql
```
Изпълни съдържанието на файла `database/migrations/005_create_user_settings.sql`

## Проверка

След като изпълниш всички миграции, отиди на **Supabase Dashboard → Table Editor** и трябва да видиш:

- ✅ `sectors` - секторите
- ✅ `user_profiles` - профили на потребители
- ✅ `violations` - история на секторите
- ✅ `user_settings` - настройки на потребители

## Seed данни

След като създадеш таблиците, можеш да запълниш секторите:

```bash
npm run seed:sectors
```

## Важно

Ако виждаш грешка "JSON Parse error: Unexpected character: <", това означава че:
1. Таблицата не съществува
2. Или RLS политиките блокират достъпа

Увери се че всички миграции са изпълнени!


