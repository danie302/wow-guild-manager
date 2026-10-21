import { clsNamespace } from './cls.js';
import { Member } from './models/index.js';

/**
 * Runs `work` in a transaction; queries inside join it through CLS. Inside another
 * transaction it joins that one, so domain functions that use it can be combined (approving a
 * registration adds a member in the same transaction). Without this, a nested
 * sequelize.transaction() would start a second, separate transaction.
 */
export function transaction<T>(work: () => Promise<T>): Promise<T> {
  if (clsNamespace.get('transaction')) return work();
  return Member.sequelize!.transaction(work);
}
