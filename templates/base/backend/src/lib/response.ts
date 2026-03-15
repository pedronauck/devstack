import type { PaginatedResult } from "./pagination";

export interface DataEnvelope<T> {
  data: T;
}

export interface PaginatedEnvelope<T> extends PaginatedResult<T> {}

export function ok<T>(data: T): DataEnvelope<T> {
  return { data };
}

export function created<T>(data: T): DataEnvelope<T> {
  return { data };
}

export function paginated<T>(result: PaginatedResult<T>): PaginatedEnvelope<T> {
  return result;
}

export function noContent(): null {
  return null;
}
