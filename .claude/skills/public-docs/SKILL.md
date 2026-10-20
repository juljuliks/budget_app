---
name: public-docs
description: Update the public documentation page on claude.ai (texts and screenshots) with what changed in the app since its last update. Use when asked to update the docs («обнови доку», «документация»), not as part of finish.
model: sonnet
---

# Публичная документация

Страница: https://claude.ai/artifact/7deJ2vgzirC8qzhTz63hbj (ссылка в README). Новую не создавать.

## Что изменилось с прошлого обновления

Точка отсчёта — коммит в [scripts/demo/docs-synced](../../../scripts/demo/docs-synced): по него документация
сверена. Всё приложение не перечитывать — только изменения после него.

```sh
S=$(head -1 scripts/demo/docs-synced)
git log --reverse --format='%h %ad %s' --date=short $S..HEAD -- src android GLOSSARY.md   # что поменялось в приложении
git diff $S..HEAD -- GLOSSARY.md                                                        # переименования терминов
git diff --stat $S..HEAD -- src/screens src/features src/entities src/widgets           # какие экраны затронуты
git status --short src android                                                          # незакоммиченное
```

- Сообщения коммитов описывают поведение и тексты — по ним составить список: функция / место → что изменилось.
  Неясно из сообщения — посмотреть `git show <h> -- src/…` нужного файла.
- Коммиты только про код без смены поведения («No behavior change», рефакторинг, тесты) пропустить.
- Поздний коммит мог отменить ранний (вернули, переименовали снова) — описывать итог, а не историю.
- Незакоммиченное в `src/` — не описывать: сначала закоммитить, иначе точка отсчёта соврёт. Сказать пользователю.

## Правка страницы

1. `Artifact` `action: "read"` с `url` страницы → правка сохранённого файла: только места из списка, тот же стиль,
   термины — по [GLOSSARY.md](../../../GLOSSARY.md). Устаревшее (убранная функция, старое название) — убрать.
2. Изменился экран на скриншоте → переснять: `scripts/demo/docs.sh` (эмулятор со свежей сборкой, `npm run emulator`;
   только нужные сценарии — `FLOWS="3-stats" scripts/demo/docs.sh`; демо-база — `scripts/demo/demoDb.ts`, сценарии —
   `scripts/demo/flows/docs/`), заменить кадр (JPEG шириной 420 px, data: URI). Новый экран — шаг в сценарий и кадр
   в нужный раздел. Демо-база не показывает новую функцию — дополнить `demoDb.ts`.
3. `Artifact` publish с тем же `url`.

## Отметить сверку

После публикации — в `scripts/demo/docs-synced` записать полный хеш `git rev-parse HEAD` (коммит, по который сверено).
Файл закоммитить отдельным коммитом «Docs synced up to <h>» — по просьбе («пуш»), до этого сказать, что он не закоммичен.

## Итог

Коротко: какие изменения попали в документацию, какие кадры пересняты, какие пропущены (и почему).
