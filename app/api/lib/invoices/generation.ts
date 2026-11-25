import {
    and,
    asc,
    eq,
    isNull,
    max,
    or,
    sql,
} from "drizzle-orm";

import { db } from "@/app/api/lib/db";
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

import {
    invoiceGenerationJobs,
    sellerInvoiceItems,
    sellerInvoices,
    type InvoiceAddressSnapshot,
    type InvoiceCustomerSnapshot,
    type InvoiceSellerSnapshot,
    type InvoiceTotalsSnapshot,
} from "@/app/api/lib/schema/invoice-schema";
import {
    orderItems,
    orders,
} from "@/app/api/lib/schema/checkout-schema";
import { users } from "@/app/api/lib/schema/users";
import { vendorBusinessProfiles } from "@/app/api/lib/schema/vendor-business-profile";
import {
    calculateInclusiveTax,
    decimalToMinorUnits,
    gstRateToBasisPoints,
    isInterstateIndianSupply,
    minorUnitsToDecimal,
} from "./money";
import {
    renderInvoicePdf,
    type InvoicePdfItem,
    type InvoicePdfSnapshot,
} from "./render-invoice";
import { uploadPrivateInvoicePdf } from "./private-storage";

const isString = (value: unknown): value is string =>
    typeof value === "string" && value.trim().length > 0;

function readAddress(value: unknown): InvoiceAddressSnapshot | null {
    if (typeof value !== "object" || value === null) return null;
    const address = value as Record<string, unknown>;
    if (
        !isString(address.fullName) ||
        !isString(address.phone) ||
        !isString(address.addressLine1) ||
        !isString(address.city) ||
        !isString(address.state) ||
        !isString(address.postalCode) ||
        !isString(address.country) ||
        (address.addressLine2 !== null &&
            address.addressLine2 !== undefined &&
            typeof address.addressLine2 !== "string")
    ) {
        return null;
    }

    return {
        fullName: address.fullName.trim(),
        phone: address.phone.trim(),
        addressLine1: address.addressLine1.trim(),
        addressLine2:
            typeof address.addressLine2 === "string"
                ? address.addressLine2.trim() || null
                : null,
        city: address.city.trim(),
        state: address.state.trim(),
        postalCode: address.postalCode.trim(),
        country: address.country.trim(),
    };
}

function financialYear(date: Date): number {
    return date.getUTCMonth() >= 3
        ? date.getUTCFullYear()
        : date.getUTCFullYear() - 1;
}

function invoiceNumber(prefixValue: string | null, year: number, sequence: number) {
    const prefix = (prefixValue || "INV").trim().toUpperCase();
    if (!/^[A-Z0-9]{1,4}$/.test(prefix) || sequence > 999999) {
        return null;
    }

    const yearLabel = `${String(year).slice(-2)}${String(year + 1).slice(-2)}`;
    return `${prefix}-${yearLabel}-${String(sequence).padStart(6, "0")}`;
}

function makeSellerSnapshot(
    profile: typeof vendorBusinessProfiles.$inferSelect
): InvoiceSellerSnapshot {
    return {
        businessName: profile.businessName.trim(),
        invoiceDisplayName: profile.invoiceDisplayName.trim(),
        businessType: profile.businessType,
        email: profile.businessEmail.trim(),
        phone: profile.businessPhone.trim(),
        address: {
            addressLine1: profile.addressLine1.trim(),
            addressLine2: profile.addressLine2?.trim() || null,
            city: profile.city.trim(),
            state: profile.state.trim(),
            postalCode: profile.pinCode.trim(),
            country: profile.country.trim(),
        },
        gstRegistrationStatus: profile.gstRegistrationStatus,
        gstin: profile.gstin,
    };
}

function formatTaxLine(
    item: typeof orderItems.$inferSelect,
    profileStatus: "regular" | "composition" | "unregistered",
    interstate: boolean
): InvoicePdfItem {
    const lineTotalPaise = decimalToMinorUnits(item.lineTotal);
    const expectedLinePaise =
        decimalToMinorUnits(item.unitPrice) * BigInt(item.quantity);
    if (lineTotalPaise !== expectedLinePaise) {
        throw new Error("ORDER_LINE_TOTAL_MISMATCH");
    }

    if (profileStatus !== "regular") {
        return {
            productName: item.productName,
            hsnCode: item.hsnCode,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountAmount: "0.00",
            taxableAmount: item.lineTotal,
            gstRate: "0.00",
            cgstAmount: "0.00",
            sgstAmount: "0.00",
            igstAmount: "0.00",
            totalTax: "0.00",
            lineTotal: item.lineTotal,
        };
    }

    if (
        !item.hsnCode ||
        item.gstRate === null ||
        item.taxableAmount === null ||
        item.cgstAmount === null ||
        item.sgstAmount === null ||
        item.igstAmount === null ||
        item.totalTax === null
    ) {
        throw new Error("TAX_SNAPSHOT_MISSING");
    }
    if (!/^\d{4}(?:\d{2}){0,2}$/.test(item.hsnCode)) {
        throw new Error("HSN_SNAPSHOT_INVALID");
    }

    gstRateToBasisPoints(item.gstRate);
    const taxablePaise = decimalToMinorUnits(item.taxableAmount);
    const cgstPaise = decimalToMinorUnits(item.cgstAmount);
    const sgstPaise = decimalToMinorUnits(item.sgstAmount);
    const igstPaise = decimalToMinorUnits(item.igstAmount);
    const totalTaxPaise = decimalToMinorUnits(item.totalTax);

    if (
        cgstPaise + sgstPaise + igstPaise !== totalTaxPaise ||
        taxablePaise + totalTaxPaise !== lineTotalPaise ||
        (interstate && (cgstPaise !== 0n || sgstPaise !== 0n)) ||
        (!interstate && igstPaise !== 0n)
    ) {
        throw new Error("TAX_SNAPSHOT_INVALID");
    }

    const recomputedTax = calculateInclusiveTax(
        lineTotalPaise,
        item.gstRate,
        interstate
    );
    if (
        recomputedTax.taxableAmount !== item.taxableAmount ||
        recomputedTax.cgstAmount !== item.cgstAmount ||
        recomputedTax.sgstAmount !== item.sgstAmount ||
        recomputedTax.igstAmount !== item.igstAmount
    ) {
        throw new Error("TAX_SNAPSHOT_INVALID");
    }

    return {
        productName: item.productName,
        hsnCode: item.hsnCode,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountAmount: "0.00",
        taxableAmount: item.taxableAmount,
        gstRate: item.gstRate,
        cgstAmount: item.cgstAmount,
        sgstAmount: item.sgstAmount,
        igstAmount: item.igstAmount,
        totalTax: item.totalTax,
        lineTotal: item.lineTotal,
    };
}

function totalSnapshot(
    items: InvoicePdfItem[],
    order: typeof orders.$inferSelect
): InvoiceTotalsSnapshot {
    const totals = items.reduce(
        (sum, item) => {
            sum.subtotal += decimalToMinorUnits(item.taxableAmount);
            sum.discount += decimalToMinorUnits(item.discountAmount);
            sum.cgst += decimalToMinorUnits(item.cgstAmount);
            sum.sgst += decimalToMinorUnits(item.sgstAmount);
            sum.igst += decimalToMinorUnits(item.igstAmount);
            sum.grand += decimalToMinorUnits(item.lineTotal);
            return sum;
        },
        {
            subtotal: 0n,
            discount: 0n,
            cgst: 0n,
            sgst: 0n,
            igst: 0n,
            grand: 0n,
        }
    );

    const paid = ["paid", "succeeded"].includes(order.paymentStatus)
        ? totals.grand
        : 0n;

    return {
        subtotal: minorUnitsToDecimal(totals.subtotal),
        discountAmount: minorUnitsToDecimal(totals.discount),
        shippingCharges: "0.00",
        cgstAmount: minorUnitsToDecimal(totals.cgst),
        sgstAmount: minorUnitsToDecimal(totals.sgst),
        igstAmount: minorUnitsToDecimal(totals.igst),
        taxTotal: minorUnitsToDecimal(totals.cgst + totals.sgst + totals.igst),
        grandTotal: minorUnitsToDecimal(totals.grand),
        amountPaid: minorUnitsToDecimal(paid),
        outstandingAmount: minorUnitsToDecimal(totals.grand - paid),
        paymentStatusAtIssue: order.paymentStatus,
        paymentMethod: order.paymentMethod,
    };
}

async function setBlocked(
    tx: Tx,
    orderId: string,
    vendorId: string,
    reason: string
) {
    const [existing] = await tx
        .select({ id: sellerInvoices.id, status: sellerInvoices.status })
        .from(sellerInvoices)
        .where(
            and(
                eq(sellerInvoices.orderId, orderId),
                eq(sellerInvoices.vendorId, vendorId)
            )
        )
        .limit(1);

    if (existing && existing.status !== "blocked") return;
    if (existing) {
        await tx
            .update(sellerInvoices)
            .set({ blockedReason: reason, updatedAt: new Date() })
            .where(eq(sellerInvoices.id, existing.id));
        return;
    }

    await tx
        .insert(sellerInvoices)
        .values({
            orderId,
            vendorId,
            status: "blocked",
            blockedReason: reason,
        })
        .onConflictDoNothing({
            target: [sellerInvoices.orderId, sellerInvoices.vendorId],
        });
}

async function prepareInvoiceSnapshots(orderId: string): Promise<string[]> {
    return db.transaction(async (tx) => {
        const [order] = await tx
            .select()
            .from(orders)
            .where(eq(orders.id, orderId))
            .for("update")
            .limit(1);

        if (!order || order.status !== "delivered") {
            throw new Error("ORDER_NOT_DELIVERED");
        }

        if (order.paymentStatus === "refunded") {
            throw new Error("ORDER_REFUNDED");
        }
        if (
            order.paymentMethod === "online" &&
            !["paid", "succeeded"].includes(order.paymentStatus)
        ) {
            throw new Error("ONLINE_PAYMENT_NOT_CONFIRMED");
        }

        const deliveredItems = await tx
            .select()
            .from(orderItems)
            .where(
                and(
                    eq(orderItems.orderId, orderId),
                    eq(orderItems.fulfillmentStatus, "delivered")
                )
            )
            .orderBy(asc(orderItems.vendorId), asc(orderItems.createdAt));

        const byVendor = new Map<string, typeof deliveredItems>();
        for (const item of deliveredItems) {
            const grouped = byVendor.get(item.vendorId) ?? [];
            grouped.push(item);
            byVendor.set(item.vendorId, grouped);
        }

        if (byVendor.size === 0) return [];

        const address = readAddress(order.shippingAddress);
        if (!address) {
            for (const vendorId of byVendor.keys()) {
                await setBlocked(
                    tx,
                    orderId,
                    vendorId,
                    "customer_snapshot_missing"
                );
            }
            return [];
        }

        const [customer] = await tx
            .select({ name: users.name, email: users.email })
            .from(users)
            .where(eq(users.id, order.userId))
            .limit(1);
        if (!customer) {
            for (const vendorId of byVendor.keys()) {
                await setBlocked(tx, orderId, vendorId, "customer_not_found");
            }
            return [];
        }

        const customerSnapshot: InvoiceCustomerSnapshot = {
            name: customer.name?.trim() || address.fullName,
            email: customer.email,
            phone: address.phone,
            billingAddress: address,
            shippingAddress: address,
        };

        const invoiceIds: string[] = [];

        for (const [vendorId, items] of byVendor) {
            const [existing] = await tx
                .select()
                .from(sellerInvoices)
                .where(
                    and(
                        eq(sellerInvoices.orderId, orderId),
                        eq(sellerInvoices.vendorId, vendorId)
                    )
                )
                .for("update")
                .limit(1);

            if (
                existing &&
                existing.status !== "blocked"
            ) {
                if (existing.status !== "ready") invoiceIds.push(existing.id);
                continue;
            }

            const [profile] = await tx
                .select()
                .from(vendorBusinessProfiles)
                .where(eq(vendorBusinessProfiles.vendorId, vendorId))
                .for("update")
                .limit(1);

            if (!profile) {
                await setBlocked(tx, orderId, vendorId, "business_profile_missing");
                continue;
            }
            if (profile.verificationStatus !== "verified") {
                await setBlocked(tx, orderId, vendorId, "business_profile_unverified");
                continue;
            }
            if (
                !profile.businessName.trim() ||
                !profile.invoiceDisplayName.trim() ||
                !profile.businessEmail.trim() ||
                !profile.businessPhone.trim() ||
                !profile.addressLine1.trim() ||
                !profile.city.trim() ||
                !profile.state.trim() ||
                !profile.pinCode.trim() ||
                !profile.country.trim()
            ) {
                await setBlocked(tx, orderId, vendorId, "business_profile_incomplete");
                continue;
            }
            if (
                profile.gstRegistrationStatus === "regular" &&
                !profile.gstin
            ) {
                await setBlocked(tx, orderId, vendorId, "gstin_missing");
                continue;
            }
            if (
                profile.gstRegistrationStatus === "regular" &&
                items.some(
                    (item) =>
                        !item.gstRate ||
                        !item.hsnCode ||
                        item.taxableAmount === null
                )
            ) {
                await setBlocked(tx, orderId, vendorId, "tax_snapshot_missing");
                continue;
            }
            if (
                order.paymentMethod === "cod" &&
                !["pending", "paid", "succeeded"].includes(order.paymentStatus)
            ) {
                await setBlocked(tx, orderId, vendorId, "payment_state_invalid");
                continue;
            }

            const sellerSnapshot = makeSellerSnapshot(profile);
            const interstate =
                profile.gstRegistrationStatus === "regular"
                    ? isInterstateIndianSupply(profile.state, address.state)
                    : false;
            if (
                profile.gstRegistrationStatus === "regular" &&
                (address.country.trim().toLowerCase() !== "india" ||
                    interstate === null)
            ) {
                await setBlocked(
                    tx,
                    orderId,
                    vendorId,
                    "place_of_supply_unrecognized"
                );
                continue;
            }
            let invoiceItems: InvoicePdfItem[];
            try {
                invoiceItems = items.map((item) =>
                    formatTaxLine(
                        item,
                        profile.gstRegistrationStatus,
                        interstate ?? false
                    )
                );
            } catch (error) {
                const reason =
                    error instanceof Error &&
                    error.message.startsWith("TAX_SNAPSHOT")
                        ? "tax_snapshot_invalid"
                        : "order_amount_invalid";
                await setBlocked(tx, orderId, vendorId, reason);
                continue;
            }

            if (!invoiceItems.length) {
                await setBlocked(tx, orderId, vendorId, "no_delivered_items");
                continue;
            }

            const issuedAt = new Date();
            const fy = financialYear(issuedAt);
            const [counter] = await tx
                .select({
                    value: max(sellerInvoices.sequenceNumber),
                })
                .from(sellerInvoices)
                .where(
                    and(
                        eq(sellerInvoices.vendorId, vendorId),
                        eq(sellerInvoices.financialYear, fy)
                    )
                );
            const sequence = Number(counter?.value ?? 0) + 1;
            const number = invoiceNumber(profile.invoicePrefix, fy, sequence);
            if (!number) {
                await setBlocked(tx, orderId, vendorId, "invoice_prefix_invalid");
                continue;
            }

            const totalsSnapshot = totalSnapshot(invoiceItems, order);
            const invoiceType =
                profile.gstRegistrationStatus === "regular"
                    ? "tax_invoice"
                    : profile.gstRegistrationStatus === "composition"
                      ? "bill_of_supply"
                      : "commercial_invoice";
            let invoiceId = existing?.id;

            if (existing) {
                const [updated] = await tx
                    .update(sellerInvoices)
                    .set({
                        invoiceNumber: number,
                        financialYear: fy,
                        sequenceNumber: sequence,
                        invoiceDate: issuedAt,
                        invoiceType,
                        status: "pending",
                        blockedReason: null,
                        currency: order.currency.toUpperCase(),
                        sellerSnapshot,
                        customerSnapshot,
                        totalsSnapshot,
                        updatedAt: issuedAt,
                    })
                    .where(
                        and(
                            eq(sellerInvoices.id, existing.id),
                            eq(sellerInvoices.status, "blocked")
                        )
                    )
                    .returning({ id: sellerInvoices.id });
                if (!updated) continue;
                await tx
                    .delete(sellerInvoiceItems)
                    .where(eq(sellerInvoiceItems.invoiceId, existing.id));
                invoiceId = updated.id;
            } else {
                const [inserted] = await tx
                    .insert(sellerInvoices)
                    .values({
                        orderId,
                        vendorId,
                        invoiceNumber: number,
                        financialYear: fy,
                        sequenceNumber: sequence,
                        invoiceDate: issuedAt,
                        invoiceType,
                        status: "pending",
                        currency: order.currency.toUpperCase(),
                        sellerSnapshot,
                        customerSnapshot,
                        totalsSnapshot,
                    })
                    .onConflictDoNothing({
                        target: [sellerInvoices.orderId, sellerInvoices.vendorId],
                    })
                    .returning({ id: sellerInvoices.id });
                if (!inserted) continue;
                invoiceId = inserted.id;
            }

            if (!invoiceId) continue;

            await tx.insert(sellerInvoiceItems).values(
                invoiceItems.map((item, index) => {
                    const orderItem = items[index];
                    return {
                        invoiceId: invoiceId!,
                        orderItemId: orderItem.id,
                        lineNumber: index + 1,
                        productName: item.productName,
                        hsnCode: item.hsnCode,
                        quantity: item.quantity,
                        unitPrice: item.unitPrice,
                        discountAmount: item.discountAmount,
                        taxableAmount: item.taxableAmount,
                        gstRate: item.gstRate,
                        cgstAmount: item.cgstAmount,
                        sgstAmount: item.sgstAmount,
                        igstAmount: item.igstAmount,
                        totalTax: item.totalTax,
                        lineTotal: item.lineTotal,
                    };
                })
            );
            invoiceIds.push(invoiceId);
        }

        return invoiceIds;
    });
}

async function generateInvoicePdf(invoiceId: string): Promise<boolean> {
    const snapshot = await db.transaction(async (tx) => {
        const [invoice] = await tx
            .select()
            .from(sellerInvoices)
            .where(eq(sellerInvoices.id, invoiceId))
            .for("update")
            .limit(1);

        if (
            !invoice ||
            invoice.status === "ready" ||
            !invoice.invoiceNumber ||
            !invoice.invoiceDate ||
            !invoice.invoiceType ||
            !invoice.sellerSnapshot ||
            !invoice.customerSnapshot ||
            !invoice.totalsSnapshot
        ) {
            return null;
        }

        const items = await tx
            .select()
            .from(sellerInvoiceItems)
            .where(eq(sellerInvoiceItems.invoiceId, invoiceId))
            .orderBy(asc(sellerInvoiceItems.lineNumber));
        if (items.length === 0) {
            throw new Error("INVOICE_ITEMS_MISSING");
        }

        await tx
            .update(sellerInvoices)
            .set({ status: "generating", blockedReason: null, updatedAt: new Date() })
            .where(eq(sellerInvoices.id, invoiceId));

        return {
            invoiceId: invoice.id,
            vendorId: invoice.vendorId,
            pdfSnapshot: {
                invoiceNumber: invoice.invoiceNumber,
                invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
                orderId: invoice.orderId,
                invoiceType: invoice.invoiceType,
                seller: invoice.sellerSnapshot,
                customer: invoice.customerSnapshot,
                totals: invoice.totalsSnapshot,
                items: items.map((item) => ({
                    productName: item.productName,
                    hsnCode: item.hsnCode,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    discountAmount: item.discountAmount,
                    taxableAmount: item.taxableAmount,
                    gstRate: item.gstRate,
                    cgstAmount: item.cgstAmount,
                    sgstAmount: item.sgstAmount,
                    igstAmount: item.igstAmount,
                    totalTax: item.totalTax,
                    lineTotal: item.lineTotal,
                })),
            } satisfies InvoicePdfSnapshot,
        };
    });

    if (!snapshot) return true;

    try {
        const pdf = await renderInvoicePdf(snapshot.pdfSnapshot);
        const storageKey = await uploadPrivateInvoicePdf(
            snapshot.invoiceId,
            snapshot.vendorId,
            pdf
        );
        const [updated] = await db
            .update(sellerInvoices)
            .set({
                status: "ready",
                pdfStorageKey: storageKey,
                generatedAt: new Date(),
                blockedReason: null,
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(sellerInvoices.id, invoiceId),
                    eq(sellerInvoices.status, "generating")
                )
            )
            .returning({ id: sellerInvoices.id });
        return Boolean(updated);
    } catch (error) {
        console.error("GENERATE_SELLER_INVOICE_PDF_ERROR:", error);
        await db
            .update(sellerInvoices)
            .set({
                status: "failed",
                blockedReason: "pdf_generation_failed",
                updatedAt: new Date(),
            })
            .where(eq(sellerInvoices.id, invoiceId));
        return false;
    }
}

export async function processInvoiceGenerationJob(
    orderId: string
): Promise<"processed" | "busy" | "missing"> {
    const claim = await db.transaction(async (tx) => {
        const [job] = await tx
            .select()
            .from(invoiceGenerationJobs)
            .where(eq(invoiceGenerationJobs.orderId, orderId))
            .for("update")
            .limit(1);

        if (!job) return "missing" as const;
        if (job.status === "completed") return "busy" as const;
        if (
            job.status === "processing" &&
            job.lockedAt &&
            job.lockedAt.getTime() > Date.now() - 15 * 60 * 1000
        ) {
            return "busy" as const;
        }

        await tx
            .update(invoiceGenerationJobs)
            .set({
                status: "processing",
                attempts: sql`${invoiceGenerationJobs.attempts} + 1`,
                lastError: null,
                lockedAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(invoiceGenerationJobs.id, job.id));
        return "claimed" as const;
    });

    if (claim !== "claimed") return claim;

    try {
        const invoiceIds = await prepareInvoiceSnapshots(orderId);
        let allGenerated = true;
        for (const invoiceId of invoiceIds) {
            allGenerated =
                (await generateInvoicePdf(invoiceId)) && allGenerated;
        }

        await db
            .update(invoiceGenerationJobs)
            .set({
                status: allGenerated ? "completed" : "failed",
                lastError: allGenerated ? null : "One or more PDFs failed",
                lockedAt: null,
                updatedAt: new Date(),
            })
            .where(eq(invoiceGenerationJobs.orderId, orderId));

        return "processed";
    } catch (error) {
        console.error("PROCESS_INVOICE_GENERATION_JOB_ERROR:", error);
        await db
            .update(invoiceGenerationJobs)
            .set({
                status: "failed",
                lastError:
                    error instanceof Error
                        ? error.message.slice(0, 500)
                        : "Invoice generation failed",
                lockedAt: null,
                updatedAt: new Date(),
            })
            .where(eq(invoiceGenerationJobs.orderId, orderId));
        return "processed";
    }
}

export async function retryBlockedVendorInvoices(
    vendorId: string
): Promise<void> {
    const blocked = await db
        .select({ orderId: sellerInvoices.orderId })
        .from(sellerInvoices)
        .where(
            and(
                eq(sellerInvoices.vendorId, vendorId),
                eq(sellerInvoices.status, "blocked")
            )
        );

    const orderIds = [...new Set(blocked.map((row) => row.orderId))];
    for (const orderId of orderIds) {
        await db
            .update(invoiceGenerationJobs)
            .set({
                status: "pending",
                lockedAt: null,
                lastError: null,
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(invoiceGenerationJobs.orderId, orderId),
                    or(
                        eq(invoiceGenerationJobs.status, "completed"),
                        eq(invoiceGenerationJobs.status, "failed")
                    )
                )
            );
    }
}

export async function processInvoiceGenerationQueue(limit = 10) {
    const staleBefore = new Date(Date.now() - 15 * 60 * 1000);
    const jobs = await db
        .select({ orderId: invoiceGenerationJobs.orderId })
        .from(invoiceGenerationJobs)
        .where(
            or(
                eq(invoiceGenerationJobs.status, "pending"),
                and(
                    eq(invoiceGenerationJobs.status, "failed"),
                    sql`${invoiceGenerationJobs.updatedAt} < ${new Date(Date.now() - 5 * 60 * 1000)}`
                ),
                and(
                    eq(invoiceGenerationJobs.status, "processing"),
                    or(
                        isNull(invoiceGenerationJobs.lockedAt),
                        sql`${invoiceGenerationJobs.lockedAt} < ${staleBefore}`
                    )
                )
            )
        )
        .orderBy(asc(invoiceGenerationJobs.updatedAt))
        .limit(limit);

    let processed = 0;
    for (const job of jobs) {
        await processInvoiceGenerationJob(job.orderId);
        processed++;
    }
    return processed;
}
