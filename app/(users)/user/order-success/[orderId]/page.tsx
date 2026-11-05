// path: app/(users)/user/order-success/[orderId]/page.tsx
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/app/lib/axios";

const CURRENCY = "₹";

const cardCls =
    "rounded-3xl bg-white shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/70";

const goldBtn =
    "inline-flex h-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-200 to-amber-400 px-7 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/20 transition hover:from-amber-100 hover:to-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2";

interface OrderItemI {
    id: string;
    productName: string;
    quantity: number;
    unitPrice: string;
    lineTotal: string;
}

interface OrderI {
    id: string;
    status: string;
    paymentMethod: string;
    paymentStatus: string;
    subtotal: string;
    shippingAddress: {
        fullName: string;
        phone: string;
        addressLine1: string;
        addressLine2: string | null;
        city: string;
        state: string;
        postalCode: string;
        country: string;
    };
    items: OrderItemI[];
}

const money = (v: string | number) =>
    `${CURRENCY}${Number(v).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function OrderSuccessPage() {
    const { orderId } = useParams<{ orderId: string }>();

    const { data, isPending, isError, refetch } = useQuery({
        queryKey: ["order", orderId],
        queryFn: async () => (await api.get(`/api/orders/${orderId}`)).data,
        enabled: Boolean(orderId),
        retry: 1,
    });

    const order: OrderI | undefined = data?.data;

    if (isPending) {
        return (
            <div className="mx-auto max-w-2xl px-4 py-16">
                <div className="h-72 animate-pulse rounded-3xl bg-slate-200/70" />
            </div>
        );
    }

    if (isError || !order) {
        return (
            <div className="mx-auto max-w-2xl px-4 py-16">
                <div className={`${cardCls} p-10 text-center`}>
                    <h1 className="text-lg font-semibold text-slate-900">We couldn&apos;t load this order</h1>
                    <p className="mt-2 text-sm text-slate-600">Your order may still have been placed.</p>
                    <button type="button" onClick={() => refetch()} className={`${goldBtn} mt-6`}>
                        Try again
                    </button>
                </div>
            </div>
        );
    }

    const a = order.shippingAddress;

    return (
        <div className="mx-auto max-w-2xl px-4 pb-24 pt-12 sm:px-6">
            <div className={`${cardCls} p-8`}>
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7" aria-hidden="true">
                        <path d="m5 12 5 5 9-10" />
                    </svg>
                </span>

                <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">Order placed</h1>
                <p className="mt-1 text-sm text-slate-600">
                    Order <span className="font-mono text-slate-900">{order.id.slice(0, 8).toUpperCase()}</span>
                    {" · "}
                    {order.paymentMethod === "cod" ? "Cash on delivery" : "Online payment"}
                </p>

                <ul className="mt-6 divide-y divide-slate-200 border-y border-slate-200 text-sm">
                    {order.items.map((i) => (
                        <li key={i.id} className="flex justify-between gap-3 py-3">
                            <span className="text-slate-700">
                                {i.productName} × {i.quantity}
                            </span>
                            <span className="font-medium text-slate-900">{money(i.lineTotal)}</span>
                        </li>
                    ))}
                </ul>

                <div className="mt-4 flex justify-between text-base font-semibold text-slate-900">
                    <span>Total</span>
                    <span>{money(order.subtotal)}</span>
                </div>

                <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                    <p className="font-semibold text-slate-900">Delivering to</p>
                    <p className="mt-1">
                        {a.fullName}, {a.addressLine1}
                        {a.addressLine2 ? `, ${a.addressLine2}` : ""}, {a.city}, {a.state} {a.postalCode}, {a.country}
                    </p>
                    <p>{a.phone}</p>
                </div>

                <Link href="/user/shop" className={`${goldBtn} mt-8 w-full`}>
                    Continue shopping
                </Link>
            </div>
        </div>
    );
}