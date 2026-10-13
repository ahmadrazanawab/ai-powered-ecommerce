import { z } from "zod";

export const vendorSignupSchema = z
    .object({
        name: z
            .string()
            .trim()
            .min(2, "Name must contain at least 2 characters")
            .max(100, "Name cannot exceed 100 characters"),

        email: z
            .string()
            .trim()
            .email("Invalid email address")
            .max(255, "Email cannot exceed 255 characters")
            .transform((value) => value.toLowerCase()),

        mobileNumber: z
            .string()
            .trim()
            .regex(
                /^[0-9]{10,15}$/,
                "Mobile number must contain 10 to 15 digits"
            )
            .optional(),

        password: z
            .string()
            .min(8, "Password must contain at least 8 characters")
            .max(100, "Password cannot exceed 100 characters"),

        confirmPassword: z
            .string()
            .min(8, "Confirm password must contain at least 8 characters"),
    })
    .strict()
    .refine(
        (data) => data.password === data.confirmPassword,
        {
            message: "Passwords do not match",
            path: ["confirmPassword"],
        }
    );

export const vendorLoginSchema = z
    .object({
        email: z
            .string()
            .trim()
            .email("Invalid email address")
            .max(255, "Email cannot exceed 255 characters")
            .transform((value) => value.toLowerCase()),

        password: z
            .string()
            .min(1, "Password is required")
            .max(100, "Password cannot exceed 100 characters"),
    })
    .strict();

export const vendorProfileSchema = z
    .object({
        companyName: z
            .string()
            .trim()
            .min(2, "Company name must contain at least 2 characters")
            .max(150, "Company name cannot exceed 150 characters")
            .optional(),

        taxId: z
            .string()
            .trim()
            .min(2, "Tax ID must contain at least 2 characters")
            .max(100, "Tax ID cannot exceed 100 characters")
            .optional(),

        businessAddress: z
            .object({
                street: z.string().trim().optional(),
                city: z.string().trim().optional(),
                state: z.string().trim().optional(),
                postalCode: z.string().trim().optional(),
                country: z.string().trim().optional(),
            })
            .strict()
            .optional(),
    })
    .strict();