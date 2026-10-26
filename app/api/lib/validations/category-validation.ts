
import { z } from "zod";

export const categoryValidation = z.object({
    name: z
        .string()
        .trim()
        .min(2, "Name must contain at least 2 characters")
        .max(100, "Name cannot exceed 100 characters"),

    slug: z
        .string()
        .trim()
        .min(2, "Slug must contain at least 2 characters")
        .max(120, "Slug cannot exceed 120 characters")
        .regex(
            /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
            "Slug must contain only lowercase letters, numbers, and hyphens",
        ),

    description: z
        .string()
        .trim()
        .optional(),

    imageUrl: z
        .string()
        .trim()
        .url("Please provide a valid image URL")
        .optional()
        .or(z.literal("")),
});


export type CategoryFormI = z.infer<typeof categoryValidation>;
