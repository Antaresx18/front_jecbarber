import { useMemo, useState, useCallback } from 'react';

/**
 * @template T
 * @param {T[]} items
 * @param {(item: T, query: string) => boolean} matches
 * @param {number} [pageSize]
 */
export function useListFilterPagination(items, matches, pageSize = 5) {
  const [query, setQueryState] = useState('');
  const [page, setPage] = useState(1);

  const setQuery = useCallback((next) => {
    setQueryState(next);
    setPage(1);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => matches(item, q));
  }, [items, query, matches]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);

  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const setPageClamped = useCallback(
    (nextPage) => {
      const tp = Math.max(1, Math.ceil(filtered.length / pageSize));
      setPage(Math.min(Math.max(1, nextPage), tp));
    },
    [filtered.length, pageSize]
  );

  return {
    query,
    setQuery,
    page: safePage,
    setPage: setPageClamped,
    totalPages,
    pageItems,
    filteredCount: filtered.length,
  };
}
