# Lodash to es-toolkit Migration Guide

## Overview

`es-toolkit/compat` provides 100% feature parity with lodash (since v1.39.3), tested against lodash's actual test suite. It is adopted by Storybook, Recharts, CKEditor, and recommended by Nuxt.

## Migration Strategy

### Step 1: Replace imports

```typescript
// BEFORE (lodash)
import { groupBy } from "lodash-es";
import _ from "lodash";

// AFTER (es-toolkit — preferred, better performance)
import { groupBy } from "es-toolkit/array";

// AFTER (es-toolkit/compat — drop-in replacement, identical API)
import { groupBy } from "es-toolkit/compat";
```

### Step 2: Choose the right import path

| Scenario                                    | Import from                                                         | Why                               |
| ------------------------------------------- | ------------------------------------------------------------------- | --------------------------------- |
| Function exists in es-toolkit with same API | `es-toolkit/<category>`                                             | Best performance, smallest bundle |
| Function needs lodash-specific edge cases   | `es-toolkit/compat`                                                 | 100% lodash compatibility         |
| Migrating incrementally                     | `es-toolkit/compat` first, then refactor to `es-toolkit/<category>` | Safe transition                   |

### Step 3: Prefer native over compat

```typescript
// AVOID — compat get() is slow due to path parsing
import { get } from "es-toolkit/compat";
get(obj, "a.b.c");

// PREFER — native optional chaining
obj?.a?.b?.c;

// AVOID — compat template() when template literals suffice
import { template } from "es-toolkit/compat";
template("hello <%= name %>")({ name: "world" });

// PREFER — template literal
`hello ${name}`;
```

## Import Path Mapping

| lodash import                   | es-toolkit equivalent                             |
| ------------------------------- | ------------------------------------------------- |
| `lodash/groupBy` or `lodash-es` | `es-toolkit/array` → `groupBy`                    |
| `lodash/debounce`               | `es-toolkit/function` → `debounce`                |
| `lodash/merge`                  | `es-toolkit/object` → `merge`                     |
| `lodash/pick`                   | `es-toolkit/object` → `pick`                      |
| `lodash/omit`                   | `es-toolkit/object` → `omit`                      |
| `lodash/cloneDeep`              | `es-toolkit/object` → `cloneDeep`                 |
| `lodash/isEqual`                | `es-toolkit/predicate` → `isEqual`                |
| `lodash/isNil`                  | `es-toolkit/predicate` → `isNil`                  |
| `lodash/snakeCase`              | `es-toolkit/string` → `snakeCase`                 |
| `lodash/camelCase`              | `es-toolkit/string` → `camelCase`                 |
| `lodash/sum`                    | `es-toolkit/math` → `sum`                         |
| `lodash/get`                    | `es-toolkit/compat` → `get` (prefer `?.` instead) |
| `lodash/set`                    | `es-toolkit/compat` → `set`                       |
| `lodash/has`                    | `es-toolkit/compat` → `has`                       |
| `lodash/template`               | `es-toolkit/compat` → `template`                  |
| `lodash/iteratee`               | `es-toolkit/compat` → `iteratee`                  |

## API Differences

### debounce

```typescript
// lodash: options.leading / options.trailing (booleans)
_.debounce(fn, 300, { leading: true, trailing: false });

// es-toolkit: options.edges (array)
debounce(fn, 300, { edges: ["leading"] });
debounce(fn, 300, { edges: ["leading", "trailing"] });

// es-toolkit also supports AbortSignal
debounce(fn, 300, { signal: controller.signal });
```

### merge — mutates vs immutable

```typescript
// lodash: merge mutates target (same in es-toolkit)
import { merge } from "es-toolkit/object";
merge(target, source); // mutates target

// es-toolkit exclusive: toMerged returns new object
import { toMerged } from "es-toolkit/object";
const result = toMerged(target, source); // target unchanged
```

### attempt — different return format

```typescript
// lodash: returns result or Error instance
const result = _.attempt(fn); // T | Error

// es-toolkit: returns [error, result] tuple
const [error, result] = attempt(fn); // [null, T] | [Error, null]
```

## NOT Supported in es-toolkit/compat

These lodash features have no equivalent:

| Feature                       | Reason                                                |
| ----------------------------- | ----------------------------------------------------- |
| `sortedUniq` / `sortedUniqBy` | Specialized sorted-array optimization not implemented |
| `mixin`                       | Global mutation of library not supported              |
| `noConflict`                  | Module system makes this unnecessary                  |
| `runInContext`                | JavaScript realm handling not supported               |
| Method chaining (`_.chain()`) | Use `flow()` for pipelines instead                    |
| Implicit type coercion        | Empty string → 0, etc. not replicated                 |

## Performance Impact

`es-toolkit/compat` is slightly slower and larger than `es-toolkit` proper, but still faster than lodash:

| Function     | es-toolkit           | es-toolkit/compat      | lodash-es |
| ------------ | -------------------- | ---------------------- | --------- |
| `merge`      | 271 B (3.65x faster) | 4,381 B (1.32x faster) | 12,483 B  |
| `pick`       | 132 B (3.43x faster) | —                      | 9,520 B   |
| `difference` | 90 B (2.02x faster)  | —                      | 7,958 B   |

**Recommendation**: Start with `es-toolkit/compat` for safe migration, then refactor to `es-toolkit/<category>` for best performance.
