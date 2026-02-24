// API utility functions

export function paginate(items: any[], page: number, limit: number) {
  const skip = (page - 1) * limit;
  return {
    data: items.slice(skip, skip + limit),
    total: items.length,
    page,
    limit,
    totalPages: Math.ceil(items.length / limit),
  };
}

export function sortBy<T>(items: T[], key: keyof T, direction: 'asc' | 'desc' = 'asc') {
  const sorted = [...items].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];

    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  return sorted;
}
