import dotenv from "dotenv";

dotenv.config();

export const config = {
  PORT: process.env.PORT || 4000,
  NODE_ENV: process.env.NODE_ENV || "development",
  DATABASE_URL: process.env.DATABASE_URL,
};

export function validateConfig() {
  if (!config.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is required");
  }
}
