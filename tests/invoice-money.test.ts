import assert from "node:assert/strict";
import test from "node:test";

import {
    calculateInclusiveTax,
    decimalToMinorUnits,
    gstRateToBasisPoints,
    isInterstateIndianSupply,
    minorUnitsToDecimal,
} from "../app/api/lib/invoices/money.ts";

test("money conversion retains decimal precision without floating point", () => {
    assert.equal(decimalToMinorUnits("999999.99"), 99999999n);
    assert.equal(minorUnitsToDecimal(123456789012345n), "1234567890123.45");
    assert.equal(minorUnitsToDecimal(-1n), "-0.01");
});

test("inclusive GST is split intrastate and charged as IGST interstate", () => {
    assert.deepEqual(calculateInclusiveTax(11800n, "18.00", false), {
        taxableAmount: "100.00",
        cgstAmount: "9.00",
        sgstAmount: "9.00",
        igstAmount: "0.00",
        totalTax: "18.00",
    });
    assert.deepEqual(calculateInclusiveTax(11800n, "18.00", true), {
        taxableAmount: "100.00",
        cgstAmount: "0.00",
        sgstAmount: "0.00",
        igstAmount: "18.00",
        totalTax: "18.00",
    });
    assert.deepEqual(calculateInclusiveTax(10000n, "0.00", false), {
        taxableAmount: "100.00",
        cgstAmount: "0.00",
        sgstAmount: "0.00",
        igstAmount: "0.00",
        totalTax: "0.00",
    });
});

test("tax rates outside a percentage range are rejected", () => {
    assert.equal(gstRateToBasisPoints("5.50"), 550n);
    assert.throws(() => gstRateToBasisPoints("101.00"), /INVALID_GST_RATE/);
    assert.throws(() => gstRateToBasisPoints("invalid"), /INVALID_GST_RATE/);
});

test("Indian state aliases resolve consistently and unknown places fail closed", () => {
    assert.equal(isInterstateIndianSupply("Orissa", "Odisha"), false);
    assert.equal(isInterstateIndianSupply("Maharashtra", "Delhi"), true);
    assert.equal(isInterstateIndianSupply("Unknown", "Delhi"), null);
});
