/** A page of results from a list endpoint. */
export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
