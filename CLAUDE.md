# Budget — заметки для Claude

Личный бюджет на Android: React Native 0.71 + TypeScript, SQLite на устройстве, notifee, react-navigation; Kotlin —
приём SMS и пушей банка TBC. Описание и карта папок — [README.md](README.md), термины интерфейса — [GLOSSARY.md](GLOSSARY.md).

## Правила работы

- Отвечать по-русски. Код, комментарии и сообщения коммитов — по-английски, в стиле соседнего кода.
- Коммитить и пушить только по просьбе («пуш»).
- Начало работы (первый запрос в сессии или после паузы) — сначала `git fetch` и, если `origin/main` впереди,
  `git pull --rebase --autostash`: в репозиторий пушат и из других сессий. Конфликт — разобрать и сказать, что пришло.
- На телефон (USB, serial `00021157R000924`) приложение не ставить — только дать команду `adb -s 00021157R000924 install -r …`.
  Эмулятор (`emulator-5554`, AVD `budget_pixel`) — можно.
- Никогда не удалять приложение (`adb uninstall`, `pm clear`): пропадут данные — только `install -r`.
- Пользователь правит код между ходами: перед правкой перечитывать файл.
- Тексты интерфейса — по GLOSSARY.md (одно слово на одно понятие).
- Код в `src/` — по [ARCHITECTURE.md](ARCHITECTURE.md) (слои FSD-lite, импорты вниз, файл ≤ 250 строк): перед новым
  файлом, компонентом или переносом — скилл `architecture`. Проверка — `npm run lint` (ошибка — и релиз не соберётся).
- После любой фичи, фикса или смены текстов, до слов «готово» — скилл `finish`: глоссарий, IMPROVEMENTS.md, README,
  план тестов и тесты, архитектура, публичная документация.

## Команды

```sh
npm test                                        # весь Jest (~30 с): logic + screens
npx jest --selectProjects logic                 # логика: парсер, база, план, отчёт (ts-jest, node)
npx jest --selectProjects screens tests/screens/stats.test.tsx -t "5.1"   # один файл / кейсы раздела
npx tsc --noEmit -p .                           # типы
npm run lint                                    # ESLint: размеры файлов и границы слоёв (ARCHITECTURE.md)
npm run emulator                                # release-сборка и установка на эмулятор (JDK 17 сам)
tests/e2e/run.sh [flow ...]                     # Maestro на эмуляторе — см. скилл maestro
```

Gradle — только JDK 17: `JAVA_HOME=$(/usr/libexec/java_home -v 17)` (по умолчанию в системе Java 27).
Длинные прогоны тестов — через агента `test-runner`: он вернёт только упавшие.

## Тесты

- Всё в `tests/`: `logic/`, `screens/`, `e2e/`; что где, план и карта покрытия — [tests/README.md](tests/README.md).
- Кейсы плана по разделам: для Jest — `tests/screens/plan/N-*.md`, на устройстве — `tests/e2e/plan/N-*.md`; какой
  кейс в каком файле теста — карта в tests/README.md. Читать только нужный раздел.
- **screens** (`tests/screens/*.test.tsx`): весь `<App />` через RNTL на SQLite в памяти (better-sqlite3,
  `driver` замаплен на `src/db/driver.ts`). «Сегодня» — чт 15.10.2026 12:00, время идёт (`setup.ts`).
  `console.error` в тесте — провал. Списки без виртуализации.
- Хелперы в `tests/screens/app.tsx`: `openApp(seed)`, `tap(text | /re/ | '#testId')` — ждёт элемент и ищет в
  верхнем открытом BottomSheet, `longPress`, `rowOf`, `scrollTo(testId, text)`, `openSettings`, `toggleSwitch`, `texts()`.
- Seed'ы общие с Maestro: `tests/e2e/seeds.ts` (`base`, `empty`, `ops`, `planned`, `autoCategory`, `buy`, `rule`,
  `category`, `on`, `at`, `daysAgo`, `done()`).
- Проверки — по тексту; testID — только для неоднозначных тапов. Перед ₾ — неразрывный пробел; тост ошибки
  начинается с «⚠️  ».
- Maestro — только то, что Jest не может: приём SMS ресивером, импорт входящих и разрешения, уведомления в шторке.

## Где что

- `src/screens/operations/` — вкладка «Операции»: экран из хуков (`model/`: список, выбор, массовая категория, маршрут,
  вкладка) и частей (`parts/`); фильтры — `src/features/operations-filters/`, разбор при удалении категории —
  `src/features/category-delete/` (`useSortOut`).
- `src/shared/navigation/leaveGuard.ts` — вопрос перед уходом с экрана (разбор категории): таб-бар, шестерёнка, стрелка дня.
- `src/db/` — миграции и запросы; `src/db/report.ts` — отчёт (только для месяцев с планом, `hasMonthPlan`).
- `android/app/src/main/java/com/budgetapp/` — `SmsReceiver`, `BankPushListener` (пакет с «tbc», title + text → парсер SMS).
