import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

const globalForPg = globalThis as unknown as {
  pgPool: Pool | undefined;
};

const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPg.pgPool = pool;
}

export const db = drizzle(pool);

// import { Pool } from 'pg';

// // 1. Correct the environment variable syntax: process.env, not env.process
// const connectionString = process.env.DATABASE_URI;

// // 2. Prevent multiple pools from creating excessive connections in development
// const globalForPg = globalThis as unknown as {
//   pgPool: Pool | undefined;
// };

// export const db =
//   globalForPg.pgPool ||
//   new Pool({
//     connectionString,
//     max: 20, // Maximum number of clients in the pool
//     idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
//     connectionTimeoutMillis: 2000, // Return an error if a connection takes too long
//   });

// if (process.env.NODE_ENV !== 'production') {
//   globalForPg.pgPool = db;
// }
