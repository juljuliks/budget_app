# Тесты приложения

Все тесты и их план — здесь. Три вида тестов: логика (Jest), экраны (Jest) и устройство (Maestro и вручную).

## Что где лежит

| Папка | Что там | Чем запускается |
|---|---|---|
| [logic/](logic/) | логика без экранов: парсер SMS, база, категории, план, отчёт, лимиты, курсы, число запросов статистики (`statsQueries`); расчёты экранов (`periodText`, `planView`, `reportView`, `dates`) | Jest, проект `logic` (ts-jest, Node) |
| [screens/](screens/) | тесты экранов: всё приложение на SQLite в памяти, нажатия и тексты | Jest, проект `screens` (React Native Testing Library) |
| [screens/plan/](screens/plan/) | кейсы для Jest, по разделам 1–9 | — |
| [e2e/](e2e/) | Maestro на эмуляторе: только то, что без устройства не проверить | `tests/e2e/run.sh` |
| [e2e/plan/](e2e/plan/) | кейсы на устройстве (Maestro и вручную): разделы 1, 8, 9 | — |
| [e2e/seeds.ts](e2e/seeds.ts) | стартовые базы — общие для экранов и Maestro | — |
| [helpers.ts](helpers.ts) | свежая база в памяти для Jest (`freshDb`) | — |
| [fixtures/](fixtures/) | настоящие SMS банка для парсера | — |

## План тестов

Кейсы по функционалу лежат рядом с тестами, которые их проверяют. У каждого кейса: **Дано** — состояние базы (seed) и
настроек, **Шаги** — действия в приложении, **Ожидается** — что на экране (тексты дословно, `N`, `X ₾` — подставляемые
значения) и что в базе после. Номера кейсов сквозные; кейсы на устройстве — только то, что без Android не проверить, у
каждого строка «Где»: сценарий Maestro или «вручную».

| Раздел | Jest (тесты экранов) | Устройство |
|---|---|---|
| 1. Поступление операций | [screens/plan/1-incoming.md](screens/plan/1-incoming.md) | [e2e/plan/1-incoming.md](e2e/plan/1-incoming.md): приём SMS в фоне, длинное SMS, пуши TBC, импорт и разрешения |
| 2. Операции | [screens/plan/2-operations.md](screens/plan/2-operations.md) | — |
| 3. Мерчанты | [screens/plan/3-merchants.md](screens/plan/3-merchants.md) | — |
| 4. Категории | [screens/plan/4-categories.md](screens/plan/4-categories.md) | — |
| 5. Статистика | [screens/plan/5-stats.md](screens/plan/5-stats.md) | — |
| 6. План | [screens/plan/6-plan.md](screens/plan/6-plan.md) | — |
| 7. Отчёт и история | [screens/plan/7-report.md](screens/plan/7-report.md) | — |
| 8. Уведомления | [screens/plan/8-notifications.md](screens/plan/8-notifications.md) | [e2e/plan/8-notifications.md](e2e/plan/8-notifications.md): кнопка в шторке, тап, холодный старт |
| 9. Общее | [screens/plan/9-general.md](screens/plan/9-general.md) | [e2e/plan/9-general.md](e2e/plan/9-general.md): разрешения при первом запуске, «Назад» Android |

### Какой кейс где проверяется

| Раздел плана | Где |
|---|---|
| 1.1 разбор SMS, 1.6 автокатегория | `sms.test.tsx`; секунды в дате на строке мерчанта — `logic/parserEdgeCases.test.ts`, склейка «Wolt :17» — `logic/migrations.test.ts` |
| 1.2 баланс карты, 1.5 ручная операция, SMS при открытом списке | `incoming.test.tsx` |
| 1.7 «Не распознано», разметка, шаблоны сообщений | `messages.test.tsx`; разбор по шаблону — `logic/messageTemplates.test.ts`, приём — `logic/unparsed.test.ts` |
| 1.1.10, 1.1.17, 1.1.18 приём SMS в фоне, фильтр отправителя, длинное SMS | Maestro `sms-receive` |
| 1.3.1, 1.3.3 пуши банковского приложения | вручную (с эмулятора не отправить уведомление от имени пакета TBC) |
| 1.3.2 пуш и SMS об одной покупке | `logic/smsFlow.test.ts` |
| 1.3.4 баннер доступа к уведомлениям | пока не покрыт (Jest) |
| 1.4.1–1.4.5 импорт SMS из телефона и разрешения | Maestro `import`, `import-denied`, `import-empty` |
| 1.4.6–1.4.7 импорт после живых SMS, возврат раньше покупки | `logic/inboxImport.test.ts` |
| 2.1 список | `operationsList.test.tsx` |
| 2.2–2.4 поиск, фильтры, группировки | `operationsFind.test.tsx` |
| 2.5–2.6 мультивыбор, «Редактировать» | `operationsSelect.test.tsx` |
| 2.7 карточка операции | `transactionSheet.test.tsx`; разделение: что где считается — `logic/splitTransactions.test.ts`, редактор и строка — `logic/splitDraft.test.ts`; список выбора категории — `logic/chooseList.test.ts` |
| 3 мерчанты | `merchants.test.tsx` |
| 4.1–4.4 категории, разделы, объединение, удаление без операций | `categories.test.tsx` |
| 4.5 удаление с операциями: всё в одну, разбор, прерывание | `categoryDelete.test.tsx`, `categories.test.tsx` |
| 5 статистика | `stats.test.tsx`; строки без сумм при закрытом глазе — `logic/hiddenText.test.ts`; раздел «Сбережения» (5.7) — `logic/savingsSection.test.ts`, ссылки на план и историю (5.1.18) — `plan.test.tsx`; «Сбережения меньше на …» по частям (5.6.3) — `logic/savingsLess.test.ts` |
| 5.8 динамика трат: неделя, месяц, страница категории, «Все категории ›», «+N% к обычному» | `trends.test.tsx`; окна, «обычно», графики, «Почему», списки — `logic/trends.test.ts` |
| 6 план | `plan.test.tsx`; MAX пересчёт locked, перенос флага — `logic/plans.test.ts` |
| 6.5 копилки: сделать, карточка, удалить, статистика | `funds.test.tsx`; взнос, месяцы, нехватка, история — `logic/funds.test.ts` |
| 6.7 регулярные платежи: строка в плане, шит «Подписки», добавить (из мерчанта), удалить, вопрос из операции, карточка, откладывание, из шита суммы плана (6.7.9), выключить (6.7.10), свитч «Подписки» категории (6.7.13), каждую неделю и один раз (6.7.2), подписки месяца и предстоящие (6.7.11), операции подписки (6.7.12) | `recurringPayments.test.tsx`; даты списаний — `logic/paymentSchedule.test.ts`, сумма в плане (уже списанная подписка в другой валюте — по курсу дня операции), «Без даты списания» — `logic/recurringPayments.test.ts`, тексты — `logic/paymentTexts.test.ts`; свитч у «Подписок» (4.2.10) — `categories.test.tsx`, откладывание — `logic/paymentSaving.test.ts`; внутри месяца и дата окончания (6.3.6a) — `plan.test.tsx`, `logic/regularPayments.test.ts` |
| 6.6 итоги месяца: окно по шагам, «За месяц» / «Остаток», перенос в октябрь, «История», отчёт после итогов, баннер | `monthClose.test.tsx`; шаги, суммы, остаток, перенос, план и факт — `logic/monthClose.test.ts`; уменьшенные сбережения — `logic/planView.test.ts` |
| 7 отчёт и история | `report.test.tsx`; сбережения месяца — `logic/historySavings.test.ts` |
| 8 уведомления: что в них, кнопки, лимиты, отчёт 1-го | `notifications.test.tsx` |
| 8.1.5–8.1.7 кнопка категории в шторке, тап по уведомлению | Maestro `notification-buttons`, `notification-open` |
| 9.5 шестерёнка: лист «Настройки», версия | `smoke.test.tsx` |
| 9.10 не загрузилось: «Повторить», операции нет, настройка не сохранилась | `failures.test.tsx`; курсы — `logic/fx.test.ts` |
| 9.12 банки: включить BoG, «Балансы карт», фильтр и метка «Банк», банки в импорте SMS | `banks.test.tsx`; банк по отправителю, шаблоны и баланс по банкам, «Между своими картами» — `logic/banks.test.ts`; приём SMS и пушей BoG — на устройстве |
| 9.11 блокировка: включить, вход, выключить, сменить PIN-код, глазик | `lock.test.tsx`; когда спрашивать — `logic/lockTiming.test.ts`; PIN-код при запуске — Maestro `lock-start`; системное окно отпечатка, сворачивание — вручную |
| 8.4 суммы скрыты в уведомлениях | `notifications.test.tsx` |
| 9.9 резервная копия: сохранить, восстановить, CSV | `backup.test.tsx`; файл копии — `logic/backup.test.ts`; системные диалоги — вручную |
| 9.1, 9.6 разрешения при первом запуске, «Назад» Android | вручную |

Логика без экранов (парсер, база, план, отчёт, лимиты) — в `logic/`.

Обозначения полей базы: `transactions(kind, amount_minor, currency, raw_merchant, merchant_key, category_id,
category_source ['rule' | 'user' | NULL], seen_at, note, source ['sms' | 'push'])`, `merchant_rules(match_type, pattern,
category_id)`, `mixed_merchants`, `merchant_categories`, `plan_months`, `plan_items`, `app_settings`.

## Тесты экранов (Jest, без эмулятора)

`screens/`: всё приложение (`<App />`) рендерится через React Native Testing Library на настоящей базе —
SQLite в памяти. Тесты нажимают кнопки, вводят текст, проверяют тексты на экране и строки в базе.

```sh
npm test                                  # всё: логика и экраны (~30 с)
npx jest --selectProjects logic           # только логика
npx jest --selectProjects screens         # только экраны
npx jest --selectProjects screens -t "2.5"  # кейсы раздела
```

- **Seed.** Стартовые базы в [e2e/seeds.ts](e2e/seeds.ts), общие с Maestro: `base`, `ops` (операции), `planned` (бюджет и
  план, прошлый месяц для отчёта), `autoCategory`.
- **Дата.** «Сегодня» — четверг 15.10.2026, 12:00, дальше время идёт (`setup.ts`): темп, недели и «до …» не зависят от
  дня запуска.
- **Подмены.** notifee — мок: тесты проверяют, что приложение передаёт в уведомление. react-native-svg — заглушка.
  Списки рендерят все загруженные строки, следующая страница подгружается по `endReached`.
- **Ошибки.** `console.error` во время теста — провал, как JS-ошибка в logcat.
- **Хелперы** в [screens/app.tsx](screens/app.tsx): `openApp(seed)`, `tap` (ждёт элемент, ищет в верхнем
  открытом листе), `longPress`, `rowOf`, `scrollTo`, `openSettings`, `toggleSwitch`, `texts`.

## Maestro на эмуляторе

`e2e/flows/`: только то, чего без устройства не проверить — приём SMS Kotlin-ресивером в фоне, чтение входящих и
разрешения, уведомления в шторке.

```sh
tests/e2e/run.sh                # все сценарии
tests/e2e/run.sh sms-receive    # один
```

Нужны запущенный эмулятор (образ google_apis: `adb root`) и Maestro (`curl -fsSL https://get.maestro.mobile.dev | bash`).

| сценарий | что проверяет |
|---|---|
| `sms-receive` | SMS при закрытом приложении: банковское принято в фоне (операция, баланс, уведомление), длинное из нескольких частей склеено; с номера телефона и от чужого отправителя — нет |
| `import` | импорт входящих: период, разрешение, «Добавлено 3 операции», повтор — «Новых операций нет» |
| `import-denied` | отказ в разрешении на SMS — «Нет доступа к SMS» |
| `import-empty` | нет SMS банка — «SMS банка не найдены» |
| `notification-buttons` | кнопка категории в развёрнутом уведомлении: категория у операции и мерчанта, уведомление ушло |
| `notification-open` | тап по уведомлению при закрытом приложении открывает операцию |

Каждый сценарий: база из `e2e/seed.ts` подкладывается вместо приложения, `flows/<сценарий>.sh before` делает то, что
Maestro не умеет (SMS через `adb emu sms send`, разрешения, очистка входящих), потом шаги Maestro, потом
`flows/<сценарий>.sh after` (проверка уведомлений через `dumpsys notification`) и проверка базы в `e2e/verify.ts`.
Скриншоты упавшего шага, logcat и база — в `e2e-out/<сценарий>/`.
