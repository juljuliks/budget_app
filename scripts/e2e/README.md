# End-to-end flows

Run on a local emulator (a `google_apis` image: the script needs `adb root` to put the database in place):

```sh
npm ci
scripts/e2e/run.sh path/to/budget-app-1.0.N.apk          # every flow
scripts/e2e/run.sh delete-sort-out                       # one flow, the app already installed
```

Each flow starts from `seed.ts`'s database, runs its Maestro steps (`flows/*.yaml`: taps, and checks of the texts on
the screens), then the database is pulled back and checked by `verify.ts`. A JS error in logcat fails the flow too.
Screenshots of a failing step, logcat and the pulled database: `e2e-out/<flow>/`.

Without an emulator, `simulate.ts` does what the flows do with the app's functions, to check `seed.ts` and
`verify.ts` agree:

```sh
npx tsc -p scripts/e2e
node dist-e2e/scripts/e2e/seed.js /tmp/e.db && node dist-e2e/scripts/e2e/simulate.js delete-sort-out /tmp/e.db \
  && node dist-e2e/scripts/e2e/verify.js delete-sort-out /tmp/e.db
```

## Flows

The seed: «Покупки» with this month's ZARA ×2 and HM (merchants of it), WOLT (picked by hand) — 4 operations on
360 ₾ — and past ZARA, APPLE (1 000 ₾); «Одежда», «Техника» to move them to; «Пустая» with a past OLDSHOP only.

| flow | what it checks |
|---|---|
| `delete-empty` | no operations this month: the plain confirmation (the past kept, the merchant loses it), deleted |
| `delete-move-all` | all to one category: the picker with «Сохранить», the confirmation's text, moved; the past stays in «Покупки», fixed; the merchants move |
| `delete-sort-out` | to several: the list grouped by merchant with the banner; ZARA with its merchant (this month only), HM alone, WOLT to none; the counts on the banner; the summary; deleted |
| `delete-sort-out-leave` | the category filter locked; «Отменить» and back ask; «Продолжить» stays; «Прервать» keeps the category and what was moved |

## By hand

- In a sort-out, «Дата» narrows within this month only: a range reaching outside is cut to the month (a toast says so).
- Leaving the Operations tab during a sort-out and coming back: it goes on.
