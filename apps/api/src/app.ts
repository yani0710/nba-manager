import express, { Express } from "express";
import cors from "cors";
import { setupErrorHandling } from "./common/middleware/errorHandler";
import { setupRoutes } from "./routes";

export function createApp(): Express {
  const app = express();

  // Middleware
  app.use(express.json());
  app.use(cors());

  // Setup routes
  setupRoutes(app);

  // Error handling
  setupErrorHandling(app);

  return app;
}
