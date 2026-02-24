"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
exports.setupErrorHandling = setupErrorHandling;
const AppError_1 = require("../errors/AppError");
function errorHandler(err, req, res, next) {
    if (err instanceof AppError_1.AppError) {
        return res.status(err.statusCode).json({
            status: "error",
            message: err.message,
        });
    }
    console.error("Unhandled error:", err);
    res.status(500).json({
        status: "error",
        message: "Internal server error",
    });
}
function setupErrorHandling(app) {
    app.use(errorHandler);
}
//# sourceMappingURL=errorHandler.js.map