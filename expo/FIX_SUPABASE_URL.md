# 🔧 Поправка на Supabase URL конфигурация

## Проблем
Apple login не работи, защото Supabase генерира неправилен OAuth URL (липсва "z" в началото на домейна).

## Решение

### Стъпка 1: Поправи Site URL в Supabase

1. Отиди на **Supabase Dashboard**: https://supabase.com/dashboard
2. Избери проекта си
3. Отиди на **Authentication** → **URL Configuration**
4. В полето **Site URL** поправи на:
   ```
   https://ztlyoketftsciylvfq.supabase.co
   ```
   ⚠️ **ВАЖНО**: Трябва да е точно с `.supabase.co` в края!
5. Кликни **Save changes**

### Стъпка 2: Добави Callback URL в Redirect URLs

1. В същия екран, в секцията **Redirect URLs**
2. Кликни зеления бутон **Add URL**
3. Добави точно този URL:
   ```
   https://ztlyoketftsciylvfq.supabase.co/auth/v1/callback
   ```
4. Запази

### Стъпка 3: Проверка

След промените, в **Redirect URLs** трябва да имаш:
- ✅ `tracksy://auth/callback` (вече го имаш)
- ✅ `https://ztlyoketftsciylvfq.supabase.co/auth/v1/callback` (трябва да добавиш)

### Стъпка 4: Рестартирай приложението

1. Затвори приложението напълно
2. В терминала натисни `Ctrl+C` за да спреш `npm start`
3. Стартирай отново: `npm start`
4. Рестартирай приложението в емулатора/телефона

### Стъпка 5: Тествай

1. Опитай Apple login отново
2. Провери конзолата за логове
3. Ако все още има проблем, провери логовете:
   - `🔗 Redirect URL (Supabase callback):` - трябва да е правилен
   - `🌐 Opening Apple OAuth URL:` - провери дали URL-ът е правилен

## Защо се случва това?

Supabase генерира OAuth URL-ите на базата на **Site URL** в конфигурацията. Ако там е неправилно (без `.supabase.co` или с опечатка), Supabase ще генерира неправилен URL, който води до DNS грешка.

## Допълнителни проверки

### Apple Developer
Уверете се че в **Apple Developer** → **Service ID** → **Configure** → **Return URLs** има:
```
https://ztlyoketftsciylvfq.supabase.co/auth/v1/callback
```

### Google Cloud Console
Уверете се че в **Google Cloud Console** → **OAuth Client** → **Authorized redirect URIs** има:
```
https://ztlyoketftsciylvfq.supabase.co/auth/v1/callback
```

