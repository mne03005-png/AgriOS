import { ListQueryDto } from './dto/list-query.dto';

export interface PaginationOptions {
  defaultPageSize?: number;
  maxPageSize?: number;
}

export function getPagination(query: ListQueryDto = {}, options: PaginationOptions = {}) {
  const defaultPageSize = options.defaultPageSize ?? 20;
  const maxPageSize = options.maxPageSize ?? 100;
  const page = Math.max(Number(query.page ?? 1), 1);
  const requestedPageSize = Math.max(Number(query.pageSize ?? defaultPageSize), 1);
  const pageSize = Math.min(requestedPageSize, maxPageSize);

  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize
  };
}

export function paginatedResult<T>(items: T[], page: number, pageSize: number, total: number) {
  return {
    items,
    pagination: {
      page,
      pageSize,
      total
    }
  };
}
