---
name: es-toolkit
description: |
  es-toolkit utility library guide for modern JavaScript/TypeScript. Use when:
  (1) Writing utility functions (array manipulation, object transforms, string conversion,
  math operations, type checks), (2) Migrating from lodash, (3) Needing debounce/throttle/retry,
  (4) Working with async primitives (Mutex, Semaphore, delay),
  (5) Any code that could use es-toolkit instead of custom implementation.
  Triggers on: es-toolkit, lodash, utility function, debounce, throttle, groupBy, pick, omit,
  merge, cloneDeep, snakeCase, camelCase, isNil, isEqual, retry, Mutex, Semaphore, attempt.
  Do NOT use for: general JavaScript questions unrelated to utilities, or React/framework-specific code.
---

# es-toolkit Usage Guide

es-toolkit is a modern JavaScript utility library — 2-3x faster and up to 97% smaller than lodash.
It has 100% test coverage, built-in TypeScript types, and supports Node.js 18+, Deno, Bun, and browsers.

## Import Rules

ALWAYS use subpath imports for tree-shaking. NEVER import from the top-level barrel.

```typescript
// CORRECT — subpath imports (tree-shakeable)
import { groupBy } from "es-toolkit/array";
import { debounce } from "es-toolkit/function";
import { pick, omit } from "es-toolkit/object";
import { snakeCase } from "es-toolkit/string";
import { sum } from "es-toolkit/math";
import { isNil } from "es-toolkit/predicate";
import { delay, Mutex, Semaphore } from "es-toolkit/promise";
import { attempt } from "es-toolkit/util";
import { mapKeys } from "es-toolkit/map";
import { keyBy } from "es-toolkit/set";

// ALSO CORRECT — top-level for classes/quick scripts
import { Mutex, Semaphore } from "es-toolkit";

// CORRECT — compat layer (lodash-compatible API)
import { get, set, template } from "es-toolkit/compat";

// WRONG — never do this
import _ from "es-toolkit";
import { groupBy } from "es-toolkit/dist/array";
```

## Decision Guide

Before writing any utility function, check this hierarchy:

1. **Native JS/TS** — Use native when it's equally readable and performant
   - `Array.prototype.map/filter/reduce/find/some/every/flat/flatMap`
   - `Object.keys/values/entries/assign/fromEntries`
   - `structuredClone()` for deep cloning (but `cloneDeep` handles edge cases better)
   - `?.` optional chaining instead of `get(obj, 'a.b.c')`

2. **es-toolkit** — Use when native is verbose, error-prone, or missing the operation
   - Array: `groupBy`, `sortBy`, `orderBy`, `uniq`, `uniqBy`, `difference`, `intersection`, `union`, `chunk`, `zip`, `shuffle`, `sample`
   - Object: `pick`, `omit`, `pickBy`, `omitBy`, `merge`, `toMerged`, `cloneDeep`, `invert`
   - String: `camelCase`, `snakeCase`, `kebabCase`, `capitalize`, `pascalCase`, `constantCase`, `deburr`, `escapeRegExp`
   - Function: `debounce`, `throttle`, `once`, `memoize`, `retry`, `flow`, `flowRight`, `noop`
   - Math: `sum`, `sumBy`, `mean`, `meanBy`, `round`, `clamp`, `inRange`, `random`, `randomInt`
   - Predicate: `isNil`, `isNotNil`, `isEqual`, `isEqualWith`, `isEmpty`, `isPlainObject`
   - Promise: `delay`, `timeout`, `Mutex`, `Semaphore`
   - Util: `attempt`, `attemptAsync`, `invariant`

3. **es-toolkit/compat** — Only for lodash migration or when you need exact lodash behavior
   - `get`, `set`, `has`, `template`, `iteratee`, `matches`, `property`
   - Prefer native `?.` over `get()` — compat `get` is slower due to path parsing

## Quick Reference — Most Used Functions

### Array

```typescript
import {
  groupBy,
  sortBy,
  uniqBy,
  difference,
  chunk,
  zip,
  sample,
  countBy,
  flatMapDeep,
  orderBy,
} from "es-toolkit/array";

groupBy(items, item => item.category); // Record<string, T[]>
sortBy(users, [u => u.age, u => u.name]); // T[] — stable multi-key sort
orderBy(users, ["age", "name"], ["asc", "desc"]); // T[] — with direction control
uniqBy(items, item => item.id); // T[] — unique by key
difference([1, 2, 3], [2, 3]); // [1]
chunk([1, 2, 3, 4, 5], 2); // [[1,2], [3,4], [5]]
zip(["a", "b"], [1, 2]); // [["a",1], ["b",2]]
sample([1, 2, 3]); // random element
countBy([1, 2, 3, 4], n => (n % 2 === 0 ? "even" : "odd")); // { even: 2, odd: 2 }
```

### Object

```typescript
import {
  pick,
  omit,
  merge,
  toMerged,
  cloneDeep,
  pickBy,
  omitBy,
  invert,
  clone,
} from "es-toolkit/object";

pick(user, ["name", "email"]); // { name, email }
omit(user, ["password", "secret"]); // everything except those keys
merge(target, source); // deep merge (MUTATES target)
toMerged(target, source); // deep merge (returns NEW object)
cloneDeep(complexObj); // deep clone (handles Date, RegExp, Map, Set)
pickBy(obj, (value, key) => value != null); // pick by predicate
invert({ a: "1", b: "2" }); // { "1": "a", "2": "b" }
```

### Function

```typescript
import {
  debounce,
  throttle,
  once,
  retry,
  flow,
  memoize,
  noop,
  identity,
} from "es-toolkit/function";

// Debounce with cancel/flush and AbortSignal support
const search = debounce(query => fetchResults(query), 300);
search.cancel();
search.flush();

// Debounce with leading edge
const leading = debounce(fn, 300, { edges: ["leading"] });

// Throttle
const onScroll = throttle(handleScroll, 100);

// Retry with exponential backoff
const data = await retry(fetchData, {
  retries: 5,
  delay: attempt => Math.min(100 * 2 ** attempt, 5000),
  shouldRetry: (err, attempt) => err.status >= 500,
  signal: controller.signal,
});

// Function composition pipeline
const transform = flow(trim, toLowerCase, split(" "), filterEmpty);

// Execute only once
const initialize = once(() => expensiveSetup());
```

### Promise & Concurrency

```typescript
import { delay, timeout, Mutex, Semaphore } from "es-toolkit/promise";

await delay(1000); // wait 1 second
const result = await timeout(fetchData(), 5000); // timeout after 5s

// Mutex — single concurrent task
const mutex = new Mutex();
await mutex.acquire();
try {
  /* critical section */
} finally {
  mutex.release();
}

// Semaphore — N concurrent tasks
const sem = new Semaphore(3);
await sem.acquire();
try {
  /* max 3 concurrent */
} finally {
  sem.release();
}
```

### String

```typescript
import {
  camelCase,
  snakeCase,
  kebabCase,
  pascalCase,
  capitalize,
  constantCase,
  deburr,
  escapeRegExp,
} from "es-toolkit/string";

camelCase("foo-bar"); // "fooBar"
snakeCase("fooBar"); // "foo_bar"
kebabCase("FooBar"); // "foo-bar"
pascalCase("foo-bar"); // "FooBar"
constantCase("fooBar"); // "FOO_BAR"
capitalize("hello"); // "Hello"
deburr("cafe\u0301"); // "cafe"
escapeRegExp("a.b*c"); // "a\\.b\\*c"
```

### Math

```typescript
import {
  sum,
  sumBy,
  mean,
  meanBy,
  round,
  clamp,
  inRange,
  random,
  randomInt,
} from "es-toolkit/math";

sum([1, 2, 3]); // 6
sumBy(products, p => p.price * p.quantity); // total
round(1.2345, 2); // 1.23
clamp(15, 0, 10); // 10
inRange(5, 1, 10); // true
randomInt(1, 100); // random integer in [1, 100)
```

### Predicate (Type Guards)

```typescript
import { isNil, isNotNil, isEqual, isEmpty, isPlainObject } from "es-toolkit/predicate";

isNil(null); // true — null or undefined
isNotNil(value); // true — narrows type to exclude null/undefined
isEqual({ a: 1 }, { a: 1 }); // true — deep structural equality
isEmpty([]); // true
isPlainObject({}); // true
```

### Util

```typescript
import { attempt, attemptAsync, invariant } from "es-toolkit/util";

// Safe sync execution — returns [error, result] tuple
const [error, result] = attempt(() => JSON.parse(input));

// Safe async execution
const [error, data] = await attemptAsync(async () => {
  const res = await fetch("/api/data");
  return res.json();
});

// Invariant — throws if condition is falsy
invariant(user != null, "User must exist");
```

## Lodash Migration

For complete lodash migration details, see [references/lodash-migration.md](references/lodash-migration.md).

Key points:

- `es-toolkit/compat` provides 100% lodash test compatibility (v1.39.3+)
- Import from `es-toolkit/compat` for drop-in replacement
- Prefer native `es-toolkit` over `es-toolkit/compat` for better performance
- NOT supported: `sortedUniq`, `sortedUniqBy`, `mixin`, `noConflict`, `runInContext`, method chaining (Seq)

## Full API Catalog

For the complete list of all functions by category, see [references/api-catalog.md](references/api-catalog.md).
