import { z } from "zod";

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type Pagination = z.infer<typeof paginationQuery>;

export function toOffset({ page, pageSize }: Pagination) {
  return { limit: pageSize, offset: (page - 1) * pageSize };
}

export function pageMeta({ page, pageSize }: Pagination, total: number) {
  return { page, pageSize, total, hasMore: page * pageSize < total };
}
