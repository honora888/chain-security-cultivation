import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

import * as schema from "@/db/schema";

export class DatabaseConfigurationError extends Error {
  constructor() {
    super("Database is not configured.");
    this.name = "DatabaseConfigurationError";
  }
}

export type NeonSql = ReturnType<typeof neon>;

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new DatabaseConfigurationError();
  }
  return url;
}

export function getNeonSql(): NeonSql {
  return neon(getDatabaseUrl());
}

export function getDatabase() {
  return drizzle(getNeonSql(), { schema });
}
