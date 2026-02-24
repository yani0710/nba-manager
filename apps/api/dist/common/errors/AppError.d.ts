export declare class AppError extends Error {
    statusCode: number;
    isOperational: boolean;
    constructor(statusCode: number, message: string, isOperational?: boolean);
}
export declare class NotFoundError extends AppError {
    constructor(resource: string);
}
export declare class BadRequestError extends AppError {
    constructor(message: string);
}
export declare class InternalServerError extends AppError {
    constructor(message?: string);
}
//# sourceMappingURL=AppError.d.ts.map