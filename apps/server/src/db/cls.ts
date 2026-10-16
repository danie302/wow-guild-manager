import { AsyncLocalStorage } from 'node:async_hooks';

type Context = Map<string, unknown>;

const storage = new AsyncLocalStorage<Context>();

/**
 * A CLS namespace for Sequelize.useCLS, built on Node's AsyncLocalStorage instead of the
 * unmaintained cls-hooked package. Sequelize uses it to store the current transaction, so
 * queries inside sequelize.transaction(async () => { … }) join it without passing { transaction }.
 *
 * Like cls-hooked, run() starts a child context that inherits its parent's values, so a nested
 * transaction doesn't overwrite the outer one.
 */
export const clsNamespace = {
  run<T>(fn: (context: Context) => T): T {
    const context: Context = new Map(storage.getStore());
    return storage.run(context, () => fn(context));
  },

  get(key: string): unknown {
    return storage.getStore()?.get(key);
  },

  set<T>(key: string, value: T): T {
    storage.getStore()?.set(key, value);
    return value;
  },

  bind<F extends (...args: never[]) => unknown>(fn: F): F {
    return AsyncLocalStorage.bind(fn);
  },
};
