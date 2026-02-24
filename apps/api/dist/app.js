"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const errorHandler_1 = require("./common/middleware/errorHandler");
const routes_1 = require("./routes");
function createApp() {
    const app = (0, express_1.default)();
    // Middleware
    app.use(express_1.default.json());
    app.use((0, cors_1.default)());
    // Setup routes
    (0, routes_1.setupRoutes)(app);
    // Error handling
    (0, errorHandler_1.setupErrorHandling)(app);
    return app;
}
//# sourceMappingURL=app.js.map