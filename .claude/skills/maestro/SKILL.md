---
name: maestro
description: Writing, running or debugging the Maestro e2e flows of this app on the Android emulator (tests/e2e/flows, run.sh, hooks, verify.ts). Use before touching anything under tests/e2e/flows or when a Maestro run fails.
---

# Maestro в этом проекте

Maestro — только то, что Jest не может: приём SMS Kotlin-ресивером в фоне, импорт входящих и разрешения, уведомления
в шторке. Всё остальное — тесты экранов (`tests/screens/`), см. CLAUDE.md.

Кейсы для устройства (что проверяет каждый сценарий, что вручную) — `tests/e2e/plan/`; номер кейса пишется в
первой строке-комментарии `.yaml` и `.sh` сценария.

## Запуск

```sh
~/.maestro/bin/maestro --version            # Maestro лежит здесь
tests/e2e/run.sh sms-receive              # один сценарий (все — без аргументов; полный прогон спрашивать у пользователя)
```

Нужен запущенный эмулятор `emulator-5554` (google_apis, `adb root`) с установленным приложением (`npm run emulator`).
Артефакты упавшего: `e2e-out/<flow>/` — скриншоты, logcat, вытянутая база.

## Как устроен сценарий

1. `tests/e2e/seed.ts` — база для сценария (`SEEDS[flow]`, по умолчанию `base`; строители — `seeds.ts`), подкладывается
   вместо базы приложения.
2. `run.sh`: все разрешения выданы, READ_SMS отозван; запуск через `am start` (не monkey).
3. `flows/<flow>.sh before` → `flows/<flow>.yaml` → `flows/<flow>.sh after` → `verify.ts <flow>` (проверка базы, `case`).
4. Хуки подключают `flows/common/hook.sh`: `sms "<text>" [sender]`, `sql "<query>"`, `wait_for "<query>" "<ожидаемое>"`,
   `notified "<regex>"` / `not_notified`, `clear_inbox`, `day [мин назад]` (dd/mm/yyyy), `hm` (hh:mm).
   Переменные: `ADB`, `DIR` (files приложения), `OUT`.
5. JS-ошибка — только строки `E ReactNativeJS` в logcat.

## Грабли (каждая стоила времени)

- `launchApp` по умолчанию выдаёт ВСЕ разрешения — для отказа — `launchApp: permissions: { android.permission.READ_SMS: unset, … }` (как в `import-denied.yaml`).
- READ_SMS выдаётся вместе с RECEIVE_SMS (одна группа).
- `hideKeyboard` жмёт Back (закрывает лист) — вместо него `pressKey: Enter`.
- `eraseText` не стирает кириллицу.
- Регэкспы матчат ВЕСЬ текст элемента: `".*Кафе и рестораны"`. Перед ₾ — неразрывный пробел: `"12\\.00.₾"`.
  Тост ошибки начинается с «⚠️  ».
- В `evalScript` нельзя `${}`-шаблоны и `": "` (ломает YAML).
- `force-stop` убирает уведомления приложения — не стопать между отправкой SMS и проверкой шторки.
- Развернуть уведомление: swipe от его текста ВНИЗ; открыть шторку — swipe `50%,1%` → `50%,80%`.
- `set -o pipefail` + `grep -q` рвёт пайп — grep по here-string (`<<<"$(…)"`), как в `notified`.
- `sqlite3` на эмуляторе без `json_extract` — `instr`; всегда `-cmd '.timeout 5000'` (приложение пишет параллельно).
- Ручные операции из seed'а имеют `source='sms'` — отличать по `sms_hash NOT LIKE 'manual:%'`.
- Пуш от имени пакета TBC с эмулятора не отправить — 1.3 только вручную.
