import { openDatabase } from '../src/db/driver';

function db() {
  const d = openDatabase(':memory:');
  return d.run('CREATE TABLE t (v INTEGER)').then(() => d);
}

const values = async (d: Awaited<ReturnType<typeof db>>) => (await d.all<{ v: number }>('SELECT v FROM t ORDER BY v')).map((r) => r.v);

describe('serialized connection', () => {
  it('a statement issued during a transaction runs after it and survives its rollback', async () => {
    const d = await db();
    let release!: () => void;
    const paused = new Promise<void>((r) => { release = r; });
    const tx = d.transaction(async (t) => {
      await t.run('INSERT INTO t VALUES (1)');
      await paused;
      throw new Error('boom');
    });
    // e.g. the SMS task writing while a screen's transaction is open
    const outside = d.run('INSERT INTO t VALUES (2)');
    release();
    await expect(tx).rejects.toThrow('boom');
    await outside;
    expect(await values(d)).toEqual([2]);
  });

  it('commits the transaction writes and returns its result', async () => {
    const d = await db();
    const r = await d.transaction(async (t) => { await t.run('INSERT INTO t VALUES (1)'); await t.transaction((u) => u.run('INSERT INTO t VALUES (3)')); return 'ok'; });
    expect(r).toBe('ok');
    expect(await values(d)).toEqual([1, 3]);
  });

  it('a failed statement does not block the queue', async () => {
    const d = await db();
    await expect(d.run('INSERT INTO missing VALUES (1)')).rejects.toThrow();
    await d.run('INSERT INTO t VALUES (4)');
    expect(await values(d)).toEqual([4]);
  });
});
