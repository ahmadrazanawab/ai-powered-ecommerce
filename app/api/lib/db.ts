
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
    throw new Error("DATABASE_URL is not defined");
}

const globalForPg = globalThis as unknown as {
    pgPool: Pool | undefined;
};

const pool =
    globalForPg.pgPool ??
    new Pool({
        connectionString,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        keepAlive: true,
    });

if (process.env.NODE_ENV !== "production") {
    globalForPg.pgPool = pool;
}

export const db = drizzle(pool);


// import { drizzle } from "drizzle-orm/node-postgres";
// import { Pool } from "pg";

// const connectionString = process.env.DATABASE_URL;

// const globalForPg = globalThis as unknown as {
//   pgPool: Pool | undefined;
// };

// const pool =
//   globalForPg.pgPool ??
//   new Pool({
//     connectionString,
//     max: 20,
//     idleTimeoutMillis: 30000,
//     connectionTimeoutMillis: 2000,
//   });

// if (process.env.NODE_ENV !== "production") {
//   globalForPg.pgPool = pool;
// }

// export const db = drizzle(pool);

