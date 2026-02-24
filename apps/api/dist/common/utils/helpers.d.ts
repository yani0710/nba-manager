export declare function paginate(items: any[], page: number, limit: number): {
    data: any[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
};
export declare function sortBy<T>(items: T[], key: keyof T, direction?: 'asc' | 'desc'): T[];
//# sourceMappingURL=helpers.d.ts.map