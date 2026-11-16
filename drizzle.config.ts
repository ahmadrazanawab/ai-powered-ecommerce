import "dotenv/config";
import { defineConfig } from "drizzle-kit";

console.log(
  "DATABASE HOST:",
  process.env.DATABASE_URL?.split("@")[1]?.split("/")[0]
);

export default defineConfig({
  schema: "./app/api/lib/schema/*.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});