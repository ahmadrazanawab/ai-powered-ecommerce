import {
    index,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";

import { adminAccounts } from "./admin-schema";
import { vendors } from "./vendor";

export const vendorBusinessTypeEnum = pgEnum("vendor_business_type", [
    "proprietorship",
    "partnership",
    "llp",
    "private_limited",
    "public_limited",
    "other",
]);

export const vendorGstRegistrationEnum = pgEnum(
    "vendor_gst_registration_status",
    ["regular", "composition", "unregistered"]
);

export const vendorBusinessVerificationEnum = pgEnum(
    "vendor_business_verification_status",
    ["pending", "under_review", "verified", "rejected"]
);

export const vendorBusinessProfiles = pgTable(
    "vendor_business_profiles",
    {
        vendorId: uuid("vendor_id")
            .primaryKey()
            .references(() => vendors.id, { onDelete: "cascade" }),
        businessName: varchar("business_name", { length: 150 }).notNull(),
        businessType: vendorBusinessTypeEnum("business_type").notNull(),
        authorizedPersonName: varchar("authorized_person_name", {
            length: 150,
        }).notNull(),
        businessEmail: varchar("business_email", { length: 255 }).notNull(),
        businessPhone: varchar("business_phone", { length: 15 }).notNull(),
        gstRegistrationStatus: vendorGstRegistrationEnum(
            "gst_registration_status"
        )
            .notNull()
            .default("unregistered"),
        gstin: varchar("gstin", { length: 15 }),
        pan: varchar("pan", { length: 10 }).notNull(),
        gstDocumentPublicId: text("gst_document_public_id"),
        gstDocumentFormat: varchar("gst_document_format", { length: 10 }),
        addressLine1: varchar("address_line_1", { length: 200 }).notNull(),
        addressLine2: varchar("address_line_2", { length: 200 }),
        city: varchar("city", { length: 100 }).notNull(),
        state: varchar("state", { length: 100 }).notNull(),
        pinCode: varchar("pin_code", { length: 6 }).notNull(),
        country: varchar("country", { length: 100 }).notNull().default("India"),
        invoiceDisplayName: varchar("invoice_display_name", {
            length: 150,
        }).notNull(),
        invoicePrefix: varchar("invoice_prefix", { length: 20 }),
        paymentInformation: text("payment_information"),
        verificationStatus: vendorBusinessVerificationEnum(
            "verification_status"
        )
            .notNull()
            .default("pending"),
        rejectionReason: varchar("rejection_reason", { length: 1000 }),
        reviewMessage: varchar("review_message", { length: 1000 }),
        reviewedBy: uuid("reviewed_by").references(() => adminAccounts.id, {
            onDelete: "set null",
        }),
        reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        index("vendor_business_profiles_verification_idx").on(
            table.verificationStatus,
            table.createdAt
        ),
    ]
);
