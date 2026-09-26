// Helpers for repository unit tests. Repositories extend TypeORM's Repository and
// only keep the DataSource's EntityManager, so a stub is enough to construct them;
// the inherited query methods (find, existsBy, createQueryBuilder, ...) are spied on.
import type { DataSource } from 'typeorm';

export const stubDataSource = (): DataSource =>
  ({ createEntityManager: () => ({}) }) as unknown as DataSource;

// Every builder method records its call and returns the builder, so chains like
// qb.where(...).andWhere(...).orderBy(...) work; terminal methods resolve `result`.
export type QueryBuilderMock = Record<string, jest.Mock> & {
  // All calls to one method, e.g. calls('andWhere') -> [[sql, params], ...]
  calls: (method: string) => unknown[][];
};

const CHAIN_METHODS = [
  'select',
  'addSelect',
  'leftJoin',
  'leftJoinAndSelect',
  'where',
  'andWhere',
  'orWhere',
  'setParameter',
  'orderBy',
  'addOrderBy',
  'groupBy',
  'addGroupBy',
  'skip',
  'take',
];

export function createQueryBuilderMock(
  result: {
    getOne?: unknown;
    getManyAndCount?: [unknown[], number];
    getRawMany?: unknown[];
  } = {},
): QueryBuilderMock {
  const qb = {} as QueryBuilderMock;
  for (const method of CHAIN_METHODS) {
    qb[method] = jest.fn(() => qb);
  }
  qb.getOne = jest.fn().mockResolvedValue(result.getOne ?? null);
  qb.getManyAndCount = jest
    .fn()
    .mockResolvedValue(result.getManyAndCount ?? [[], 0]);
  qb.getRawMany = jest.fn().mockResolvedValue(result.getRawMany ?? []);
  qb.calls = (method: string) => qb[method].mock.calls as unknown[][];
  return qb;
}
