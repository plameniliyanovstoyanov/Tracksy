# Xcode Cloud CI Scripts

Тези скриптове се изпълняват автоматично от Xcode Cloud по време на билд процеса.

## Скриптове

### `ci_post_clone.sh`
Изпълнява се след клониране на репозиторията.
- Инсталира Node.js зависимости (`npm install`)
- Не е критично ако фейлне - продължава

### `ci_pre_xcodebuild.sh`
Изпълнява се преди Xcode build процеса.
- Инсталира CocoaPods зависимости (`pod install`)
- Критично - трябва да успее за да може билдът да продължи

## Troubleshooting

Ако скриптовете фейлват:

1. Проверете logs в Xcode Cloud - там ще видите точно какво е проблемът
2. Уверете се че `CI_WORKSPACE` environment variable е наличен
3. Проверете че Podfile и package.json са на правилните места
4. Ако npm не е наличен, това не е проблем - CocoaPods може да работи без него

## Забележки

- Скриптовете трябва да имат executable permissions (automatic в git)
- Използват `set -e` за критични стъпки, но `set +e` за опционални
- Всички пътища са relative към `CI_WORKSPACE`

