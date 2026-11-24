# Инвентаризация UI (этап 1)

Замер 25 ноября 2026 по `src/` (после Prettier). Что рисуется повторно своими руками, какой общий компонент оставить
или сделать, и шкала токенов для этапа 3. Скрины «до» — [before/](before/) (основные экраны на демо-базе); полный обход
всех экранов и состояний — этап 2.

Правило объединения: сначала взять существующий компонент `shared/ui` и обобщить его, новый — только если похожего нет
(CLAUDE.md). Вид объединённого — как у самой частой копии; отличия остальных перечисляются в коммите этапа 4.

## Группы дублей

| # | Группа | Где своими руками | Общий компонент | Примечание |
|---|---|---|---|---|
| 1 | **Плашка** над списком или экраном: иконка, текст, ссылка / кнопки, фон `warnBg` / `surface` / голубой | `stats/parts/CloseBanner`, `stats/parts/PlanAlert`, `message-templates/UnparsedBanner`, `sms-import/PushAccessBanner`, `sms-import/ImportBanksNote`, `transaction-edit/ui/PaymentNote`, `fund/ui/FundForecastBox`, `stats/plan/parts/LockedCard` | обобщить `shared/ui/ModeBanner` (1 пользователь) → `Banner` с `tone: 'warn' \| 'info' \| 'neutral'`, `icon`, `action` | 8 копий, отступы 10/12/14, радиус 10, `gap` 10/12, `alignItems` center / flex-start; голубой фон `PushAccessBanner` — строка `'#EFF6FF'` (= `colors.accentBg`) |
| 2 | **Пустое состояние**: серый текст по центру | `OperationsList`, `MerchantsScreen`, `CategoriesScreen`, `CategoryPickerModal`, `CategoryTypesSheet` (padding 32); `UnparsedScreen`, `MessageTemplatesScreen` (15 pt, padding 32); `FilterSheets`, `PlanAddModal` (paddingVertical 16); `month-close/ui/styles`, `trends/parts/styles` (слева, 15 pt) | новый `shared/ui/Empty` (`text`, `compact` — в шите, `inline` — слева в блоке) | 11 копий, 4 вида; похожего в `shared/ui` нет |
| 3 | **Загрузка / ошибка с «Повторить»** | `Loading` (23 пользователя) — общий; свои тексты ошибки — `OperationsList` (свой `ActivityIndicator`), шиты `CategoryDeleteSheet`, `MergeCategoriesSheet`, `SplitSheet`, `BackupSheet`, `TemplatePreviewSheet`, `CategoryTypesSheet` | `Loading` — во все экраны и шиты; `OperationsList` — на него | C2: у каких экранов нет состояния ошибки — в этапе 2 по скринам |
| 4 | **Строка с суммой**: эмодзи + название слева, сумма справа, иногда полоса или подпись | `stats/month/parts/CategoryRow`, `stats/period/parts/CategoryRow`, `trends/parts/TrendRow`, `plan/parts/{PlanItemRow,FundItemRow,RecurringItemRow}`, `month/parts/FundStatRow`, `history/parts/MonthRow`, `entities/category/ui/CategorySummaryRow`, `recurring-payments/ui/{PaymentRow,SubRow}`, `stats/parts/RefundsRow`, `month-report/MonthReportRow` | `shared/ui/AmountRow` (`left`, `title`, `subtitle`, `amount`, `secondary`, `meter`, `onPress`, `onLongPress`) — разметка; содержимое остаётся у слайсов | 14 строк; сравнить по скринам этапа 2 — где вид совпадает, где строка особая (шкала платежей, 🔒) |
| 5 | **Строка-ссылка «… ›»** текстом | `PaymentNote` («Задать дату ›», «Изменить … ›»), `ImpulseBlock` («Отметить ещё … ›»), `StepSavings` («Изменить распределение ›»), `UpcomingPaymentsView` / `MonthPaymentsView` (заголовки «… ›»), `UnparsedBanner` (свой «›») | `TextLink` (18 пользователей) — уже есть; `LinkCard` — карточкой | свой `styles.link` + «›» в тексте → `TextLink` |
| 6 | **Чипы** своими стилями | `SplitRow` (`chip`: 12/8, радиус 16), `TransactionCategory`, `ImpulseQuestion`, `FilterSheets`, `CategoryFields`, `RegularFields`, `PaymentSheet` | `Chip` (6 пользователей, 13 вариантов пропсов) | проверить каждый: часть — уже `Chip` с оберткой-рядом (`chipsWrap`) |
| 7 | **Заголовки разделов и полосы** | `SectionHeading` (9), `SectionBand` (8), `formStyles.sectionHeader`, `OperationsSectionHeader`, полоса месяца в «Истории» (`history/parts/styles`), 28 своих стилей `title` / `heading` / `header` вне `shared/ui` | `SectionHeading` — заголовок блока, `SectionBand` — серая полоса (дни, разделы, месяцы) | `formStyles.sectionHeader` = вид `SectionBand` |
| 8 | **Строка настроек / переключатель** | `settings/parts/Row`, `SwitchRow` (2 пользователя), свои `Switch` в строках | `SwitchRow` + строка-ссылка настроек | посчитать `Switch` вне `SwitchRow` в этапе 4 |
| 9 | **Кнопки-тексты** `TouchableOpacity` + `Text` (не `Button`, не `TextLink`) | 165 `TouchableOpacity` в 112 файлах; без `accessibilityRole` — 82 (lint `app/touchable-role`) | `Button` (44 пользователя), `TextLink`, `Chip`, строки | разбор — по списку линта (`docs/refactor/lint-baseline.txt`), B3 |
| 10 | **Круглые иконки и бейджи** | `PlusButton`, `Fab`, бейдж таба (навигатор), точка «не просмотрено» в `TransactionItem`, круги эмодзи категорий | `PlusButton` / `Fab` — есть; бейдж-точка — один стиль | мелкая группа, после 1–8 |

## Шкала токенов (этап 3)

### Типографика

Размеры сейчас (число мест): 13 — 119, 14 — 99, 15 — 94, 16 — 71, 12 — 40, 18 — 10, 20 — 9, 24 — 7, 22 — 6, 17 — 6,
28 — 5, 11 — 5, 10 — 4, 44 — 2, 9 / 8 / 34 / 12.5 — по 1. Насыщенность: 600 — 102, 700 — 34, 500 — 14.

Свести к 6–7 ролям (как задумывалось) — значит сдвинуть 14 ↔ 13 / 15 и 16 ↔ 15: это ~200 мест на 1 pt, заметно на
каждом экране. Предложение — роли по фактическим размерам, сливаются только редкие (≈ 25 мест, каждое ±1–2 pt — в
коммите этапа 3):

| Роль | Размер | Сейчас | Сливается |
|---|---|---|---|
| `micro` | 10 | подписи графиков, бейджи | 8, 9, 11 → 10 (7 мест) |
| `caption` | 12 | подписи, «· 17:00» | 12.5 → 12 |
| `meta` | 13 | вторая строка, подсказки, полосы разделов | — |
| `secondary` | 14 | ссылки, кнопки-тексты | — |
| `body` | 15 | основной текст строк | — |
| `input` | 16 | поля ввода, названия в строках | 17 → 16 (6 мест) |
| `title` | 18 | заголовки шитов | — |
| `heading` | 20 | заголовки страниц | 22 → 20 (6 мест) |
| `headline` | 24 | крупные суммы блоков | — |
| `display` | 28 | сумма месяца, баланс | 34 → 28 (1 место) |
| `hero` | 44 | сторис отчёта | — |

Плюс `weight`: `regular` 400, `medium` 500, `semibold` 600, `bold` 700; `lineHeight` — 18 / 20 / 21 сводятся к одному на
роль (`meta` 18, `body` 20).

### Отступы

Сейчас (значение: мест): 2:67, 4:80, 6:78, 8:171, 10:113, 12:146, 14:46, 16:97, 20:61, 24:13, 32:13; редкие — 1, 3, 5, 7,
9, 11, 13, 15, 18, 28, 36, 40, 48, 72, 88, 130.

Шкала: `space = { 2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 32, 48 }` (ключи числами: `space[12]`). Редкие: 1, 3 → 2 / 4 по
месту; 5, 7, 9, 11, 13, 15 → ближайшее чётное (±1); 18 → 20, 28 → 32, 36 / 40 → 32 / 48 — проверяются по скринам;
72 / 88 / 130 — высоты под плавающую кнопку и клавиатуру, не отступы: свои именованные константы.

### Радиусы

Сейчас: 10 — 32, 12 — 18, 5 — 14, 4 — 11, 8 — 9, 14 — 6, 2 — 5, 16 — 4, 3 — 4, 6 / 7 — по 3, 20 / 18 — по 2, остальное по 1.
Шкала: `radius = { xs: 4, sm: 8, md: 10, lg: 12, xl: 16, pill: 999 }`; 2 / 3 / 5 → 4, 6 / 7 → 8, 14 → 12 или 16 по месту,
18 / 20 / 22 → 16 / pill.

### Цвета

Вне `shared/theme` и палитр категорий (`domain/colors.ts` — это данные) — строки цветов в 24 файлах:

- белый `'#FFFFFF'` (10) → `colors.bg` или `colors.onAccent` по смыслу; `'#000'` / `'#000000'` (7) → `colors.shadow`;
- голубые `'#EFF6FF'` (4), `'#DBEAFE'` (3), `'#93C5FD'` (2) → `colors.accentBg` и новые `accentSoft`, `accentLine`;
- серые `'#374151'` (3), `'#D1D5DB'` (2), `'#7a8b99'` (2) → `colors.text` / новые `textSecondary`, `borderStrong`;
- затемнения `rgba(0,0,0,0.5)`, `rgba(0,0,0,0.35)`, `rgba(22,24,29,0.28)` → `colors.overlay`, `overlayLight`;
- коричневые `'#92400E'` (2), `'#eda100'` (2) → `colors.warnText`, `chart.meterStops`;
- пастели плана и выбора цвета (`stats/plan/parts/palette.ts`, `ColorPickerSheet`, `RangeCalendar`, `DPad`, `PinScreen`,
  `month-report/ui/styles`, `month-close/ui/Choice`) — в `chart` / отдельную палитру `shared/theme`.

Правило линта B2 (после этапа 3): нет `'#…'` / `rgba(` и чисел у `fontSize`, отступов и радиусов вне `shared/theme`.

## Порядок этапа 4

1 плашка → 2 пусто → 3 загрузка / ошибка → 5 ссылки → 7 заголовки и полосы → 6 чипы → 8 переключатели → 4 строки с
суммой (после скринов этапа 2: самая разнородная) → 9 кнопки-тексты (по линту) → 10 круги и бейджи.
