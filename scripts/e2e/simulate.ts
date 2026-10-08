// What the flows do to the database, done here with the app's functions instead of the screens: checks that the seed and
// verify.ts agree without an emulator. Usage: node dist-e2e/scripts/e2e/simulate.js <flow name> db (after seed.js)
import { openDatabase } from '../../src/db/driver';
import { closeDb, getDb, useDb } from '../../src/db';
import { deleteCategory, findCategoryByName } from '../../src/db/categories';
import { setRatesFetcher } from '../../src/db/fx';
import { assignCategoryToMany } from '../../src/assign';
setRatesFetcher(async () => []);
const [flow, file] = process.argv.slice(2);
(async () => {
  await useDb(openDatabase(file));
  const id = async (n: string) => (await findCategoryByName(n, null))!.id;
  const now = new Date(); const from = Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);
  const opsOf = async (m: string) => (await (await getDb()).all<{ id: number }>('SELECT id FROM transactions WHERE merchant_key = ? AND occurred_at >= ?', [m, from])).map((r) => r.id);
  const shop = await id('Покупки');
  if (flow === 'delete-empty') await deleteCategory(await id('Пустая'), null);
  if (flow === 'delete-move-all') await deleteCategory(shop, await id('Одежда'));
  if (flow === 'delete-sort-out' || flow === 'delete-sort-out-leave') {
    await assignCategoryToMany(await opsOf('ZARA'), await id('Одежда'), 'merchant', shop);
    if (flow === 'delete-sort-out') {
      await assignCategoryToMany(await opsOf('HM'), await id('Техника'), 'only', shop);
      await assignCategoryToMany(await opsOf('WOLT'), null, undefined, shop);
      await deleteCategory(shop, null);
    }
  }
  await closeDb();
})().catch((e) => { console.error(e); process.exit(1); });
