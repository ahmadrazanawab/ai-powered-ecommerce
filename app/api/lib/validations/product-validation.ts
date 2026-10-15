import { z } from "zod";

export const productValidation = z.object({
    categoryId: z.string().uuid("Please provide a valid category ID"),

    name: z
        .string()
        .trim()
        .min(1, "Product name is required")
        .max(200, "Product name must not exceed 200 characters"),

    slug: z
        .string()
        .trim()
        .min(1, "Slug is required")
        .max(220, "Slug must not exceed 220 characters"),

    sku: z
        .string()
        .trim()
        .min(1, "SKU is required")
        .max(100, "SKU must not exceed 100 characters"),

    description: z
        .string()
        .trim()
        .optional()
        .nullable(),

    price: z
        .string()
        .regex(/^\d{1,8}(\.\d{1,2})?$/, "Price must be a valid number with up to 2 decimal places")
        .refine((value) => Number(value) >= 0, "Price cannot be negative"),

    stock: z
        .coerce
        .number()
        .int("Stock must be an integer")
        .min(0, "Stock cannot be negative")
        .default(0),

    imageUrl: z
        .string()
        .trim()
        .url("Please provide a valid image URL")
        .optional()
        .or(z.literal("")),

    isActive: z.boolean().default(true),

    createdBy: z
        .string()
        .uuid("Please provide a valid admin ID")
        .optional()
        .nullable(),
});

export type ProductValidation = z.infer<typeof productValidation>;
