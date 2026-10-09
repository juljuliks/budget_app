# Архитектура кода

Цель — понятно, куда класть файл, импорты идут в одну сторону, нет длинных файлов. Подход — упрощённый
Feature-Sliced Design (FSD-lite): без слоёв processes и widgets — для приложения на 4 вкладки они лишние.

Часть 1 — правила (действуют всегда, для нового кода — уже сейчас). Часть 2 — план перехода со статусом шагов.

## 1. Правила

### Слои

```
src/
  app/        App, навигация, хосты (ModalHost, Toast, SheetAlert), sheets.ts, leaveGuard
  screens/    вкладки: operations/, stats/, merchants/, categories/ — только сборка из частей
  features/   сценарии пользователя: действие в несколько шагов, с вопросами и последствиями
  entities/   transaction/, category/, merchant/, plan/ — показать или выбрать одну вещь
  shared/     ui/ (кит без знания о бюджете), lib/ (format, money, dates, form, хуки), theme/
  db/ parsers/ importer/ notifications/ native/ stats/ fx/ ingest.ts assign.ts …   — ядро, без React
```

**Куда класть:**

| Что это | Слой | Пример |
|---|---|---|
| Кнопка, шит, чип, календарь — не знает про операции и категории | `shared/ui` | `Button`, `BottomSheet`, `RangeCalendar` |
| Чистая функция или хук без бизнес-смысла | `shared/lib` | `format`, `money`, `dates`, `useLatestRequest` |
| Показать или выбрать одну сущность, без сценария | `entities/<сущность>` | `TransactionItem`, `CategoryPicker`, `MerchantCard` |
| Действие пользователя в несколько шагов | `features/<действие>` | удалить категорию с разбором, объединить, импорт SMS, правка плана |
| Вкладка и её части, которые нигде больше не нужны | `screens/<вкладка>/parts` | заголовок раздела операций, строка категории статистики |
| Корень приложения, навигация, глобальные хосты | `app` | `App.tsx`, `navigation.ts`, `sheets.ts` |
| Запросы к БД, расчёты, парсеры, уведомления | ядро | `db/plans.ts`, `stats/norms.ts`, `parsers/tbc.ts` |

Сомнение «entity или feature» решает вопрос: есть ли шаги, подтверждения или последствия для других данных?
Да — feature. Сомнение «feature или часть экрана» — нужна ли она больше чем в одном месте? Нет — `screens/*/parts`.

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
| 3 | `app` | `App.tsx` → tabs + hosts; `navigation`, `sheets`, `modals`, `leaveGuard`, `SettingsButton` | — |
| 4 | `entities` | transaction, category, merchant, plan; деление `TransactionSheet` (336), `MerchantCard` (317), `CategorySheet` (269); `useOpenTransactions()`; команды сущностей (запись + `emitTransactionsChanged`) вместо ~20 вызовов из компонентов | — |
| 5 | Операции | `TransactionsList` (767) → `screens/operations`: `OperationsScreen`, `useTransactionFilters`, `useSelection`, `SearchBar` (общий с Мерчантами), `BulkBar`, разбор категории; фильтры и мультивыбор — features. Прогон e2e | — |
| 6 | Статистика | `PeriodStatsView` (872) → `PeriodCategoryRow`, `LimitEffect`, `CategoryInfo`, `periodText.ts` с тестами; `PlanView` (653) → кольца, `ShareField`, `SavingsSwitch`, `groupByType` в `.ts`; `StatsView` (448) → `CategoryRow`, `DonutCenter`; `MonthReport` (399) → строки отчёта; общий `styles.ts` | — |
| 7 | Остальное | `MerchantsScreen` (334), оставшиеся features | — |
| 8 | Закрепить | lint warn → error, lint в CI; CLAUDE.md «Где что», карта в README, пути в tests/README; убрать `src/ui` | — |
| 9 | Ядро: `db/plans.ts` (708) | → `plans/budget.ts`, `plans/items.ts`, `spend.ts` — вместе с IMPROVEMENTS 8.6 (одно правило «что считается тратой») | — |

### Куда переедут текущие файлы `src/ui`

- **shared/ui**: `form`, `BottomSheet`, `Button`, `Checkbox`, `Chip`, `Segmented`, `RadioGroup`, `StepSlider`, `Donut`,
  `Meter`, `HueBar`, `ColorSwatches`, `ColorPickerSheet`, `EmojiPicker` (+ `emoji/`), `RangeCalendar`,
  `TextInputModal`, `StickyScrollView`, `SectionHeading`, `Fab`, `PlusButton`, `RowActions`, `CurrencyButton`,
  `CurrencyPicker`, `icons`, `toast`, `sheetAlert`.
- **shared/lib**: `format`, `money`, `dateRange`, `dates` (бывший `stats/months`), `strings`, `useLast`, `useLatestRequest`.
- **shared/theme**: `theme`, `formStyles`. `src/colors.ts` остаётся в ядре: палитру категорий берёт `db/`.
- **app**: `App.tsx`, `navigation.ts`, `sheets.ts`, `modals.tsx`, `leaveGuard.ts`, `SettingsButton`.
- **entities/transaction**: `TransactionItem`, `TransactionSheet`, `transactionActions`, `transactionGroups`.
- **entities/category**: `CategoryPicker`, `CategoryPickerModal`, `CategorySheet`, `TypeEditModal`,
  `CategoryTypesSheet`, `categoryActions`.
- **entities/merchant**: `MerchantCard`.
- **entities/plan**: `stats/summaryGroups`, `stats/unplanned` (`norms` — уже в ядре, `src/stats/`).
- **features**: `operations-filters` (`FilterSheets`), `bulk-select`, `category-delete` (`CategoryDeleteSheet`,
  `categoryDeletionText`), `category-merge` (`MergeCategoriesSheet`), `sms-import` (`smsImportFlow`,
  `PushAccessBanner`), `add-transaction` (`AddTransactionSheet`), `plan-edit` (`PlanAddModal`, `PlanAmountModal`,
  `PlanAlert`), `month-report` (`MonthReport`), `settings` (`SettingsSheet`), `hide-amounts`
  (`HideAmountsButton`, `Masked`), `card-balance` (`CardBalance`).
- **screens/operations**: `TransactionsList`, `OperationsSectionHeader`, `transactionsListData`.
- **screens/stats**: `StatsHome`, `StatsView`, `PeriodStatsView`, `PlanView`, `HistoryView`.
- **screens/merchants**: `MerchantsScreen`. **screens/categories**: `CategoriesScreen`.

Пока переход не закончен: новый файл — сразу в целевой слой, если папка уже есть; иначе в `src/ui` под именем из
этой карты, чтобы потом перенести без переименования. Трогаешь большой файл из таблицы — новое в него не дописывать,
выносить в отдельный файл по плану.
