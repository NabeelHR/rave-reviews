import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

const url = process.env.DATABASE_URL ?? "postgres://rr:rr@localhost:5432/ravereviews";

export const sqlClient = postgres(url, { max: 10 });
export const db = drizzle(sqlClient, { schema });
export type DB = typeof db;
export { schema };
