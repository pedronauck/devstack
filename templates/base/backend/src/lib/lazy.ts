export function createLazyProxy<T extends object>(factory: () => T): T {
  return new Proxy({} as T, {
    get(_target, property, receiver) {
      const target = factory();
      const value = Reflect.get(target, property, receiver);

      if (typeof value === "function") {
        return value.bind(target);
      }

      return value;
    },
  });
}
