import { createHmac, timingSafeEqual } from "node:crypto";

const API_BASE_URL = "https://api.razorpay.com/v1";

export interface RazorpayOrder {
    id: string;
    amount: number;
    currency: string;
    receipt: string | null;
    status: string;
}

export interface RazorpayPayment {
    id: string;
    order_id: string;
    amount: number;
    currency: string;
    status: string;
    captured: boolean;
}

interface RazorpayCredentials {
    keyId: string;
    keySecret: string;
}

export function getRazorpayCredentials(): RazorpayCredentials {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
        throw new Error("RAZORPAY_NOT_CONFIGURED");
    }

    return { keyId, keySecret };
}

export function toRazorpayPaise(amount: string | number): number {
    const numericAmount = Number(amount);
    const amountPaise = Math.round(numericAmount * 100);

    if (
        !Number.isFinite(numericAmount) ||
        numericAmount <= 0 ||
        !Number.isSafeInteger(amountPaise)
    ) {
        throw new Error("INVALID_PAYMENT_AMOUNT");
    }

    return amountPaise;
}

async function razorpayRequest<T>(
    path: string,
    init: RequestInit = {}
): Promise<T> {
    const { keyId, keySecret } = getRazorpayCredentials();
    const authorization = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
    const response = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
        headers: {
            Authorization: `Basic ${authorization}`,
            "Content-Type": "application/json",
            ...init.headers,
        },
    });

    if (!response.ok) {
        throw new Error(`RAZORPAY_API_ERROR:${response.status}`);
    }

    return (await response.json()) as T;
}

export function createRazorpayOrder(input: {
    amount: number;
    currency: string;
    receipt: string;
}) {
    return razorpayRequest<RazorpayOrder>("/orders", {
        method: "POST",
        body: JSON.stringify({
            amount: input.amount,
            currency: input.currency,
            receipt: input.receipt,
            notes: { internal_order_id: input.receipt },
        }),
    });
}

export function fetchRazorpayOrder(orderId: string) {
    return razorpayRequest<RazorpayOrder>(
        `/orders/${encodeURIComponent(orderId)}`
    );
}

export function fetchRazorpayOrderPayments(orderId: string) {
    return razorpayRequest<{ items: RazorpayPayment[] }>(
        `/orders/${encodeURIComponent(orderId)}/payments`
    );
}

export function fetchRazorpayPayment(paymentId: string) {
    return razorpayRequest<RazorpayPayment>(
        `/payments/${encodeURIComponent(paymentId)}`
    );
}

export function verifyRazorpayCheckoutSignature(
    orderId: string,
    paymentId: string,
    signature: string,
    keySecret = getRazorpayCredentials().keySecret
): boolean {
    return safeHexSignature(
        createHmac("sha256", keySecret)
            .update(`${orderId}|${paymentId}`)
            .digest("hex"),
        signature
    );
}

export function verifyRazorpayWebhookSignature(
    body: string,
    signature: string,
    webhookSecret: string
): boolean {
    return safeHexSignature(
        createHmac("sha256", webhookSecret).update(body).digest("hex"),
        signature
    );
}

function safeHexSignature(expected: string, actual: string): boolean {
    if (!/^[\da-f]{64}$/i.test(actual)) return false;

    const expectedBytes = Buffer.from(expected, "hex");
    const actualBytes = Buffer.from(actual, "hex");

    return (
        expectedBytes.length === actualBytes.length &&
        timingSafeEqual(expectedBytes, actualBytes)
    );
}
