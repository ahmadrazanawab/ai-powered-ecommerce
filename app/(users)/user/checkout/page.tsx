// path: app/(users)/user/checkout/page.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useCart, type CartItemI } from "@/app/hooks/use-cart";
import {
    useAddresses,
    useCreateAddress,
    useCheckout,
    type AddressI,
    type AddressInput,
} from "@/app/hooks/use-checkout";

const CURRENCY = "₹"; // orders are charged in INR

const cardCls =
    "rounded-3xl bg-white shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/70";

const goldBtn =
    "inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-amber-200 to-amber-400 px-7 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/20 transition hover:from-amber-100 hover:to-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-500 disabled:shadow-none";

const fieldCls =
    "h-12 w-full rounded-xl bg-white px-4 text-sm text-slate-900 ring-1 ring-slate-200 placeholder:text-slate-500 transition focus:outline-none focus:ring-2 focus:ring-amber-400/70";

type HttpErrorLike = { response?: { status?: number; data?: { message?: string } } };

function formatPrice(value: string | number | undefined) {
    const n = Number(value);
    if (Number.isNaN(n)) return `${CURRENCY}0.00`;
    return `${CURRENCY}${n.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

/* ---------- add address form ---------- */
function AddressForm({
    onDone,
    onCancel,
    canCancel,
}: {
    onDone: (id: string) => void;
    onCancel: () => void;
    canCancel: boolean;
}) {
    const create = useCreateAddress();
    const {
        register,
        handleSubmit,
        formState: { errors },
    } = useForm<AddressInput>({ defaultValues: { country: "India" } });

    const onSubmit = (values: AddressInput) => {
        create.mutate(values, {
            onSuccess: (res) => onDone(res.data.id),
        });
    };

    const err = (create.error as HttpErrorLike | null)?.response?.data?.message;

    const Field = ({
        name,
        label,
        placeholder,
        rules,
        span2,
    }: {
        name: keyof AddressInput;
        label: string;
        placeholder?: string;
        rules?: Parameters<typeof register>[1];
        span2?: boolean;
    }) => (
        <div className={span2 ? "sm:col-span-2" : ""}>
            <label htmlFor={name} className="mb-1.5 block text-xs font-medium text-slate-700">
                {label}
            </label>
            <input id={name} placeholder={placeholder} className={fieldCls} {...register(name, rules)} />
            {errors[name] && (
                <p role="alert" className="mt-1 text-xs text-rose-600">
                    {errors[name]?.message as string}
                </p>
            )}
        </div>
    );

    return (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field name="fullName" label="Full name" rules={{ required: "Full name is required" }} />
            <Field
                name="phone"
                label="Phone"
                rules={{
                    required: "Phone is required",
                    pattern: { value: /^\+?[0-9\s-]{10,15}$/, message: "Enter a valid phone number" },
                }}
            />
            <Field name="addressLine1" label="Address line 1" span2 rules={{ required: "Address is required" }} />
            <Field name="addressLine2" label="Address line 2 (optional)" span2 />
            <Field name="city" label="City" rules={{ required: "City is required" }} />
            <Field name="state" label="State" rules={{ required: "State is required" }} />
            <Field
                name="postalCode"
                label="Postal code"
                rules={{
                    required: "Postal code is required",
                    pattern: { value: /^\d{6}$/, message: "Enter a 6 digit PIN code" },
                }}
            />
            <Field name="country" label="Country" />

            {err && (
                <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-700 sm:col-span-2">
                    {err}
                </p>
            )}

            <div className="flex gap-3 sm:col-span-2">
                <button type="submit" disabled={create.isPending} className={goldBtn}>
                    {create.isPending ? "Saving…" : "Save address"}
                </button>
                {canCancel && (
                    <button
                        type="button"
                        onClick={onCancel}
                        className="inline-flex h-12 items-center rounded-xl px-6 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                    >
                        Cancel
                    </button>
                )}
            </div>
        </form>
    );
}

/* ---------- page ---------- */
export default function CheckoutPage() {
    const router = useRouter();
    const cart = useCart();
    const addressesQ = useAddresses();
    const checkout = useCheckout();

    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [placed, setPlaced] = useState(false); // avoids a flash of "cart is empty" after the order

    const items: CartItemI[] = Array.isArray(cart.data?.data?.items) ? cart.data.data.items : [];
    const totalItems: number = cart.data?.data?.totalItems ?? 0;
    const subtotal: string = cart.data?.data?.subtotal ?? "0.00";
    const addresses: AddressI[] = Array.isArray(addressesQ.data?.data) ? addressesQ.data.data : [];

    const activeId = selectedId ?? addresses[0]?.id ?? null;
    const formOpen = showForm || (addressesQ.isSuccess && addresses.length === 0);
    const hasProblem = items.some((i) => !i.available);

    const needsLogin =
        (cart.error as HttpErrorLike | null)?.response?.status === 401 ||
        (addressesQ.error as HttpErrorLike | null)?.response?.status === 401;

    const placeOrder = () => {
        if (!activeId) return;
        checkout.mutate(
            { addressId: activeId, paymentMethod: "cod" },
            {
                onSuccess: (res) => {
                    setPlaced(true);
                    router.replace(`/user/order-success/${res.data.orderId}`);
                },
            }
        );
    };

    const checkoutError = (checkout.error as HttpErrorLike | null)?.response?.data?.message;

    if (placed) return null;

    if (cart.isPending || addressesQ.isPending) {
        return (
            <div className="mx-auto max-w-7xl space-y-4 px-4 py-10 sm:px-6 lg:px-8">
                <div className="h-48 animate-pulse rounded-3xl bg-slate-200/70" />
                <div className="h-48 animate-pulse rounded-3xl bg-slate-200/70" />
            </div>
        );
    }

    if (needsLogin) {
        return (
            <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
                <div className={`${cardCls} mx-auto max-w-lg p-10 text-center`}>
                    <h1 className="text-lg font-semibold text-slate-900">Please log in</h1>
                    <p className="mt-2 text-sm text-slate-600">Log in to continue to checkout.</p>
                    <Link href="/user/auth-user" className={`${goldBtn} mt-6`}>Log in</Link>
                </div>
            </div>
        );
    }

    if (items.length === 0) {
        return (
            <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
                <div className={`${cardCls} mx-auto max-w-lg p-10 text-center`}>
                    <h1 className="text-lg font-semibold text-slate-900">Your cart is empty</h1>
                    <p className="mt-2 text-sm text-slate-600">Add something before checking out.</p>
                    <Link href="/user/shop" className={`${goldBtn} mt-6`}>Continue shopping</Link>
                </div>
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-7xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">
            <nav aria-label="Breadcrumb" className="text-xs text-slate-500">
                <Link href="/user" className="hover:text-slate-900">Home</Link>
                <span className="mx-2">/</span>
                <Link href="/user/cart" className="hover:text-slate-900">Cart</Link>
                <span className="mx-2">/</span>
                <span className="text-slate-900">Checkout</span>
            </nav>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Checkout</h1>

            <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
                <div className="space-y-6">
                    {/* address */}
                    <section className={`${cardCls} p-6`}>
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="text-lg font-semibold text-slate-900">Shipping address</h2>
                            {!formOpen && (
                                <button
                                    type="button"
                                    onClick={() => setShowForm(true)}
                                    className="text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline"
                                >
                                    + Add new
                                </button>
                            )}
                        </div>

                        {!formOpen && (
                            <div role="radiogroup" aria-label="Shipping address" className="mt-4 grid gap-3">
                                {addresses.map((a) => {
                                    const active = a.id === activeId;
                                    return (
                                        <button
                                            key={a.id}
                                            type="button"
                                            role="radio"
                                            aria-checked={active}
                                            onClick={() => setSelectedId(a.id)}
                                            className={`flex items-start gap-3 rounded-2xl p-4 text-left ring-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${active
                                                ? "bg-slate-950 text-white ring-slate-950"
                                                : "bg-white text-slate-900 ring-slate-200 hover:bg-slate-50"
                                                }`}
                                        >
                                            <span
                                                className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full ring-1 ${active ? "bg-amber-300 ring-amber-300" : "ring-slate-300"
                                                    }`}
                                            >
                                                {active && <span className="h-2 w-2 rounded-full bg-slate-950" />}
                                            </span>
                                            <span className="text-sm">
                                                <span className="block font-semibold">{a.fullName}</span>
                                                <span className={`block ${active ? "text-slate-300" : "text-slate-600"}`}>
                                                    {a.addressLine1}
                                                    {a.addressLine2 ? `, ${a.addressLine2}` : ""}, {a.city}, {a.state} {a.postalCode}, {a.country}
                                                </span>
                                                <span className={`block ${active ? "text-slate-300" : "text-slate-500"}`}>
                                                    {a.phone}
                                                </span>
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {formOpen && (
                            <AddressForm
                                canCancel={addresses.length > 0}
                                onCancel={() => setShowForm(false)}
                                onDone={(id) => {
                                    setSelectedId(id);
                                    setShowForm(false);
                                }}
                            />
                        )}
                    </section>

                    {/* payment */}
                    <section className={`${cardCls} p-6`}>
                        <h2 className="text-lg font-semibold text-slate-900">Payment</h2>
                        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-950 p-4 text-white">
                            <span className="grid h-5 w-5 place-items-center rounded-full bg-amber-300">
                                <span className="h-2 w-2 rounded-full bg-slate-950" />
                            </span>
                            <span>
                                <span className="block text-sm font-medium">Cash on delivery</span>
                                <span className="block text-xs text-slate-300">Pay when your order arrives</span>
                            </span>
                        </div>
                    </section>
                </div>

                {/* summary */}
                <aside className={`${cardCls} h-fit p-6 lg:sticky lg:top-24`}>
                    <h2 className="text-lg font-semibold text-slate-900">Order summary</h2>

                    <ul className="mt-4 space-y-3 text-sm">
                        {items.map((i) => (
                            <li key={i.cartItemId} className="flex justify-between gap-3">
                                <span className="line-clamp-1 text-slate-600">
                                    {i.name ?? "Unavailable item"} × {i.quantity}
                                </span>
                                <span className="font-medium text-slate-900">
                                    {i.lineTotal ? formatPrice(i.lineTotal) : "—"}
                                </span>
                            </li>
                        ))}
                    </ul>

                    <dl className="mt-5 space-y-3 border-t border-slate-200 pt-4 text-sm">
                        <div className="flex justify-between">
                            <dt className="text-slate-600">Items</dt>
                            <dd className="font-medium text-slate-900">{totalItems}</dd>
                        </div>
                        <div className="flex justify-between text-base">
                            <dt className="font-semibold text-slate-900">Total</dt>
                            <dd className="font-semibold text-slate-900">{formatPrice(subtotal)}</dd>
                        </div>
                    </dl>

                    <div aria-live="polite" className="mt-4 space-y-2">
                        {hasProblem && (
                            <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-900">
                                Some items are unavailable.{" "}
                                <Link href="/user/cart" className="font-semibold underline underline-offset-4">
                                    Fix your cart
                                </Link>
                            </p>
                        )}
                        {checkoutError && (
                            <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-700">
                                {checkoutError}
                            </p>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={placeOrder}
                        disabled={!activeId || formOpen || hasProblem || checkout.isPending}
                        className={`${goldBtn} mt-5 w-full`}
                    >
                        {checkout.isPending ? "Placing order…" : "Place order"}
                    </button>
                </aside>
            </div>
        </div>
    );
}