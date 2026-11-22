"use client";

import { api } from "@/app/lib/axios";

export interface RazorpayCheckoutOrder {
    keyId: string;
    orderId: string;
    razorpayOrderId: string;
    amount: number;
    currency: string;
}

interface RazorpaySuccessResponse {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
}

interface RazorpayFailureResponse {
    error?: {
        description?: string;
        metadata?: {
            payment_id?: string;
        };
    };
}

interface RazorpayCheckoutOptions {
    key: string;
    amount: number;
    currency: string;
    name: string;
    description: string;
    order_id: string;
    handler: (response: RazorpaySuccessResponse) => void;
    modal: { ondismiss: () => void };
    theme: { color: string };
}

interface RazorpayCheckoutInstance {
    open(): void;
    on(
        event: "payment.failed",
        handler: (response: RazorpayFailureResponse) => void
    ): void;
}

declare global {
    interface Window {
        Razorpay?: new (
            options: RazorpayCheckoutOptions
        ) => RazorpayCheckoutInstance;
    }
}

type CheckoutResult =
    | { kind: "paid" }
    | { kind: "failed"; message: string }
    | { kind: "cancelled" };

async function loadRazorpayCheckout() {
    if (window.Razorpay) return;

    await new Promise<void>((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>(
            'script[data-razorpay-checkout="true"]'
        );
        const script =
            existing ?? document.createElement("script");

        script.addEventListener("load", () => resolve(), { once: true });
        script.addEventListener(
            "error",
            () => reject(new Error("Unable to load Razorpay Checkout")),
            { once: true }
        );

        if (!existing) {
            script.src = "https://checkout.razorpay.com/v1/checkout.js";
            script.async = true;
            script.dataset.razorpayCheckout = "true";
            document.body.appendChild(script);
        }
    });

    if (!window.Razorpay) {
        throw new Error("Razorpay Checkout did not initialize");
    }
}

export async function startRazorpayCheckout(
    order: RazorpayCheckoutOrder
): Promise<CheckoutResult> {
    await loadRazorpayCheckout();
    const Razorpay = window.Razorpay;
    if (!Razorpay) throw new Error("Razorpay Checkout did not initialize");

    const response = await new Promise<
        | { kind: "success"; response: RazorpaySuccessResponse }
        | { kind: "failed"; response: RazorpayFailureResponse }
        | { kind: "cancelled" }
    >((resolve) => {
        let settled = false;
        const settle = (
            value:
                | { kind: "success"; response: RazorpaySuccessResponse }
                | { kind: "failed"; response: RazorpayFailureResponse }
                | { kind: "cancelled" }
        ) => {
            if (settled) return;
            settled = true;
            resolve(value);
        };

        const checkout = new Razorpay({
            key: order.keyId,
            amount: order.amount,
            currency: order.currency,
            name: "AI-powered Ecommerce",
            description: "Order payment",
            order_id: order.razorpayOrderId,
            handler: (paymentResponse) =>
                settle({ kind: "success", response: paymentResponse }),
            modal: { ondismiss: () => settle({ kind: "cancelled" }) },
            theme: { color: "#fbbf24" },
        });

        checkout.on("payment.failed", (failureResponse) =>
            settle({ kind: "failed", response: failureResponse })
        );
        checkout.open();
    });

    if (response.kind === "cancelled") return response;

    if (response.kind === "failed") {
        const paymentId = response.response.error?.metadata?.payment_id;
        if (paymentId) {
            await api.post("/api/payments/razorpay/failure", {
                orderId: order.orderId,
                razorpay_payment_id: paymentId,
            });
        }

        return {
            kind: "failed",
            message:
                response.response.error?.description ||
                "Payment failed. You can retry this order.",
        };
    }

    await api.post("/api/payments/razorpay/verify", {
        orderId: order.orderId,
        ...response.response,
    });

    return { kind: "paid" };
}
