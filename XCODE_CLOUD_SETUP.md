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

### Ако все още има проблеми:

1. Проверете Xcode Cloud logs - там ще видите изхода от скриптовете
2. Уверете се че в Xcode Cloud workflow използвате:
   - **Scheme:** `Tracksy`
   - **Workspace:** `Tracksy.xcworkspace` (не `.xcodeproj`!)

3. Може да се наложи да добавите в Xcode Cloud Environment Variables:
   - `NODE_BINARY` - път към node executable

### Допълнителни проверки:

Ако проблемът продължава, проверете:
- Дали `Podfile.lock` е в git (трябва да е)
- Дали `.gitignore` не игнорира важни файлове
- Дали има правилни permissions на скриптовете

