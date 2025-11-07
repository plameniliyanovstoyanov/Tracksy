# Xcode Cloud Setup - Fix за автоматичен билд

## Проблем
Билдът фейлва с грешка:
```
Unable to open base configuration reference file '/Volumes/workspace/repository/ios/Pods/Target Support Files/Pods-Tracksy/Pods-Tracksy.release.xcconfig'
```

## Решение

Създадох CI скриптове, които автоматично инсталират зависимостите преди билда.

### Стъпки за оправяне:

1. **CI скриптове са създадени:**
   - `ios/ci_scripts/ci_post_clone.sh` - инсталира Node.js зависимости
   - `ios/ci_scripts/ci_pre_xcodebuild.sh` - инсталира CocoaPods преди билда

2. **Важно:** Уверете се, че Scheme-ът в Xcode Cloud използва `.xcworkspace`, не `.xcodeproj`

3. **В Xcode Cloud Dashboard:**
   - Отидете на вашия workflow
   - Проверете че scheme-ът е `Tracksy` и използва `Tracksy.xcworkspace`

### Проверка:

След като комитнете промените и Xcode Cloud започне нов билд, скриптовете автоматично ще:
1. Инсталират Node.js зависимости (`npm install`)
2. Инсталират CocoaPods зависимости (`pod install`)
3. Проверят че xcconfig файловете са създадени

### Какво прави скриптът `ci_pre_xcodebuild.sh`:

1. **Source-ва `.xcode.env`** за NODE_BINARY конфигурация
2. **Проверява Node.js зависимости** - ако няма `node_modules`, опитва да ги инсталира
3. **Намира и експортира NODE_BINARY** - критично за Expo Podfile който изисква Node.js
4. **Тества Node.js** - проверява дали node може да изпълни командите от Podfile
5. **Инсталира CocoaPods** - с fallback опции при грешки
6. **Верифицира xcconfig файлове** - проверява че Pods са инсталирани правилно

### Ако все още има проблеми:

1. **Проверете Xcode Cloud logs** - там ще видите подробен изход от скриптовете:
   - Кой Node.js е намерен
   - Дали CocoaPods е инсталиран
   - Какви са грешките при `pod install`

2. **Уверете се че в Xcode Cloud workflow използвате:**
   - **Scheme:** `Tracksy`
   - **Workspace:** `Tracksy.xcworkspace` (не `.xcodeproj`!)

3. **Ако виждате грешка "Node.js is required for Expo Podfile but not found":**
   - Xcode Cloud автоматично инсталира Node.js, но може да не е в PATH
   - Скриптът опитва да намери node в различни locations
   - Проверете logs за къде е намерен node (ако е)

4. **Ако `pod install` фейлва:**
   - Скриптът опитва първо с `--repo-update`, после без него
   - При грешка показва подробна диагностика
   - Проверете дали `node_modules` съдържа `expo` пакет (нужен за Podfile)

### Допълнителни проверки:

Ако проблемът продължава, проверете:
- Дали `Podfile.lock` е в git (трябва да е)
- Дали `.gitignore` не игнорира важни файлове
- Дали има правилни permissions на скриптовете
- Дали `node_modules/expo` съществува (Expo Podfile го изисква)

### Debug информация:

Скриптът показва подробна информация в logs:
- ✅ Успешни стъпки
- ⚠️ Предупреждения (не критични)
- ❌ Критични грешки (билдът ще спре)
- 🔍 Диагностична информация

