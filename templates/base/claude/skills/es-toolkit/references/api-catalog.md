# es-toolkit API Catalog

Complete function reference organized by category. All functions have full TypeScript types.

## Table of Contents

- [Array](#array)
- [Object](#object)
- [String](#string)
- [Function](#function)
- [Math](#math)
- [Predicate](#predicate)
- [Promise](#promise)
- [Map](#map)
- [Set](#set)
- [Util](#util)

## Array

Import: `import { ... } from "es-toolkit/array";`

| Function           | Signature                                                                                    | Description                                |
| ------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `at`               | `(arr: T[], indices: number[]) => T[]`                                                       | Select elements at given indices           |
| `chunk`            | `(arr: T[], size: number) => T[][]`                                                          | Split array into chunks of size            |
| `compact`          | `(arr: T[]) => NonFalsy<T>[]`                                                                | Remove falsy values                        |
| `countBy`          | `(arr: T[], fn: (item: T) => string) => Record<string, number>`                              | Count elements by key                      |
| `difference`       | `(arr: T[], values: T[]) => T[]`                                                             | Elements in first but not second           |
| `differenceBy`     | `(arr: T[], values: T[], fn: (item: T) => U) => T[]`                                         | Difference using mapping function          |
| `differenceWith`   | `(arr: T[], values: T[], areEqual: (a: T, b: T) => boolean) => T[]`                          | Difference using comparator                |
| `drop`             | `(arr: T[], n?: number) => T[]`                                                              | Drop first n elements                      |
| `dropRight`        | `(arr: T[], n?: number) => T[]`                                                              | Drop last n elements                       |
| `dropWhile`        | `(arr: T[], predicate: (item: T) => boolean) => T[]`                                         | Drop while predicate is true               |
| `dropRightWhile`   | `(arr: T[], predicate: (item: T) => boolean) => T[]`                                         | Drop from right while true                 |
| `fill`             | `(arr: T[], value: U, start?: number, end?: number) => Array<T\|U>`                          | Fill with value                            |
| `flatMap`          | `(arr: T[], fn: (item: T) => U[]) => U[]`                                                    | Map and flatten one level                  |
| `flatMapDeep`      | `(arr: T[], fn: (item: T) => U) => Flat<U>[]`                                                | Map and flatten recursively                |
| `flatten`          | `(arr: T[][]) => T[]`                                                                        | Flatten one level                          |
| `flattenDeep`      | `(arr: any[]) => T[]`                                                                        | Flatten recursively                        |
| `groupBy`          | `(arr: T[], fn: (item: T) => K) => Record<K, T[]>`                                           | Group elements by key                      |
| `head`             | `(arr: T[]) => T \| undefined`                                                               | Get first element                          |
| `initial`          | `(arr: T[]) => T[]`                                                                          | All elements except last                   |
| `intersection`     | `(arr1: T[], arr2: T[]) => T[]`                                                              | Common elements                            |
| `intersectionBy`   | `(arr1: T[], arr2: T[], fn: (item: T) => U) => T[]`                                          | Intersection using mapper                  |
| `intersectionWith` | `(arr1: T[], arr2: T[], areEqual: (a: T, b: T) => boolean) => T[]`                           | Intersection using comparator              |
| `last`             | `(arr: T[]) => T \| undefined`                                                               | Get last element                           |
| `maxBy`            | `(arr: T[], fn: (item: T) => number) => T \| undefined`                                      | Element with max mapped value              |
| `minBy`            | `(arr: T[], fn: (item: T) => number) => T \| undefined`                                      | Element with min mapped value              |
| `orderBy`          | `(arr: T[], keys: Array<keyof T \| (item: T) => any>, orders?: Array<"asc"\|"desc">) => T[]` | Sort by multiple keys with direction       |
| `partition`        | `(arr: T[], fn: (item: T) => boolean) => [T[], T[]]`                                         | Split into pass/fail groups                |
| `remove`           | `(arr: T[], predicate: (item: T) => boolean) => T[]`                                         | Remove matching elements (returns removed) |
| `sample`           | `(arr: T[]) => T`                                                                            | Random element                             |
| `sampleSize`       | `(arr: T[], n: number) => T[]`                                                               | Random n elements                          |
| `shuffle`          | `(arr: T[]) => T[]`                                                                          | Randomize order                            |
| `sortBy`           | `(arr: T[], fns: Array<(item: T) => any>) => T[]`                                            | Stable sort by multiple criteria           |
| `tail`             | `(arr: T[]) => T[]`                                                                          | All elements except first                  |
| `take`             | `(arr: T[], n?: number) => T[]`                                                              | Take first n elements                      |
| `takeRight`        | `(arr: T[], n?: number) => T[]`                                                              | Take last n elements                       |
| `takeWhile`        | `(arr: T[], predicate: (item: T) => boolean) => T[]`                                         | Take while predicate is true               |
| `takeRightWhile`   | `(arr: T[], predicate: (item: T) => boolean) => T[]`                                         | Take from right while true                 |
| `toFilled`         | `(arr: T[], value: U, start?: number, end?: number) => Array<T\|U>`                          | Fill (returns new array)                   |
| `union`            | `(arr1: T[], arr2: T[]) => T[]`                                                              | Union of two arrays                        |
| `unionBy`          | `(arr1: T[], arr2: T[], fn: (item: T) => U) => T[]`                                          | Union using mapper                         |
| `unionWith`        | `(arr1: T[], arr2: T[], areEqual: (a: T, b: T) => boolean) => T[]`                           | Union using comparator                     |
| `uniq`             | `(arr: T[]) => T[]`                                                                          | Unique elements                            |
| `uniqBy`           | `(arr: T[], fn: (item: T) => U) => T[]`                                                      | Unique by mapped value                     |
| `uniqWith`         | `(arr: T[], areEqual: (a: T, b: T) => boolean) => T[]`                                       | Unique using comparator                    |
| `unzip`            | `(arr: T[][]) => T[][]`                                                                      | Inverse of zip                             |
| `unzipWith`        | `(arr: T[][], fn: (...args: T[]) => U) => U[]`                                               | Unzip with transform                       |
| `without`          | `(arr: T[], ...values: T[]) => T[]`                                                          | Remove specific values                     |
| `xor`              | `(arr1: T[], arr2: T[]) => T[]`                                                              | Symmetric difference                       |
| `zip`              | `(arr1: T[], arr2: U[]) => [T, U][]`                                                         | Pair elements by index                     |
| `zipWith`          | `(arr1: T[], arr2: U[], fn: (a: T, b: U) => R) => R[]`                                       | Zip with transform                         |
| `zipObject`        | `(keys: string[], values: T[]) => Record<string, T>`                                         | Create object from key/value arrays        |

## Object

Import: `import { ... } from "es-toolkit/object";`

| Function    | Signature                                                                              | Description                                                  |
| ----------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `clone`     | `(obj: T) => T`                                                                        | Shallow clone                                                |
| `cloneDeep` | `(obj: T) => T`                                                                        | Deep clone (handles Date, RegExp, Map, Set, ArrayBuffer)     |
| `invert`    | `(obj: Record<string, T>) => Record<string, string>`                                   | Swap keys and values                                         |
| `invertBy`  | `(obj: Record<string, T>, fn?: (value: T) => string) => Record<string, string[]>`      | Invert with grouping                                         |
| `merge`     | `(target: T, source: S) => T & S`                                                      | Deep merge (MUTATES target). `undefined` does not overwrite. |
| `toMerged`  | `(target: T, source: S) => T & S`                                                      | Deep merge (returns NEW object)                              |
| `omit`      | `(obj: T, keys: K[]) => Omit<T, K>`                                                    | Remove specified keys                                        |
| `omitBy`    | `(obj: T, predicate: (value, key) => boolean) => Partial<T>`                           | Remove keys by predicate                                     |
| `pick`      | `(obj: T, keys: K[]) => Pick<T, K>`                                                    | Select specified keys                                        |
| `pickBy`    | `(obj: T, predicate: (value, key) => boolean) => Partial<T>`                           | Select keys by predicate                                     |
| `mapKeys`   | `(obj: Record<string, T>, fn: (value: T, key: string) => string) => Record<string, T>` | Transform keys                                               |
| `mapValues` | `(obj: Record<string, T>, fn: (value: T, key: string) => U) => Record<string, U>`      | Transform values                                             |

## String

Import: `import { ... } from "es-toolkit/string";`

| Function       | Signature                                                                 | Description                                  |
| -------------- | ------------------------------------------------------------------------- | -------------------------------------------- |
| `camelCase`    | `(str: string) => string`                                                 | `"foo-bar"` → `"fooBar"`                     |
| `snakeCase`    | `(str: string) => string`                                                 | `"fooBar"` → `"foo_bar"`                     |
| `kebabCase`    | `(str: string) => string`                                                 | `"FooBar"` → `"foo-bar"`                     |
| `pascalCase`   | `(str: string) => string`                                                 | `"foo-bar"` → `"FooBar"`                     |
| `constantCase` | `(str: string) => string`                                                 | `"fooBar"` → `"FOO_BAR"`                     |
| `capitalize`   | `(str: string) => string`                                                 | `"hello"` → `"Hello"`                        |
| `lowerCase`    | `(str: string) => string`                                                 | `"Foo Bar"` → `"foo bar"`                    |
| `upperCase`    | `(str: string) => string`                                                 | `"foo bar"` → `"FOO BAR"`                    |
| `lowerFirst`   | `(str: string) => string`                                                 | `"FOO"` → `"fOO"`                            |
| `upperFirst`   | `(str: string) => string`                                                 | `"foo"` → `"Foo"`                            |
| `startCase`    | `(str: string) => string`                                                 | `"fooBar"` → `"Foo Bar"`                     |
| `deburr`       | `(str: string) => string`                                                 | Remove diacritics: `"cafe\u0301"` → `"cafe"` |
| `escapeRegExp` | `(str: string) => string`                                                 | Escape regex special chars                   |
| `trim`         | `(str: string, chars?: string) => string`                                 | Trim characters                              |
| `trimStart`    | `(str: string, chars?: string) => string`                                 | Trim from start                              |
| `trimEnd`      | `(str: string, chars?: string) => string`                                 | Trim from end                                |
| `truncate`     | `(str: string, options: { length: number, omission?: string }) => string` | Truncate with ellipsis                       |
| `pad`          | `(str: string, length: number, chars?: string) => string`                 | Pad both sides                               |
| `padStart`     | `(str: string, length: number, chars?: string) => string`                 | Pad start                                    |
| `padEnd`       | `(str: string, length: number, chars?: string) => string`                 | Pad end                                      |
| `words`        | `(str: string) => string[]`                                               | Split into words                             |

## Function

Import: `import { ... } from "es-toolkit/function";`

| Function    | Signature                                                                                  | Description                                                             |
| ----------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `debounce`  | `(fn: F, ms: number, opts?: { signal?, edges? }) => DebouncedFunction<F>`                  | Delay execution. Returns fn with `.cancel()`, `.flush()`, `.schedule()` |
| `throttle`  | `(fn: F, ms: number, opts?: { edges? }) => ThrottledFunction<F>`                           | Limit execution rate. Returns fn with `.cancel()`, `.flush()`           |
| `once`      | `(fn: F) => F`                                                                             | Execute only once, cache result                                         |
| `memoize`   | `(fn: F, options?: { cache?, getCacheKey? }) => F`                                         | Cache results by arguments                                              |
| `retry`     | `(fn: () => Promise<T>, opts?: { retries?, delay?, signal?, shouldRetry? }) => Promise<T>` | Retry async fn with backoff                                             |
| `flow`      | `(...fns: Function[]) => Function`                                                         | Left-to-right function composition                                      |
| `flowRight` | `(...fns: Function[]) => Function`                                                         | Right-to-left function composition                                      |
| `identity`  | `(value: T) => T`                                                                          | Returns the value unchanged                                             |
| `noop`      | `() => void`                                                                               | Does nothing                                                            |
| `asyncNoop` | `() => Promise<void>`                                                                      | Async no-op                                                             |
| `spread`    | `(fn: (args: T[]) => R) => (...args: T[]) => R`                                            | Spread array as arguments                                               |
| `after`     | `(n: number, fn: F) => F`                                                                  | Execute after n calls                                                   |
| `before`    | `(n: number, fn: F) => F`                                                                  | Execute only before n calls                                             |
| `curry`     | `(fn: F) => CurriedFunction<F>`                                                            | Curry a function                                                        |
| `negate`    | `(fn: (...args) => boolean) => (...args) => boolean`                                       | Negate predicate                                                        |
| `ary`       | `(fn: F, n: number) => F`                                                                  | Limit argument count                                                    |
| `unary`     | `(fn: F) => (arg: T) => R`                                                                 | Accept only one argument                                                |

## Math

Import: `import { ... } from "es-toolkit/math";`

| Function    | Signature                                                 | Description                  |
| ----------- | --------------------------------------------------------- | ---------------------------- |
| `sum`       | `(arr: number[]) => number`                               | Sum of numbers               |
| `sumBy`     | `(arr: T[], fn: (item: T) => number) => number`           | Sum by mapped value          |
| `mean`      | `(arr: number[]) => number`                               | Average                      |
| `meanBy`    | `(arr: T[], fn: (item: T) => number) => number`           | Average by mapped value      |
| `max`       | `(arr: number[]) => number`                               | Maximum value                |
| `min`       | `(arr: number[]) => number`                               | Minimum value                |
| `round`     | `(value: number, precision?: number) => number`           | Round to precision           |
| `ceil`      | `(value: number, precision?: number) => number`           | Ceil to precision            |
| `floor`     | `(value: number, precision?: number) => number`           | Floor to precision           |
| `clamp`     | `(value: number, min: number, max: number) => number`     | Clamp to range               |
| `inRange`   | `(value: number, min: number, max: number) => boolean`    | Check if in range            |
| `random`    | `(min: number, max: number) => number`                    | Random float                 |
| `randomInt` | `(min: number, max: number) => number`                    | Random integer in [min, max) |
| `range`     | `(start: number, end: number, step?: number) => number[]` | Generate number range        |

## Predicate

Import: `import { ... } from "es-toolkit/predicate";`

| Function        | Signature                                                   | Description                                      |
| --------------- | ----------------------------------------------------------- | ------------------------------------------------ |
| `isNil`         | `(value: unknown) => value is null \| undefined`            | Check null or undefined                          |
| `isNotNil`      | `(value: T) => value is NonNullable<T>`                     | Type guard: not null/undefined                   |
| `isNull`        | `(value: unknown) => value is null`                         | Check null                                       |
| `isUndefined`   | `(value: unknown) => value is undefined`                    | Check undefined                                  |
| `isEqual`       | `(a: unknown, b: unknown) => boolean`                       | Deep structural equality                         |
| `isEqualWith`   | `(a: unknown, b: unknown, customizer: Function) => boolean` | Deep equality with custom comparator             |
| `isEmpty`       | `(value: unknown) => boolean`                               | Check if empty (array, object, string, Map, Set) |
| `isPlainObject` | `(value: unknown) => value is Record<string, any>`          | Check if plain object                            |
| `isBoolean`     | `(value: unknown) => value is boolean`                      | Type guard: boolean                              |
| `isString`      | `(value: unknown) => value is string`                       | Type guard: string                               |
| `isNumber`      | `(value: unknown) => value is number`                       | Type guard: number                               |
| `isFunction`    | `(value: unknown) => value is Function`                     | Type guard: function                             |
| `isDate`        | `(value: unknown) => value is Date`                         | Type guard: Date                                 |
| `isRegExp`      | `(value: unknown) => value is RegExp`                       | Type guard: RegExp                               |
| `isError`       | `(value: unknown) => value is Error`                        | Type guard: Error                                |
| `isMap`         | `(value: unknown) => value is Map`                          | Type guard: Map                                  |
| `isSet`         | `(value: unknown) => value is Set`                          | Type guard: Set                                  |
| `isArray`       | `(value: unknown) => value is any[]`                        | Type guard: Array                                |
| `isTypedArray`  | `(value: unknown) => boolean`                               | Check typed array                                |
| `isArrayLike`   | `(value: unknown) => boolean`                               | Check array-like                                 |
| `isInteger`     | `(value: unknown) => boolean`                               | Check integer                                    |
| `isSymbol`      | `(value: unknown) => value is symbol`                       | Type guard: symbol                               |
| `isBrowser`     | `() => boolean`                                             | Check if running in browser                      |

## Promise

Import: `import { ... } from "es-toolkit/promise";`

| Function    | Signature                                                                                               | Description                          |
| ----------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `delay`     | `(ms: number) => Promise<void>`                                                                         | Wait for duration                    |
| `timeout`   | `(promise: Promise<T>, ms: number) => Promise<T>`                                                       | Reject if promise takes too long     |
| `Mutex`     | `class { acquire(): Promise<void>; release(): void; isLocked: boolean }`                                | Mutual exclusion — 1 concurrent task |
| `Semaphore` | `class { constructor(capacity: number); acquire(): Promise<void>; release(): void; available: number }` | Limit to N concurrent tasks          |

## Map

Import: `import { ... } from "es-toolkit/map";`

| Function    | Signature                                                                              | Description             |
| ----------- | -------------------------------------------------------------------------------------- | ----------------------- |
| `mapKeys`   | `(obj: Record<string, T>, fn: (value: T, key: string) => string) => Record<string, T>` | Transform object keys   |
| `mapValues` | `(obj: Record<string, T>, fn: (value: T, key: string) => U) => Record<string, U>`      | Transform object values |

## Set

Import: `import { ... } from "es-toolkit/set";`

| Function | Signature                                        | Description                 |
| -------- | ------------------------------------------------ | --------------------------- |
| `keyBy`  | `(arr: T[], fn: (item: T) => K) => Record<K, T>` | Index array elements by key |

## Util

Import: `import { ... } from "es-toolkit/util";`

| Function       | Signature                                                    | Description                                                                    |
| -------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `attempt`      | `(fn: () => T) => [null, T] \| [E, null]`                    | Safe sync execution (tuple return). Do NOT use with async — use `attemptAsync` |
| `attemptAsync` | `(fn: () => Promise<T>) => Promise<[null, T] \| [E, null]>`  | Safe async execution (tuple return)                                            |
| `invariant`    | `(condition: unknown, message: string) => asserts condition` | Assert condition or throw                                                      |
