Пример интеграции приёма SMS в Android (Kotlin + Headless JS)

Шаги:

1) Добавьте разрешения в `AndroidManifest.xml`:
   - `RECEIVE_SMS`, `POST_NOTIFICATIONS` (Android 13+)

2) Зарегистрируйте `SmsReceiver` как в `AndroidManifest.xml` (пример в `android/app/src/main/AndroidManifest.xml`).

3) Реализуйте `SmsReceiver` и `SmsHeadlessService` (файлы в `android/...`), они передают SMS в Headless JS задачу `SmsBackgroundTask`.

4) В JS/TS части приложения зарегистрируйте задачу:
```js
import { AppRegistry } from 'react-native';
import SmsBackgroundTask from './src/native/SmsBackgroundTask';

AppRegistry.registerHeadlessTask('SmsBackgroundTask', () => SmsBackgroundTask);
```

5) Проверки и особенности:
   - На Android 8+ нужно запускать сервис корректно из фонового режима; HeadlessJsTaskService обеспечивает выполнение JS кода.
   - На многих аппаратах нужно отключать оптимизацию батареи для приложения, чтобы получать SMS в фоне без ограничений.
   - Тестируйте с реальными SMS и после перезагрузки устройства.

6) Безопасность: убедитесь, что вы не отправляете данные на сервер (встроенная политика приложения), запросите только необходимые разрешения.

JDK / сборка APK (macOS)
---------------------------------
Если вы собираете APK локально, установите JDK (рекомендуется OpenJDK 17 или Temurin):

```bash
brew install openjdk@17
sudo ln -sfn /opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk /Library/Java/JavaVirtualMachines/openjdk-17.jdk
echo 'export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"' >> ~/.zshrc
echo 'export JAVA_HOME=$(/usr/libexec/java_home -v 17)' >> ~/.zshrc
source ~/.zshrc
```

Собрать и установить debug APK (скрипт уже добавлен):

```bash
./scripts/build_and_install.sh
```

Если вы предпочитаете GUI, откройте `android/` в Android Studio и соберите APK через Build → Build APK(s).


Запуск на устройстве (debug)
---------------------------------
Сборка требует именно JDK 17 (Gradle 7.5.1 не работает с более новыми JDK); `build_and_install.sh` выставляет `JAVA_HOME` сам.

Также нужны NDK и CMake (их использует `react-native-quick-sqlite`):

```bash
~/Library/Android/sdk/cmdline-tools/latest/bin/sdkmanager "ndk;23.1.7779620" "cmake;3.22.1"
```

База данных на устройстве: `app.db` во внутреннем хранилище приложения; схема создаётся и обновляется миграциями из `src/db/migrations.ts` при первом обращении.

```bash
npx react-native start            # Metro, в отдельном терминале
./scripts/build_and_install.sh    # сборка + установка + выдача разрешений
adb reverse tcp:8081 tcp:8081     # если устройство подключено по USB
```

Для быстрой сборки только под arm64: `cd android && ./gradlew assembleDebug -PreactNativeArchitectures=arm64-v8a`.

Отладка SMS-потока:
- `adb logcat -s SmsReceiver ReactNativeJS` — лог приёмника и headless-задачи
- эмулятор: `adb emu sms send TBC "<текст SMS>"` — отправитель должен быть `TBC`, `TBC SMS` или `TBC BANK`

Чек-лист разрешений: `RECEIVE_SMS`, `POST_NOTIFICATIONS` (Android 13+) — запрашиваются при старте приложения (`src/permissions.ts`). На Xiaomi/Huawei/Samsung дополнительно отключите оптимизацию батареи для приложения.

Релизный APK (для установки на свой телефон)
---------------------------------
```bash
cd android && ./gradlew assembleRelease
# -> android/app/build/outputs/apk/release/app-release.apk (JS встроен, Metro не нужен)
```

Подпись: ключ `~/.android-keys/budgetapp-release.keystore`, пароли — в `~/.gradle/gradle.properties`
(`BUDGETAPP_RELEASE_*`). Оба файла вне репозитория.

**Сохраните резервную копию ключа и пароля.** Обновление ставится только поверх APK с той же подписью.
С другим ключом придётся удалить приложение, а вместе с ним и базу транзакций.

Debug и release подписаны разными ключами: при переходе между ними приложение тоже нужно переустановить (данные удалятся).

Эмулятор
---------------------------------
```bash
./scripts/emulator.sh            # создать/запустить Android 13, поставить release-сборку
./scripts/emulator.sh debug      # то же с debug-сборкой (нужен `npx react-native start`)
```
