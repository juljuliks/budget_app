# Архитектура кода

Цель — понятно, куда класть файл, импорты идут в одну сторону, нет длинных файлов. Подход — упрощённый
Feature-Sliced Design (FSD-lite): без слоёв processes и widgets — для приложения на 4 вкладки они лишние.

Часть 1 — правила (действуют всегда, для нового кода — уже сейчас). Часть 2 — план перехода со статусом шагов.

## 1. Правила

### Слои

```
src/
  app/        App, вкладки, стартовые эффекты, хосты (ModalHost), кнопка настроек
  screens/    вкладки: operations/, stats/, merchants/, categories/ — только сборка из частей
  features/   сценарии пользователя: действие в несколько шагов, с вопросами и последствиями
  entities/   transaction/, category/, merchant/, plan/ — показать, выбрать, просто изменить одну вещь
  shared/     ui/ (кит без знания о бюджете), lib/ (format, money, dates, хуки), theme/,
              navigation/ (navigationRef, хуки переходов, sheets.ts — открыть шит откуда угодно, leaveGuard)
  db/ parsers/ importer/ notifications/ native/ stats/ fx/ ingest.ts assign.ts …   — ядро, без React
```

**Куда класть:**

| Что это | Слой | Пример |
|---|---|---|
| Кнопка, шит, чип, календарь — не знает про операции и категории | `shared/ui` | `Button`, `BottomSheet`, `RangeCalendar` |
| Чистая функция или хук без бизнес-смысла | `shared/lib` | `format`, `money`, `dates`, `useLatestRequest` |
| Показать, выбрать или просто изменить одну сущность, без сценария | `entities/<сущность>` | `TransactionItem`, `CategoryPicker`, `CategorySheet` |
| Действие пользователя в несколько шагов | `features/<действие>` | удалить категорию с разбором, карточка мерчанта (правило), объединить, импорт SMS |
| Вкладка и её части, которые нигде больше не нужны | `screens/<вкладка>/parts` | заголовок раздела операций, строка категории статистики |
| Корень приложения: стек, вкладки, хосты, старт | `app` | `App.tsx`, `MainTabs`, `ModalHost`, `useAppStartup` |
| Переходы и открытие шитов — нужны всем слоям, без UI | `shared/navigation` | `navigation.ts`, `sheets.ts`, `leaveGuard.ts` |
| Запросы к БД, расчёты, парсеры, уведомления | ядро | `db/plans.ts`, `stats/norms.ts`, `parsers/tbc.ts` |

Сомнение «entity или feature» решает вопрос: есть ли шаги, подтверждения или последствия для других данных?
Да — feature. Простая форма своей сущности (создать или изменить категорию, раздел) — entity; удаление с разбором,
правило мерчанта, меняющее прошлые операции, — feature. Сомнение «feature или часть экрана» — нужна ли она больше чем
в одном месте? Нет — `screens/*/parts`.

Когда нижнему слою нужно то, что выше, — не импорт, а:
- проп-колбэк: `CategorySheet` (entity) получает `onDelete`, удаление с разбором (feature) передаёт экран;
- шит через `sheets.ts`: `TransactionSheet` открывает карточку мерчанта `openMerchant(…)`, её рисует `ModalHost`.

Записи в базу — командами слайса (`model/commands.ts`): запись + `emitTransactionsChanged`. Компоненты не зовут
`emitTransactionsChanged` сами.

### Импорты

- Только вниз: `app → screens → features → entities → shared`. Ядро импортируют все слои React; ядро и `shared`
  не импортируют ничего из слоёв выше.
- Соседние слайсы одного слоя друг друга не импортируют (feature из feature, entity из entity) — их собирает слой
  выше. Нужно общее — опустить его на слой ниже.
- Снаружи слайса — только через его `index.ts`. Внутри слайса — относительные пути.
- Между слоями — алиас `@/` (`@/shared/ui`, `@/entities/category`), не цепочки `../../..`.
- Данные открываются через `sheets.ts` (`openTransaction`, `openMonthReport`…) и типизированные хуки навигации,
  не через `navigate(… as never)`.

### Размеры и устройство файлов

- Файл — до **250 строк** кода (без пустых и комментариев); компонент или функция — до **120**; хук — до **100**.
  Больше — делить до коммита, не «потом».
- Один экспортируемый компонент на файл; маленьких внутренних — не больше двух-трёх.
- Слайс до ~6 файлов — плоско. Больше — сегменты: `ui/` (компоненты), `model/` (хуки, чистые расчёты),
  `texts.ts` (тексты и константы интерфейса), `index.ts` (публичное API).
- Расчёты не живут в `.tsx`: чистые функции — в `.ts` рядом (`model/`), с тестом в `tests/logic/`.
- `StyleSheet` длиннее ~60 строк — в `X.styles.ts` рядом. Цвета — только из `shared/theme`, без литералов `#…`.
- Словари одной копией: месяцы в падежах, дни недели, «дни ритма» — `shared/lib/dates.ts`; тексты — по
  [GLOSSARY.md](GLOSSARY.md).
- UI не ходит в БД из компонентов напрямую: запросы — в хуке `model/use*.ts` слайса или в ядре.

## 2. План перехода

Принципы: поведение не меняется; шаг — отдельный коммит после `tsc` и всего Jest (screens-тесты рендерят весь
`<App />` и ловят поломки переносов); переносы — `git mv`, чтобы сохранить историю. Сначала shared, потом деление
больших файлов — части сразу ложатся на свои места.

| # | Шаг | Что делаем | Статус |
|---|---|---|---|
| 0 | Инструменты | ESLint 9 (`eslint.config.js`): `max-lines` 250, `max-lines-per-function` 120, `react-hooks`, границы слоёв — `no-restricted-imports` на каждый слой; пока всё warn. Алиас `@/` → `src/` (babel `module-resolver`, `tsconfig paths`, Jest `moduleNameMapper`). `npm run lint`, `npm run typecheck` | готово: 38 предупреждений — длинные файлы из плана, импорты ядра из `ui` (шаг 1), `exhaustive-deps` в `TransactionsList` (шаг 5) |
| 1 | `shared` | Кит, lib, theme → `src/shared/{ui,lib,theme}`. `dates.ts`: месяцы во всех падежах, дни недели, `RHYTHM_DAYS` (было 9 копий); `formatPercent` вместо `pct` / `percentOf` / `shareOfAll`. `limitAlerts`, `navigation`, `notifications` — из `shared/lib` | готово: `src/colors.ts` остался в ядре (палитра категорий, её берёт `db/`); `form.ts` — в `shared/ui` (показывает тост); импорт `ui/stats/norms` из `limitAlerts` — шаг 2 |
| 2 | Ядро | `ui/stats/norms.ts` целиком (загрузка и расчёты лимитов по ритму, без React) → `src/stats/norms.ts`; запрос курсов НБГ → `src/fx/nbg.ts` (без импортов из `db`, чтобы не было цикла), кэш курсов остаётся в `db/fx.ts` | готово; `emitTransactionsChanged` из команд — перенесено в шаг 4 (команды сущностей) |
| 3 | `app` | `App.tsx` → `app/App` + `MainTabs` + `useAppStartup`; `modals` → `app/ModalHost`, `SettingsButton` → `app`. `navigation`, `sheets`, `leaveGuard` → `shared/navigation`: их зовут все слои и уведомления, а импорты только вниз | готово: `app` пока импортирует экраны и шиты из `src/ui` (11 предупреждений lint — уходят шагами 4–7) |
| 4 | `entities` | `entities/{category,transaction,plan}`, `features/{transaction-edit,merchant-card,category-delete,category-types}`. `TransactionSheet` 336 → 84 строки (+ хуки `useTransaction`, `useCategoryChoice`, части), `MerchantCard` 317 → 70, `CategorySheet` 269 → 138. Карточка мерчанта открывается через `sheets` (`openMerchant`), удаление категории — проп `onDelete`. Команды слайсов (запись + `emitTransactionsChanged`) | готово: карточка мерчанта с правилом для прошлых операций — feature; `entities/merchant` — имя-ссылка `MerchantLink` (карточка операции и дальше везде, где мерчант виден); `emitTransactionsChanged` ещё в `src/ui` (списки, добавление, объединение, план) — уходит шагами 5–7 |
| 5 | Операции | `TransactionsList` (767) → `screens/operations/OperationsScreen` (169): `model/` — `useOperationsList`, `useSelection`, `useBulkCategory`, `useOperationsRoute`, `useTabLifecycle`, `useListRefresh`, `listData`, `groups`; `parts/` — `OperationsList`, `SectionHeader`, `FiltersBar`, `FilterSheets`, `SelectToolbar`, `BulkBar`, `HeaderActions`. Фичи: `operations-filters` (`useTransactionFilters`, `SearchBar`, `filter`), `category-delete` (`useSortOut`, `SortOutBanner`), `settings` (через `openSettings`, импорт SMS — пропом из `ModalHost`), `sms-import`, `card-balance` | готово: `bulk-select` не понадобился — выбор нужен только экрану; `SearchBar` пока только у операций (мерчанты — шаг 7); Maestro — все 6 флоу |
| 6 | Статистика | `src/ui/stats` → `screens/stats` (`month/`, `period/`, `plan/`, `history/`, общие `parts/`: `DonutCenter`, `RefundsRow`, `PeriodNav`, `PlanAlert`). `PeriodStatsView` 870 → 80 (+ `usePeriodData`, чистый `periodView`, `periodText` с тестами, части: строка категории, строки лимитов, секции, объяснения); `PlanView` 652 → 70 (+ `usePlanData`, `planView` с тестами, `usePlanActions`, карточка бюджета, секции, шит бюджета); `StatsView` 448 → 97; `MonthReport` 399 → фича `month-report` (`reportView` с тестами, блоки); `PlanAmountModal` → `entities/plan`; `Masked` → `shared/ui`, `HideAmountsButton` → `features/hide-amounts` | готово: секции — функции, возвращающие фрагменты (`StickyScrollView` липнет только к своим `SectionHeader`) |
| 7 | Остальное | `src/ui` больше нет: `MerchantsScreen` 332 → `screens/merchants` (`useMerchants`, `useMerchantBulk`, `activity` с тестами, строка, заголовок; поиск — общий `SearchBar`), `CategoriesScreen` → `screens/categories`, `AddTransactionSheet` → `features/add-transaction` (`useAddForm`, `DateField`, `dayLabel`), `MergeCategoriesSheet` → `features/category-merge`. Команды: `entities/merchant` (удалить, категория мерчантам), `entities/plan` (`savePlanAmount`), `entities/transaction` (`addTransaction`), `category-merge` (`mergeInto`) | готово: компоненты не зовут `emitTransactionsChanged` (кроме старта в `app`); у крестика поиска мерчантов подпись как у операций — «Очистить поиск» |
| 8 | Закрепить | lint warn → error, lint в CI; CLAUDE.md «Где что», карта в README, пути в tests/README; убрать `src/ui` | — |
| 9 | Ядро: `db/plans.ts` (708) | → `plans/budget.ts`, `plans/items.ts`, `spend.ts` — вместе с IMPROVEMENTS 8.6 (одно правило «что считается тратой») | — |

### Куда переедут текущие файлы `src/ui`

- **shared/ui**: `form`, `BottomSheet`, `Button`, `Checkbox`, `Chip`, `Segmented`, `RadioGroup`, `StepSlider`, `Donut`,
  `Meter`, `HueBar`, `ColorSwatches`, `ColorPickerSheet`, `EmojiPicker` (+ `emoji/`), `RangeCalendar`,
  `TextInputModal`, `StickyScrollView`, `SectionHeading`, `Fab`, `PlusButton`, `RowActions`, `CurrencyButton`,
  `CurrencyPicker`, `icons`, `toast`, `sheetAlert`.
- **shared/lib**: `format`, `money`, `dateRange`, `dates` (бывший `stats/months`), `strings`, `useLast`, `useLatestRequest`.
- **shared/theme**: `theme`, `formStyles`. `src/colors.ts` остаётся в ядре: палитру категорий берёт `db/`.
- **app**: `App.tsx` (+ `MainTabs`, `useAppStartup`), `modals.tsx` → `ModalHost`, `SettingsButton`.
- **shared/navigation**: `navigation.ts`, `sheets.ts`, `leaveGuard.ts`.
- **entities/transaction**: `TransactionItem`, команды и подтверждения удаления (`transactionActions`).
  `transactionGroups` — в `screens/operations` (группировки списка).
- **entities/category**: `CategoryPicker`, `CategoryPickerModal`, `CategorySheet` (+ `useCategoryForm`,
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
- **screens/stats** (шаг 6): `StatsHome`, `month/StatsView`, `period/PeriodStatsView`, `plan/PlanView` (+ `PlanAddModal`), `history/HistoryView`, `parts/PlanAlert`; `month-report`, `hide-amounts` — фичи; `PlanAmountModal` — `entities/plan`.
- **screens/merchants**: `MerchantsScreen`. **screens/categories**: `CategoriesScreen`.

Пока переход не закончен: новый файл — сразу в целевой слой, если папка уже есть; иначе в `src/ui` под именем из
этой карты, чтобы потом перенести без переименования. Трогаешь большой файл из таблицы — новое в него не дописывать,
выносить в отдельный файл по плану.
