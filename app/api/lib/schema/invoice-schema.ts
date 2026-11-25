import {
    index,
    integer,
    jsonb,
    numeric,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { orders, orderItems } from "./checkout-schema";
import { vendors } from "./vendor";

export interface InvoiceAddressSnapshot {
    fullName: string;
    phone: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
}

export interface InvoiceSellerSnapshot {
    businessName: string;
    invoiceDisplayName: string;
    businessType: string;
    email: string;
    phone: string;
    address: Omit<InvoiceAddressSnapshot, "fullName" | "phone">;
    gstRegistrationStatus: "regular" | "composition" | "unregistered";
    gstin: string | null;
}

export interface InvoiceCustomerSnapshot {
    name: string;
    email: string | null;
    phone: string;
    billingAddress: InvoiceAddressSnapshot;
    shippingAddress: InvoiceAddressSnapshot;
}

export interface InvoiceTotalsSnapshot {
    subtotal: string;
    discountAmount: string;
    shippingCharges: string;
    cgstAmount: string;
    sgstAmount: string;
    igstAmount: string;
    taxTotal: string;
    grandTotal: string;
    amountPaid: string;
    outstandingAmount: string;
    paymentStatusAtIssue: string;
    paymentMethod: string;
}

export const sellerInvoiceTypeEnum = pgEnum("seller_invoice_type", [
    "tax_invoice",
    "bill_of_supply",
    "commercial_invoice",
]);

export const sellerInvoiceStatusEnum = pgEnum("seller_invoice_status", [
    "blocked",
    "pending",
    "generating",
    "ready",
    "failed",
]);

export const invoiceGenerationJobStatusEnum = pgEnum(
    "invoice_generation_job_status",
    ["pending", "processing", "failed", "completed"]
);

export const invoiceGenerationJobs = pgTable(
    "invoice_generation_jobs",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        orderId: uuid("order_id")
            .notNull()
            .unique()
            .references(() => orders.id, { onDelete: "cascade" }),
        status: invoiceGenerationJobStatusEnum("status")
            .notNull()
            .default("pending"),
        attempts: integer("attempts").notNull().default(0),
        lastError: varchar("last_error", { length: 500 }),
        lockedAt: timestamp("locked_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        index("invoice_generation_jobs_status_updated_idx").on(
            table.status,
            table.updatedAt
        ),
    ]
);

export const sellerInvoices = pgTable(
    "seller_invoices",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        orderId: uuid("order_id")
            .notNull()
            .references(() => orders.id, { onDelete: "restrict" }),
        vendorId: uuid("vendor_id")
            .notNull()
            .references(() => vendors.id, { onDelete: "restrict" }),
        invoiceNumber: varchar("invoice_number", { length: 16 }),
        financialYear: integer("financial_year"),
        sequenceNumber: integer("sequence_number"),
        invoiceDate: timestamp("invoice_date", { withTimezone: true }),
        invoiceType: sellerInvoiceTypeEnum("invoice_type"),
        status: sellerInvoiceStatusEnum("status").notNull().default("blocked"),
        blockedReason: varchar("blocked_reason", { length: 80 }),
        currency: varchar("currency", { length: 3 }).notNull().default("INR"),
        sellerSnapshot: jsonb("seller_snapshot").$type<InvoiceSellerSnapshot>(),
        customerSnapshot: jsonb("customer_snapshot").$type<InvoiceCustomerSnapshot>(),
        totalsSnapshot: jsonb("totals_snapshot").$type<InvoiceTotalsSnapshot>(),
        pdfStorageKey: text("pdf_storage_key"),
        generatedAt: timestamp("generated_at", { withTimezone: true }),
        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        uniqueIndex("seller_invoices_order_vendor_unique").on(
            table.orderId,
            table.vendorId
        ),
        uniqueIndex("seller_invoices_vendor_number_unique")
            .on(table.vendorId, table.invoiceNumber)
            .where(sql`${table.invoiceNumber} IS NOT NULL`),
        uniqueIndex("seller_invoices_vendor_year_sequence_unique")
            .on(table.vendorId, table.financialYear, table.sequenceNumber)
            .where(sql`${table.sequenceNumber} IS NOT NULL`),
        index("seller_invoices_order_status_idx").on(
            table.orderId,
            table.status
        ),
        index("seller_invoices_vendor_created_idx").on(
            table.vendorId,
            table.createdAt
        ),
    ]
);

export const sellerInvoiceItems = pgTable(
    "seller_invoice_items",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        invoiceId: uuid("invoice_id")
            .notNull()
            .references(() => sellerInvoices.id, { onDelete: "cascade" }),
        orderItemId: uuid("order_item_id").references(() => orderItems.id, {
            onDelete: "set null",
        }),
        lineNumber: integer("line_number").notNull(),
        productName: text("product_name").notNull(),
        hsnCode: varchar("hsn_code", { length: 8 }),
        quantity: integer("quantity").notNull(),
        unitPrice: numeric("unit_price", { precision: 12, scale: 2 }).notNull(),
        discountAmount: numeric("discount_amount", {
            precision: 12,
            scale: 2,
        })
            .notNull()
            .default("0.00"),
        taxableAmount: numeric("taxable_amount", {
            precision: 12,
            scale: 2,
        }).notNull(),
        gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).notNull(),
        cgstAmount: numeric("cgst_amount", { precision: 12, scale: 2 }).notNull(),
        sgstAmount: numeric("sgst_amount", { precision: 12, scale: 2 }).notNull(),
        igstAmount: numeric("igst_amount", { precision: 12, scale: 2 }).notNull(),
        totalTax: numeric("total_tax", { precision: 12, scale: 2 }).notNull(),
        lineTotal: numeric("line_total", { precision: 12, scale: 2 }).notNull(),
        createdAt: timestamp("created_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        uniqueIndex("seller_invoice_items_invoice_line_unique").on(
            table.invoiceId,
            table.lineNumber
        ),
        index("seller_invoice_items_invoice_idx").on(table.invoiceId),
    ]
);
