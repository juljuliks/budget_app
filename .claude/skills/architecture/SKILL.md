---
name: architecture
description: Where code goes in this app and how big it may get (FSD-lite layers, import direction, file-size limits, commands for writes) and how to split a long file. Use before creating, moving or splitting a file under src/, before adding a component, hook, screen or a write to the database, and when a lint error about layers or sizes comes up.
---

# Архитектура: куда класть и как не разрастаться

Источник правды — [ARCHITECTURE.md](../../../ARCHITECTURE.md) §1 (правила). Проверяет `npm run lint`
(`eslint.config.js`): в слоях интерфейса это ошибки, и с ними релиз в CI не соберётся.

## Перед тем как писать код

1. Определить слой по таблице «Куда класть» (ARCHITECTURE.md §1). Сомнение entity / feature: есть шаги,
   подтверждения или последствия для других данных → feature; простая форма своей сущности → entity. Нужно только
   одному экрану → `screens/*/parts`.
2. Проверить импорты: только вниз (`app → screens → features → entities → shared`), не из соседнего слайса,
   снаружи — только через `index.ts`, между слоями — через `@/`. Ядро (`db/`, `parsers/`, `notifications/`…) не
   импортирует React-слои. Нижнему слою нужно верхнее — проп-колбэк (`CategorySheet` → `onDelete`) или шит через
   `sheets.ts` (`openMerchant`, `openSettings`; рисует `app/ModalHost`), не импорт.
3. Запись в базу — команда слайса (`model/commands.ts`: запись + `emitTransactionsChanged`), не вызов из компонента.
4. Прикинуть размер: файл ≤ 250 строк кода, компонент/функция ≤ 120, хук ≤ 100. Подходит к пределу — делить сейчас.
5. Расчёты — в `.ts` (`model/`) с тестом в `tests/logic/`; тексты — в `texts.ts` и по GLOSSARY.md; цвета — из темы
   (`colors.onAccent` для текста на акценте); месяцы и дни недели — `shared/lib/dates.ts`, не новая копия.

## Как делить длинный компонент

Так поделены операции, статистика, план, мерчанты (шаги 5–7 в ARCHITECTURE.md §2):

- **Данные** — хук `model/use<Name>Data.ts` (загрузка, `useLatestRequest`, подписка `onTransactionsChanged`).
- **Производное** — чистая функция `model/<name>View.ts`: из данных всё, что рисуют части (суммы, секции,
  форматтеры), в одном объекте; без React — с тестом в `tests/logic/`.
- **Действия** — хук `model/use<Name>Actions.ts` или команды: вопросы `sheetAlert`, тосты, команды записи.
- **Части** — `parts/` (экран) или `ui/` (слайс): компонент на файл, общий `styles.ts` слайса.
- **Липкие заголовки**: `StickyScrollView` липнет только к своим `SectionHeader` среди детей и фрагментов. Секцию с
  заголовком пишут функцией, возвращающей фрагмент (`limitSections(v, h)`), не компонентом.
- **Поведение не менять**: переносить текст и условия дословно; `git mv` для перемещений; после каждого шага —
  `npx tsc --noEmit -p .`, нужные тесты, в конце `npm test` через агента `test-runner`; затронуты SMS, уведомления
  или импорт — ещё e2e (`tests/e2e/run.sh`, скилл `maestro`).

## Проверка при `finish`

`npm run lint` — ошибок 0. Предупреждения остались только о длинных файлах `src/db/` (шаг 9 в ARCHITECTURE.md §2);
трогаешь такой файл — новое в него не дописывать, выносить отдельным модулем.
