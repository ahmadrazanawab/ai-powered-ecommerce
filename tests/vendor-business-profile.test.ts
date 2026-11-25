import assert from "node:assert/strict";
import test from "node:test";

import { vendorBusinessProfileSchema } from "../app/api/lib/validations/vendor-business-profile.ts";
import { getVendorDocumentFormat } from "../app/api/lib/vendor-business-document-storage.ts";

const validProfile = {
    businessName: "Example Shop",
    businessType: "proprietorship",
    authorizedPersonName: "Example Owner",
    businessEmail: "owner@example.in",
    businessPhone: "9876543210",
    gstRegistrationStatus: "regular",
    gstin: "27AAPFU0939F1ZV",
    pan: "AAPFU0939F",
    addressLine1: "1 Market Road",
    addressLine2: "",
    city: "Mumbai",
    state: "Maharashtra",
    pinCode: "400001",
    country: "India",
    invoiceDisplayName: "Example Shop",
    invoicePrefix: "",
    paymentInformation: "",
};

test("validates business profile tax IDs, phone, and Indian PIN code", () => {
    assert.equal(vendorBusinessProfileSchema.safeParse(validProfile).success, true);
    assert.equal(
        vendorBusinessProfileSchema.safeParse({
            ...validProfile,
            pan: "aapfu0939f",
        }).success,
        true
    );

    for (const [field, value] of [
        ["gstin", "INVALID"],
        ["pan", "1234567890"],
        ["businessPhone", "12345"],
        ["pinCode", "012345"],
        ["businessEmail", "not-an-email"],
    ] as const) {
        const result = vendorBusinessProfileSchema.safeParse({
            ...validProfile,
            [field]: value,
        });
        assert.equal(result.success, false, `${field} should be rejected`);
    }
});

test("requires GSTIN for regular and composition, and excludes it for unregistered", () => {
    assert.equal(
        vendorBusinessProfileSchema.safeParse({
            ...validProfile,
            gstRegistrationStatus: "composition",
        }).success,
        true
    );
    assert.equal(
        vendorBusinessProfileSchema.safeParse({
            ...validProfile,
            gstRegistrationStatus: "composition",
            gstin: "",
        }).success,
        false
    );
    assert.equal(
        vendorBusinessProfileSchema.safeParse({
            ...validProfile,
            gstRegistrationStatus: "unregistered",
            gstin: "",
        }).success,
        true
    );
    assert.equal(
        vendorBusinessProfileSchema.safeParse({
            ...validProfile,
            gstRegistrationStatus: "unregistered",
        }).success,
        false
    );
});

test("rejects documents with unsupported types or mismatched file contents", async () => {
    await assert.rejects(
        getVendorDocumentFormat(
            new File(["not a PDF"], "gst.pdf", { type: "application/pdf" })
        ),
        /contents do not match/
    );
    await assert.rejects(
        getVendorDocumentFormat(
            new File(["x"], "gst.txt", { type: "text/plain" })
        ),
        /Only PDF, JPEG, and PNG/
    );
});

test("accepts a PDF only when its signature matches the declared type", async () => {
    const pdf = new File(["%PDF-1.7\ncontents"], "gst.pdf", {
        type: "application/pdf",
    });
    assert.equal(await getVendorDocumentFormat(pdf), "pdf");
});
