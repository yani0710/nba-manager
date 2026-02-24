import { Express, Request, Response, NextFunction } from "express";
import { AppError } from "../errors/AppError";
export declare function errorHandler(err: Error | AppError, req: Request, res: Response, next: NextFunction): Response<any, Record<string, any>> | undefined;
export declare function setupErrorHandling(app: Express): void;
//# sourceMappingURL=errorHandler.d.ts.map