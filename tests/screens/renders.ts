// How many times each component rendered during an action (REFACTOR_PLAN.md D1): the renderer reports each commit to
// React DevTools' global hook, installed here (setup.ts, before React loads). A component rendered in a commit when its
// fiber is a new one (the previous commit's tree didn't have it) that did work — a bailed-out subtree keeps its fibers,
// a memo that skipped is a new fiber without work. The way the DevTools profiler tells it.

interface Fiber {
  tag: number;
  type: unknown;
  flags: number;
  child: Fiber | null;
  sibling: Fiber | null;
}
interface FiberRoot {
  current: Fiber;
}

const PERFORMED_WORK = 1;
/** function, class, forwardRef, simple memo: the fibers of a component's own render (a memo wrapper's is its child's) */
const COMPONENT_TAGS = new Set([0, 1, 11, 15]);

const roots = new Set<FiberRoot>();
/** each root's fibers at its last commit */
const seenOf = new WeakMap<FiberRoot, WeakSet<Fiber>>();
let counts: Map<string, number> | null = null;

function nameOf(type: unknown): string {
  if (!type) return 'Anonymous';
  if (typeof type === 'string') return type;
  const t = type as { displayName?: string; name?: string; render?: unknown; type?: unknown };
  if (t.displayName) return t.displayName;
  if (typeof type === 'function' && t.name) return t.name;
  if (t.render) return nameOf(t.render);
  if (t.type) return nameOf(t.type);
  return 'Anonymous';
}

/** walks a tree: remembers its fibers and, when counting, counts the ones that rendered in this commit */
function walk(root: FiberRoot) {
  const seen = seenOf.get(root) ?? new WeakSet<Fiber>();
  const next = new WeakSet<Fiber>();
  const stack: Fiber[] = [root.current];
  while (stack.length) {
    const f = stack.pop()!;
    next.add(f);
    if (counts && COMPONENT_TAGS.has(f.tag) && !seen.has(f) && f.flags & PERFORMED_WORK) {
      const name = nameOf(f.type);
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    if (f.sibling) stack.push(f.sibling);
    if (f.child) stack.push(f.child);
  }
  seenOf.set(root, next);
}

function snapshot() {
  for (const r of roots) walk(r);
}

export function installRenderCounter() {
  const g = globalThis as { __REACT_DEVTOOLS_GLOBAL_HOOK__?: object };
  if (g.__REACT_DEVTOOLS_GLOBAL_HOOK__) return;
  let id = 0;
  g.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    isDisabled: false,
    renderers: new Map(),
    inject: () => ++id,
    checkDCE: () => {},
    onScheduleFiberRoot: () => {},
    onCommitFiberUnmount: () => {},
    onPostCommitFiberRoot: () => {},
    onCommitFiberRoot: (_id: number, root: FiberRoot) => {
      roots.add(root);
      if (counts) walk(root);
    },
  };
}

export interface Renders {
  /** all the components' renders */
  total: number;
  /** renders of the component of this name (its function's name or displayName) */
  of(name: string): number;
  /** the most rendered ones, for a test's message or a look */
  top(n?: number): [string, number][];
}

/** Counts the renders during `action` (taps, scrolls, typing) until it and what it started settle. */
export async function countRenders(action: () => unknown): Promise<Renders> {
  snapshot();
  counts = new Map();
  const c = counts;
  try {
    await action();
  } finally {
    counts = null;
  }
  const sorted = [...c.entries()].sort((a, b) => b[1] - a[1]);
  return {
    total: sorted.reduce((n, [, v]) => n + v, 0),
    of: (name) => c.get(name) ?? 0,
    top: (n = 10) => sorted.slice(0, n),
  };
}
