import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import {
    createRazorpayOrder,
    toRazorpayPaise,
    verifyRazorpayCheckoutSignature,
    verifyRazorpayWebhookSignature,
} from "../app/api/lib/razorpay";

test("converts trusted decimal totals to integer paise", () => {
    assert.equal(toRazorpayPaise("123.45"), 12345);
    assert.throws(() => toRazorpayPaise("0"));
    assert.throws(() => toRazorpayPaise("invalid"));
});

test("checkout signature is bound to the exact order and payment IDs", () => {
    const secret = "test-key-secret";
    const orderId = "order_test_123";
    const paymentId = "pay_test_456";
    const signature = createHmac("sha256", secret)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");

    assert.equal(
        verifyRazorpayCheckoutSignature(
            orderId,
            paymentId,
            signature,
            secret
        ),
        true
    );
    assert.equal(
        verifyRazorpayCheckoutSignature(
            "order_other",
            paymentId,
            signature,
            secret
        ),
        false
    );
    assert.equal(
        verifyRazorpayCheckoutSignature(orderId, paymentId, "not-a-signature", secret),
        false
    );
});

test("webhook signature covers the exact raw payload", () => {
    const secret = "test-webhook-secret";
    const rawBody = '{"event":"payment.captured"}';
    const signature = createHmac("sha256", secret)
        .update(rawBody)
        .digest("hex");

    assert.equal(
        verifyRazorpayWebhookSignature(rawBody, signature, secret),
        true
    );
    assert.equal(
        verifyRazorpayWebhookSignature(
            `${rawBody} `,
            signature,
            secret
        ),
        false
    );
});

test("creates a Razorpay order with server credentials and trusted fields", async () => {
    const previousKeyId = process.env.RAZORPAY_KEY_ID;
    const previousSecret = process.env.RAZORPAY_KEY_SECRET;
    const previousFetch = globalThis.fetch;
    process.env.RAZORPAY_KEY_ID = "rzp_test_id";
    process.env.RAZORPAY_KEY_SECRET = "test-key-secret";

    globalThis.fetch = async (input, init) => {
        assert.equal(String(input), "https://api.razorpay.com/v1/orders");
        assert.equal(
            new Headers(init?.headers).get("authorization"),
            `Basic ${Buffer.from("rzp_test_id:test-key-secret").toString("base64")}`
        );
        assert.deepEqual(JSON.parse(String(init?.body)), {
            amount: 12345,
            currency: "INR",
            receipt: "internal-order-id",
            notes: { internal_order_id: "internal-order-id" },
        });

        return new Response(
            JSON.stringify({
                id: "order_test_123",
                amount: 12345,
                currency: "INR",
                receipt: "internal-order-id",
                status: "created",
            }),
            { status: 200, headers: { "content-type": "application/json" } }
        );
    };

    try {
        const order = await createRazorpayOrder({
            amount: 12345,
            currency: "INR",
            receipt: "internal-order-id",
        });
        assert.equal(order.id, "order_test_123");
    } finally {
        globalThis.fetch = previousFetch;
        if (previousKeyId === undefined) {
            delete process.env.RAZORPAY_KEY_ID;
        } else {
            process.env.RAZORPAY_KEY_ID = previousKeyId;
        }
        if (previousSecret === undefined) {
            delete process.env.RAZORPAY_KEY_SECRET;
        } else {
            process.env.RAZORPAY_KEY_SECRET = previousSecret;
        }
    }
});
