import { clamp } from "es-toolkit/math";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

type QueryValue = string | string[] | undefined;

export interface PaginationParams {
  limit: number;
  startingAfter?: string;
  endingBefore?: string;
}

export interface PaginationMeta {
  hasMore: boolean;
  nextCursor: string | null;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}

function getQueryValue(value: QueryValue): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function parseLimit(value: QueryValue): number {
  const rawValue = getQueryValue(value);

  if (!rawValue) {
    return DEFAULT_LIMIT;
  }

  const parsedValue = Number.parseInt(rawValue, 10);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return DEFAULT_LIMIT;
  }

  return clamp(parsedValue, DEFAULT_LIMIT, MAX_LIMIT);
}

export function parsePaginationParams(query: Record<string, QueryValue>): PaginationParams {
  const startingAfter = getQueryValue(query.starting_after);
  const endingBefore = getQueryValue(query.ending_before);

  return {
    limit: parseLimit(query.limit),
    ...(startingAfter ? { startingAfter } : {}),
    ...(endingBefore ? { endingBefore } : {}),
  };
}

export function buildPaginatedResponse<T>(
  items: T[],
  limit: number,
  getId: (item: T) => string
): PaginatedResult<T> {
  const hasMore = items.length > limit;
  const data = hasMore ? items.slice(0, limit) : items;
  const lastItem = data.at(-1);

  return {
    data,
    meta: {
      hasMore,
      nextCursor: hasMore && lastItem ? getId(lastItem) : null,
    },
  };
}
