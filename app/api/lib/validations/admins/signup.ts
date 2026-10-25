import { z } from "zod";

export const adminSignupSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must contain at least 2 characters")
      .max(100, "Name cannot exceed 100 characters"),

    email: z
      .string()
      .trim()
      .toLowerCase()
      .email("Invalid email address"),

    phoneNumber: z
      .string()
      .trim()
      .regex(/^[0-9]{10,15}$/, "Invalid phone number")
      .optional(),

    password: z
      .string()
      .min(6, "Password must contain at least 6 characters")
      .max(100, "Password cannot exceed 100 characters"),

    confirmPassword: z
      .string()
      .min(6, "Confirm password must contain at least 6 characters"),
  })
  .strict()
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });


export type AdminSignupI = z.infer<typeof adminSignupSchema>;