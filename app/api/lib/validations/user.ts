import { z } from "zod";

// Normalize and validate email or phone.
// Phone numbers are stored with digits only, without a "+" prefix.
const identifierSchema = z
    .string()
    .trim()
    .min(1, "Email or phone number is required")
    .max(255, "Identifier is too long")
    .transform((value) =>
        value.includes("@")
            ? value.toLowerCase()
            : value.replace(/[\s()-]/g, "")
    )
    .refine(
        (value) =>
            z.string().email().safeParse(value).success ||
            /^\d{10,15}$/.test(value),
        "Enter a valid email address or phone number"
    );

// Only these purposes are used in the initial login/signup flow.
export const userOtpRequestSchema = z
    .object({
        identifier: identifierSchema,
        purpose: z.enum(["signup", "login"]),
    })
    .strict();

// OTP is a string because it may start with zero.
export const userOtpVerifySchema = z
    .object({
        identifier: identifierSchema,
        otp: z
            .string()
            .regex(/^\d{6}$/, "OTP must contain exactly 6 digits"),
        purpose: z.enum(["signup", "login"]),
    })
    .strict();

export type UserOtpRequestInput = z.infer<
    typeof userOtpRequestSchema
>;

export type UserOtpVerifyInput = z.infer<
    typeof userOtpVerifySchema
>;

