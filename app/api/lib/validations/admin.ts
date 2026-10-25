// admin login validation
import { z } from "zod";

export const adminLoginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Invalid email address"),

  password: z
    .string()
    .min(6, "Password must contain at least 6 characters")
    .max(100, "Password cannot exceed 100 characters"),
}).strict();

export type AdminLoginI = z.infer<typeof adminLoginSchema>;