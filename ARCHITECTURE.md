# Архитектура кода

Цель — понятно, куда класть файл, импорты идут в одну сторону, нет длинных файлов. Подход — упрощённый
Feature-Sliced Design (FSD-lite): без слоёв processes и widgets — для приложения на 4 вкладки они лишние.

Часть 1 — правила: их проверяет `npm run lint` (`eslint.config.js`; свои правила — лимит хука, доступность — в
`eslint-rules/`), ошибка останавливает релиз в CI. Предупреждения — строгий TypeScript (typescript-eslint
recommended-type-checked) и доступность: их список на начало рефакторинга — `docs/refactor/lint-baseline.txt`, правило
становится ошибкой, когда его список пуст ([REFACTOR_PLAN.md](REFACTOR_PLAN.md)). Файлы, которые после Prettier
вышли за размеры, — список `OVERSIZE` в `eslint.config.js` (предупреждения до деления на этапе 5; новые туда не
добавляются). Формат — Prettier (`npm run format`, ширина 120), CI проверяет. Часть 2 — как код перешёл на эти слои
(история).

## 1. Правила

### Слои

```
src/
  app/        App, вкладки, стартовые эффекты, хосты (ModalHost), кнопка настроек
  screens/    вкладки и страницы: operations/, stats/, merchants/, categories/, settings/, … — только сборка из частей
  features/   сценарии пользователя: действие в несколько шагов, с вопросами и последствиями
  entities/   transaction/, category/, merchant/, plan/ — показать, выбрать, просто изменить одну вещь
  shared/     ui/ (кит без знания о бюджете), lib/ (format, money, dates, хуки), theme/,
              navigation/ (navigationRef, страницы: openTransaction / openMerchant / openCategory, хуки переходов,
                           sheets.ts — открыть шит откуда угодно, leaveGuard)
              settings/ (хуки над настройками: валюта показа, «скрыть суммы»)
  ядро, без React, по доменам:
  db/          база: миграции и запросы (plans/, transactions/, spending.ts — что считается тратой)
  domain/      общие основы: виды операций (types), банки (banks), палитра категорий (colors), сигнал «данные изменились» (events)
  ingest/      приём SMS и пушей: разбор, дубли по хешу, запись
  parsers/     разбор SMS банка, чистка имени мерчанта
  importer/    импорт SMS из телефона
  backup/      резервная копия базы (VACUUM INTO), проверка файла перед восстановлением, автокопия (когда пора), CSV
  categorize/  правила мерчантов и назначение категорий
  stats/       лимиты по ритму (norms), динамика трат: «обычно» по те же дни (trends)
  fx/          курсы НБГ
  update/      последний релиз на GitHub, сравнение версий («Обновить»)
  notifications/, native/   уведомления (и о лимитах), Android: SMS, пуши, разрешения — только здесь react-native
```

**Куда класть:**

| Что это | Слой | Пример |
|---|---|---|
| Кнопка, шит, чип, календарь — не знает про операции и категории | `shared/ui` | `Button`, `BottomSheet`, `RangeCalendar` |
| Чистая функция или хук без бизнес-смысла | `shared/lib` | `format`, `money`, `dates`, `useLatestRequest`, `useStableCallback` |
| Показать, выбрать или просто изменить одну сущность, без сценария | `entities/<сущность>` | `TransactionItem`, `CategoryPickerModal`, `CategoryView`, `RecentOperations` |
| Действие пользователя в несколько шагов | `features/<действие>` | удалить категорию с разбором, мерчант (правило: `MerchantView`), объединить, импорт SMS |
| Вкладка и её части, которые нигде больше не нужны | `screens/<вкладка>/parts` | заголовок раздела операций, строка категории статистики |
| Корень приложения: стек, вкладки, хосты, старт | `app` | `App.tsx`, `MainTabs`, `ModalHost`, `useAppStartup` |
| Переходы и открытие шитов — нужны всем слоям, без UI | `shared/navigation` | `navigation.ts`, `sheets.ts`, `leaveGuard.ts` |
| Запросы к БД, расчёты, парсеры, уведомления | ядро, свой домен | `db/plans/`, `stats/norms.ts`, `parsers/tbc.ts` |
| Хук над настройкой (валюта, «скрыть суммы») | `shared/settings` | `useDisplayCurrency`, `useHideAmounts` |

Сомнение «entity или feature» решает вопрос: есть ли шаги, подтверждения или последствия для других данных?
Да — feature. Простая форма своей сущности (создать или изменить категорию, раздел) — entity; удаление с разбором,
правило мерчанта, меняющее прошлые операции, — feature. Сомнение «feature или часть экрана» — нужна ли она больше чем
в одном месте? Нет — `screens/*/parts`.

Когда нижнему слою нужно то, что выше, — не импорт, а:
- проп-колбэк: `CategorySheet` (entity) получает `onDelete`, удаление с разбором (feature) передаёт экран;
- страница или шит через `shared/navigation`: `TransactionView` открывает страницу мерчанта `openMerchant(…)`, её
  собирает `screens/merchant`; формы — шиты через `sheets.ts`, их рисует `ModalHost`.

**Страницы и шиты.** Продуктовые сущности — страницы стека (`screens/operation`, `merchant`, `category`): открываются
`openTransaction` / `openMerchant` / `openCategory` поверх текущей (`push`), «назад» идёт по цепочке. План месяца
своей страницы не имеет: он меняется в статистике месяца (`screens/stats/month/parts/usePlanSheets` — «＋», бюджет, суммы,
перенос), его модели (`screens/stats/plan/model`) — в слайсе статистики. Тело страницы —
`View` слайса (`TransactionView`, `MerchantView`, `CategoryView`) в `shared/ui/Page`: содержимое прокручивается, кнопки
прижаты книзу. Формы и выборы (сумма, «Сменить категорию», разделение, описание, новая категория, подтверждения) —
шиты. Имя мерчанта или категории — `MerchantLink` / `CategoryLink` (обе на `shared/ui/TextLink`: синий текст со
стрелкой), в заголовке шита — `BottomSheet` `onTitlePress` (шит закрывается: страница уходит под шиты). «Показать все ›»
со страницы — `showOperationsFrom`: «назад» из «Операций» восстанавливает страницы как были (`backToPages`).
Кнопка — только `shared/ui/Button`, своей `TouchableOpacity` со стилем кнопки не рисовать: `variant="primary"` (залитая
акцентом, белый текст — главное действие), `"secondary"` (белая, рамка и текст акцента — другой выбор рядом) или
`"cancel"` (белая, серая рамка и серый текст — отказ: «Отмена», «Подвести позже»), `"text"` (только текст акцента —
действие в хедере, тулбаре, карточке: «Сбросить все», «＋ Добавить описание»; `muted` — серый, «Не сейчас»); `danger` —
красная; `size="small"` —
по ширине текста, в строке или в хедере («＋ В план», «Готово», «Создать» — `CreateButton`); `icon` — значок перед
текстом в его цвете (✎, ＋). Кнопки шита — `SheetActions`. Своя кнопка одна — круглая ＋ (`PlusButton`); не кнопки:
чипы (`Chip`), выбор (`RadioGroup`, `Choice`), ссылка «… ›» (`TextLink`). Нажимаемое с одним `<Text>` внутри —
ошибка линта `app/text-button` (B3); особый элемент (клавиша PIN, ‹ ›, вкладки диаграммы) — `eslint-disable-next-line
app/text-button -- <почему>` на месте.

Каталог `shared/ui` — экран «Компоненты» в debug-сборке (⋮ › Компоненты, `screens/catalog`): новый компонент или
вариант — кадр в его разделе (`parts/*Demo.tsx`), скрины — [docs/components/](docs/components/) (B4).

Плашка (предупреждение, предложение, заметка над списком или в шите) — только `shared/ui/Banner`: `tone` (`warn` жёлтая,
`info` голубая, `neutral` серая, `ok` зелёная), `title`, `text`, ссылки и кнопки — детьми; `onPress` — вся плашка
кнопка с ›, `close` — ✕, `action` — текст-кнопка справа («Отменить»). Свою коробку с фоном и радиусом не рисовать. Пусто на месте списка — `shared/ui/Empty` (`compact` — в шите, `inline` — слева
в блоке страницы). Поле ввода — только `shared/ui/TextField`: `label`, `hint` / `error` под ним, `amount` (сумма:
клавиатура, «0.00»), `large` (главная сумма шита), `suffix` (₾ внутри), `right` (`CurrencyButton` рядом, той же высоты),
`compact` (в строке); поиск — `SearchBar`. Свой `TextInput` — ошибка `app/text-input`. Строка списка «значок · название с подписями · сумма справа» (план,
платежи, строки шитов) — `shared/ui/AmountRow` (`icon`, `title`, `notes`, `amount`, `large` в шите): разметка общая, что в
подписях и сумме — у слайса. У любого `TouchableOpacity` / `Pressable` — `accessibilityRole` (`button`, `checkbox`, `link`…), у значка
без текста — `accessibilityLabel`: ошибки линта `app/touchable-role`, `app/icon-touchable-label`.

Записи в базу — командами слайса (`model/commands.ts`): запись + `emitTransactionsChanged`. Компоненты не зовут
`emitTransactionsChanged` сами.

### Импорты

- В корне `src` файлов нет: всё в слое или в домене ядра. Ядро не импортирует `react`; `react-native` — только
  `native/` и `notifications/`.
- Только вниз: `app → screens → features → entities → shared`. Ядро импортируют все слои React; ядро и `shared`
  не импортируют ничего из слоёв выше.
- Соседние слайсы одного слоя друг друга не импортируют (feature из feature, entity из entity) — их собирает слой
  выше. Нужно общее — опустить его на слой ниже.
- Снаружи слайса — только через его `index.ts`. Внутри слайса — относительные пути.
- Между слоями — алиас `@/` (`@/shared/ui`, `@/entities/category`), не цепочки `../../..`.
- Данные открываются через `sheets.ts` (`openTransaction`, `openMonthReport`…) и типизированные хуки навигации,
  не через `navigate(… as never)`.

### Размеры и устройство файлов

- Файл — до **250 строк** кода (без пустых и комментариев); компонент или функция — до **120**; хук (`use*`) — до **100**.
  Больше — делить до коммита, не «потом».
- Один экспортируемый компонент на файл; маленьких внутренних — не больше двух-трёх.
- Слайс до ~6 файлов — плоско. Больше — сегменты: `ui/` (компоненты), `model/` (хуки, чистые расчёты),
  `texts.ts` (тексты и константы интерфейса), `index.ts` (публичное API).
- Расчёты не живут в `.tsx`: чистые функции — в `.ts` рядом (`model/`), с тестом в `tests/logic/`.
- `StyleSheet` длиннее ~60 строк — в `X.styles.ts` рядом. Вид — только из `shared/theme`: размеры текста, насыщенность,
  отступы, радиусы — `tokens.ts` (`font.body`, `weight.semibold`, `space[12]`, `radius.md`, `layout.fabClearance`), цвета —
  `theme.ts` (`colors`, `chart`, `markColors`); круг — `radius.pill`. Литералы (`fontSize: 13`, `'#…'`, `rgba(`) ловит
  `app/theme-tokens`; разовая геометрия (высота под кнопку, глиф в кружке 13 pt) — именованная константа рядом со стилями,
  отрицательный сдвиг на край — `-space[16]`. Палитры категорий и банков (`domain/colors.ts`, `domain/banks.ts`) — данные.
- Словари одной копией: месяцы в падежах, дни недели, «дни ритма» — `shared/lib/dates.ts`; тексты — по
  [GLOSSARY.md](GLOSSARY.md).
- UI не ходит в БД из компонентов напрямую: запросы — в хуке `model/use*.ts` слайса или в ядре.
- Строка длинного списка — `React.memo`, её обработчики получают саму запись (`onPress(tx)`); родитель отдаёт одни и те
  же функции (`useStableCallback`) и `renderItem` в `useCallback` (как `TransactionItem` в `OperationsList`).
- Статистика считает по ядру одной выборкой, а не вызовом `monthStats` / `periodStats` на каждый отрезок (нормы —
  `db/plans/normsData.ts`); бюджет запросов — `tests/logic/statsQueries.test.ts`. Курсы — из кэша, недостающие
  докачиваются в фоне (`ensureRatesLater`).

## 2. План перехода

Принципы: поведение не меняется; шаг — отдельный коммит после `tsc` и всего Jest (screens-тесты рендерят весь
`<App />` и ловят поломки переносов); переносы — `git mv`, чтобы сохранить историю. Сначала shared, потом деление
больших файлов — части сразу ложатся на свои места.

| # | Шаг | Что делаем | Статус |
|---|---|---|---|
| 0 | Инструменты | ESLint 9 (`eslint.config.js`): `max-lines` 250, `max-lines-per-function` 120, `react-hooks`, границы слоёв — `no-restricted-imports` на каждый слой; пока всё warn. Алиас `@/` → `src/` (babel `module-resolver`, `tsconfig paths`, Jest `moduleNameMapper`). `npm run lint`, `npm run typecheck` | готово: 38 предупреждений — длинные файлы из плана, импорты ядра из `ui` (шаг 1), `exhaustive-deps` в `TransactionsList` (шаг 5) |
| 1 | `shared` | Кит, lib, theme → `src/shared/{ui,lib,theme}`. `dates.ts`: месяцы во всех падежах, дни недели, `RHYTHM_DAYS` (было 9 копий); `formatPercent` вместо `pct` / `percentOf` / `shareOfAll`. `limitAlerts`, `navigation`, `notifications` — из `shared/lib` | готово: `src/domain/colors.ts` остался в ядре (палитра категорий, её берёт `db/`); `form.ts` — в `shared/ui` (показывает тост); импорт `ui/stats/norms` из `limitAlerts` — шаг 2 |
| 2 | Ядро | `ui/stats/norms.ts` целиком (загрузка и расчёты лимитов по ритму, без React) → `src/stats/norms.ts`; запрос курсов НБГ → `src/fx/nbg.ts` (без импортов из `db`, чтобы не было цикла), кэш курсов остаётся в `db/fx.ts` | готово; `emitTransactionsChanged` из команд — перенесено в шаг 4 (команды сущностей) |
| 3 | `app` | `App.tsx` → `app/App` + `MainTabs` + `useAppStartup`; `modals` → `app/ModalHost`, `SettingsButton` → `app`. `navigation`, `sheets`, `leaveGuard` → `shared/navigation`: их зовут все слои и уведомления, а импорты только вниз | готово: `app` пока импортирует экраны и шиты из `src/ui` (11 предупреждений lint — уходят шагами 4–7) |
| 4 | `entities` | `entities/{category,transaction,plan}`, `features/{transaction-edit,merchant-card,category-delete,category-types}`. `TransactionSheet` 336 → 84 строки (+ хуки `useTransaction`, `useCategoryChoice`, части), `MerchantCard` 317 → 70, `CategorySheet` 269 → 138. Карточка мерчанта открывается через `sheets` (`openMerchant`), удаление категории — проп `onDelete`. Команды слайсов (запись + `emitTransactionsChanged`) | готово: карточка мерчанта с правилом для прошлых операций — feature; `entities/merchant` — имя-ссылка `MerchantLink` (карточка операции и дальше везде, где мерчант виден); `emitTransactionsChanged` ещё в `src/ui` (списки, добавление, объединение, план) — уходит шагами 5–7 |
| 5 | Операции | `TransactionsList` (767) → `screens/operations/OperationsScreen` (169): `model/` — `useOperationsList`, `useSelection`, `useBulkCategory`, `useOperationsRoute`, `useTabLifecycle`, `useListRefresh`, `listData`, `groups`; `parts/` — `OperationsList`, `SectionHeader`, `FiltersBar`, `FilterSheets`, `SelectToolbar`, `BulkBar`, `HeaderActions`. Фичи: `operations-filters` (`useTransactionFilters`, `SearchBar`, `filter`), `category-delete` (`useSortOut`, `SortOutBanner`), `settings` (через `openSettings`, импорт SMS — пропом из `ModalHost`), `sms-import`, `card-balance` | готово: `bulk-select` не понадобился — выбор нужен только экрану; `SearchBar` пока только у операций (мерчанты — шаг 7); Maestro — все 6 флоу |
| 6 | Статистика | `src/ui/stats` → `screens/stats` (`month/`, `period/`, `plan/`, `history/`, общие `parts/`: `DonutCenter`, `RefundsRow`, `PeriodNav`, `PlanAlert`). `PeriodStatsView` 870 → 80 (+ `usePeriodData`, чистый `periodView`, `periodText` с тестами, части: строка категории, строки лимитов, секции, объяснения); `PlanView` 652 → 70 (+ `usePlanData`, `planView` с тестами, `usePlanActions`, карточка бюджета, секции, шит бюджета); `StatsView` 448 → 97; `MonthReport` 399 → фича `month-report` (`reportView` с тестами, блоки); `PlanAmountModal` → `entities/plan`; `Masked` → `shared/ui`, `HideAmountsButton` → `features/hide-amounts` | готово: секции — функции, возвращающие фрагменты (`StickyScrollView` липнет только к своим `SectionHeader`) |
| 7 | Остальное | `src/ui` больше нет: `MerchantsScreen` 332 → `screens/merchants` (`useMerchants`, `useMerchantBulk`, `activity` с тестами, строка, заголовок; поиск — общий `SearchBar`), `CategoriesScreen` → `screens/categories`, `AddTransactionSheet` → `features/add-transaction` (`useAddForm`, `DateField`, `dayLabel`), `MergeCategoriesSheet` → `features/category-merge`. Команды: `entities/merchant` (удалить, категория мерчантам), `entities/plan` (`savePlanAmount`), `entities/transaction` (`addTransaction`), `category-merge` (`mergeInto`) | готово: компоненты не зовут `emitTransactionsChanged` (кроме старта в `app`); у крестика поиска мерчантов подпись как у операций — «Очистить поиск» |
| 8 | Закрепить | Правила lint — ошибки (импорты слоёв, размеры, хуки); у ядра размеры — предупреждения до шага 9. Lint — в CI перед сборкой релиза (`android-release.yml`). CLAUDE.md, README, скилл `architecture` — без «идёт переход» | готово |
| 9 | Ядро: длинные файлы базы | `db/plans.ts` (708) → `db/plans/` (`months`, `spend`, `types`, `budget`, `items`, `stats`, `history`); `db/transactions.ts` → `db/transactions/` (`sql`, `rows`, `filter`, `writes`, `groups`); `db/migrations.ts` → `db/migrations/` (`steps-1-12`, `steps-13-on` — новые дописываются сюда, `index` склеивает). `index.ts` реэкспортирует: импорты `db/plans`, `db/transactions`, `db/migrations` не изменились. Неиспользуемые `export default` убраны | готово: lint без ошибок и предупреждений, размеры — ошибка везде. Одно правило «что считается тратой» (IMPROVEMENTS 8.6) — отдельно: меняет расчёты |

### Куда переехали файлы `src/ui`

- **shared/ui**: `form`, `BottomSheet`, `Button`, `Checkbox`, `Chip`, `Segmented`, `RadioGroup`, `StepSlider`, `Donut`,
  `Meter`, `HueBar`, `ColorSwatches`, `ColorPickerSheet`, `EmojiPicker` (+ `emoji/`), `RangeCalendar` (сетка месяца — `MonthGrid`),
  `TextInputModal`, `StickyScrollView`, `SectionHeading`, `Fab`, `PlusButton`, `RowActions`, `CurrencyButton`,
  `CurrencyPicker`, `TextField` (поле ввода), `AmountRow` (строка с суммой), `SearchBar` (поиск), `DateField` (поле даты), `Banner` (плашка), `Empty` (пусто), `Toggle` (переключатель; со строкой и подсказкой — `SwitchRow`), `BankBadge` (знак банка), `ModeBanner` (режим списка: разбор категории, выбор операции для платежа), `icons`, `toast`, `sheetAlert`.
- **shared/lib**: `format`, `money`, `dateRange`, `dates` (бывший `stats/months`), `strings`, `useLast`, `useLatestRequest`.
- **shared/theme**: `theme`, `formStyles`. `colors.ts` остаётся в ядре (`src/domain/`): палитру категорий берёт `db/`.
- **app**: `App.tsx` (+ `MainTabs`, `useAppStartup`), `modals.tsx` → `ModalHost`, `SettingsButton`.
- **shared/navigation**: `navigation.ts`, `sheets.ts`, `leaveGuard.ts`.
- **entities/transaction**: `TransactionItem`, команды и подтверждения удаления (`transactionActions`).
  `transactionGroups` — в `screens/operations` (группировки списка).
- **entities/category**: `CategoryPickerModal`, `CategorySheet` (+ `useCategoryForm`,
  `CategoryNameField`, `CategorySummaryRow`), `TypeEditModal`, команды, тип `CategoryInfo`.
- **entities/merchant**: `MerchantLink` — имя мерчанта ссылкой на его карточку (`openMerchant`). Заголовок операции
  `merchantLabel` («Оплата · TELMICO») — из `shared/lib/format` в `entities/transaction`.
- **entities/plan**: `summaryGroups`, `unplanned` (`norms` — в ядре, `src/stats/`).
- **features** (шаг 4): `transaction-edit` (`TransactionSheet`), `merchant-card` (`MerchantCard`), `category-delete`
  (`CategoryDeleteSheet`, `categoryDeletionText`, `categoryActions` → `startCategoryDelete`), `category-types`
  (`CategoryTypesSheet`).
- **features** (шаг 5): `operations-filters` (`FilterSheets`, `useTransactionFilters`, `SearchBar`), `sms-import`
  (`smsImportFlow`, `PushAccessBanner`), `settings` (`SettingsButton`, `SettingsSheet`), `card-balance` (`CardBalance`).
- **features** (дальше): `category-merge` (`MergeCategoriesSheet`), `add-transaction` (`AddTransactionSheet`), `plan-edit`
  (`PlanAddModal`, `PlanAmountModal`, `PlanAlert`), `month-report` (`MonthReport`), `hide-amounts` (`HideAmountsButton`,
  `Masked`).
- **screens/operations**: `TransactionsList` → `OperationsScreen`, `OperationsSectionHeader` → `parts/SectionHeader`, `transactionsListData` → `model/listData`, `transactionGroups` → `model/groups`.
- **screens/stats** (шаг 6): `StatsHome`, `month/StatsView`, `period/PeriodStatsView`, `plan/` (модели и шиты плана; страницы нет — `month/parts/usePlanSheets`, `PlanAddModal`), `history/HistoryView`, `parts/PlanAlert`; `month-report`, `hide-amounts` — фичи; `PlanAmountModal` — `entities/plan`.
- **screens/merchants**: `MerchantsScreen`. **screens/categories**: `CategoriesScreen`.

Переход закончен: `src/ui` нет, все файлы в своих слоях.
