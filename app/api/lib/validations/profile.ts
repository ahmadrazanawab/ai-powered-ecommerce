import { z } from "zod";

export const addressSchema = z
    .object({
        street: z.string().trim().optional(),
        city: z.string().trim().optional(),
        state: z.string().trim().optional(),
        postalCode: z.string().trim().optional(),
        country: z.string().trim().optional(),
    })
    .strict();

export const userProfileSchema = z
    .object({
        fullName: z
            .string()
            .trim()
            .min(2, "Full name must contain at least 2 characters")
            .max(100, "Full name cannot exceed 100 characters")
            .optional(),

        shippingAddress: addressSchema.optional(),
    })
    .strict()
    .refine(
        (data) =>
            data.fullName !== undefined ||
            data.shippingAddress !== undefined,
        {
            message: "At least one profile field is required",
        }
    );

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
            .min(2, "Tax ID is required")
            .max(100, "Tax ID cannot exceed 100 characters")
            .optional(),

        businessAddress: addressSchema.optional(),
    })
    .strict()
    .refine(
        (data) =>
            data.companyName !== undefined ||
            data.taxId !== undefined ||
            data.businessAddress !== undefined,
        {
            message: "At least one profile field is required",
        }
    );