import { z } from "zod";

export const vendorBusinessTypeValues = [
    "proprietorship",
    "partnership",
    "llp",
    "private_limited",
    "public_limited",
    "other",
] as const;

export const vendorGstRegistrationValues = [
    "regular",
    "composition",
    "unregistered",
] as const;

const requiredText = (label: string, maxLength: number) =>
    z.string().trim().min(1, `${label} is required`).max(maxLength);

export const vendorBusinessProfileSchema = z
    .object({
        businessName: requiredText("Business / Shop Name", 150),
        businessType: z.enum(vendorBusinessTypeValues),
        authorizedPersonName: requiredText("Owner / Authorized Person Name", 150),
        businessEmail: z.string().trim().email().max(255),
        businessPhone: z
            .string()
            .trim()
            .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian phone number"),
        gstRegistrationStatus: z.enum(vendorGstRegistrationValues),
        gstin: z
            .string()
            .trim()
            .transform((value) => value.toUpperCase())
            .optional()
            .default(""),
        pan: z
            .string()
            .trim()
            .transform((value) => value.toUpperCase())
            .pipe(z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/, "Enter a valid PAN")),
        addressLine1: requiredText("Address Line 1", 200),
        addressLine2: z.string().trim().max(200).optional().default(""),
        city: requiredText("City", 100),
        state: requiredText("State", 100),
        pinCode: z
            .string()
            .trim()
            .regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit Indian PIN code"),
        country: z.string().trim().min(1).max(100).default("India"),
        invoiceDisplayName: requiredText("Invoice Display Name", 150),
        invoicePrefix: z
            .string()
            .trim()
            .max(4, "Use at most 4 letters or numbers")
            .regex(/^[A-Za-z0-9]*$/, "Use only letters and numbers")
            .optional()
            .default(""),
        paymentInformation: z.string().trim().max(2000).optional().default(""),
    })
    .superRefine((profile, context) => {
        const gstinPattern =
            /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

        if (profile.gstRegistrationStatus === "unregistered") {
            if (profile.gstin) {
                context.addIssue({
                    code: "custom",
                    path: ["gstin"],
                    message: "GSTIN must be blank for unregistered businesses",
                });
            }
            return;
        }

        if (!gstinPattern.test(profile.gstin)) {
            context.addIssue({
                code: "custom",
                path: ["gstin"],
                message: "Enter a valid 15-character GSTIN",
            });
        }
    });

export type VendorBusinessProfileInput = z.input<
    typeof vendorBusinessProfileSchema
>;
export type VendorBusinessProfileData = z.output<
    typeof vendorBusinessProfileSchema
>;
