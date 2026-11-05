// path: app/(users)/user/cart/page.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    useCart,
    useUpdateCartItem,
    useRemoveCartItem,
    useValidateCart,
    type CartItemI,
} from "@/app/hooks/use-cart";

const CURRENCY = "$";

const cardCls =
    "rounded-3xl bg-white shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/70";

const goldBtn =
    "inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-amber-200 to-amber-400 px-7 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/20 transition hover:from-amber-100 hover:to-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-500 disabled:shadow-none";

function formatPrice(value: string | number | undefined) {
    const n = Number(value);
    if (Number.isNaN(n)) return `${CURRENCY}0.00`;
    return `${CURRENCY}${n.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

type HttpErrorLike = { response?: { status?: number; data?: { message?: string } } };

function CartRow({
    item,
    busy,
    onQty,
    onRemove,
}: {
    item: CartItemI;
    busy: boolean;
    onQty: (qty: number) => void;
    onRemove: () => void;
}) {
    const gone = item.name === undefined; // offer no longer exists
    const maxQty = Math.max(1, item.stock ?? item.quantity);

    return (
        <li className={`${cardCls} flex gap-4 p-4 sm:p-5`}>
            <div className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-indigo-900 sm:h-28 sm:w-28">
                {item.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt={item.name ?? ""} className="h-full w-full object-cover" />
                )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h3 className="line-clamp-1 text-sm font-semibold text-slate-900 sm:text-base">
                            {gone ? "Unavailable item" : (
                                <Link href={`/user/shop/${item.slug}?listing=${encodeURIComponent(item.listingId)}`} className="hover:underline">
                                    {item.name}
                                </Link>
                            )}
                        </h3>
                        {!gone && (
                            <p className="mt-0.5 text-xs text-slate-500">
                                {item.vendorName} · {item.categoryName}
                            </p>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={onRemove}
                        disabled={busy}
                        aria-label="Remove item"
                        className="text-xs font-medium text-slate-500 underline-offset-4 hover:text-rose-600 hover:underline disabled:opacity-40"
                    >
                        Remove
                    </button>
                </div>

                {item.message && (
                    <p role="alert" className="mt-2 text-xs text-rose-600">
                        {item.message}
                    </p>
                )}

                <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                    {gone ? (
                        <span className="text-xs text-slate-500">Qty {item.quantity}</span>
                    ) : (
                        <div className="inline-flex h-10 items-center rounded-xl bg-white ring-1 ring-slate-200">
                            <button
                                type="button"
                                aria-label="Decrease quantity"
                                disabled={busy || item.quantity <= 1}
                                onClick={() => onQty(item.quantity - 1)}
                                className="grid h-10 w-10 place-items-center text-slate-700 hover:text-slate-950 disabled:opacity-30"
                            >
                                −
                            </button>
                            <span className="w-8 text-center text-sm font-semibold text-slate-900">
                                {item.quantity}
                            </span>
                            <button
                                type="button"
                                aria-label="Increase quantity"
                                disabled={busy || item.quantity >= maxQty}
                                onClick={() => onQty(item.quantity + 1)}
                                className="grid h-10 w-10 place-items-center text-slate-700 hover:text-slate-950 disabled:opacity-30"
                            >
                                +
                            </button>
                        </div>
                    )}

                    <div className="text-right">
                        {!gone && (
                            <p className="text-xs text-slate-500">{formatPrice(item.price)} each</p>
                        )}
                        <p className="text-base font-semibold text-slate-900">
                            {gone ? "—" : formatPrice(item.lineTotal)}
                        </p>
                    </div>
                </div>
            </div>
        </li>
    );
}

export default function CartPage() {
    const router = useRouter();
    const { data, isPending, isError, error, refetch } = useCart();
    const update = useUpdateCartItem();
    const remove = useRemoveCartItem();
    const validate = useValidateCart();

    const items: CartItemI[] = Array.isArray(data?.data?.items) ? data.data.items : [];
    const totalItems: number = data?.data?.totalItems ?? 0;
    const subtotal: string = data?.data?.subtotal ?? "0.00";

    const busy = update.isPending || remove.isPending || validate.isPending;
    const hasProblem = items.some((i) => !i.available);
    const needsLogin = (error as HttpErrorLike | null)?.response?.status === 401;

    const mutationError =
        ((update.error ?? remove.error) as HttpErrorLike | null)?.response?.data?.message;

    const handleCheckout = () => {
        validate.mutate(undefined, {
            onSuccess: (res) => {
                if (res.valid) router.push("/user/checkout"); // change to your checkout path
            },
        });
    };

    return (
        <div className="mx-auto max-w-7xl px-4 pb-24 pt-10 sm:px-6 lg:px-8">
            <nav aria-label="Breadcrumb" className="text-xs text-slate-500">
                <Link href="/user" className="hover:text-slate-900">Home</Link>
                <span className="mx-2">/</span>
                <span className="text-slate-900">Cart</span>
            </nav>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                Your cart
            </h1>

            {isPending ? (
                <div className="mt-8 space-y-4">
                    {[0, 1, 2].map((i) => (
                        <div key={i} className="h-36 animate-pulse rounded-3xl bg-slate-200/70" />
                    ))}
                </div>
            ) : needsLogin ? (
                <div className={`${cardCls} mx-auto mt-10 max-w-lg p-10 text-center`}>
                    <h2 className="text-lg font-semibold text-slate-900">Please log in</h2>
                    <p className="mt-2 text-sm text-slate-600">Log in to see your cart.</p>
                    <Link href="/user/login" className={`${goldBtn} mt-6`}>Log in</Link>
                </div>
            ) : isError ? (
                <div className={`${cardCls} mx-auto mt-10 max-w-lg p-10 text-center`}>
                    <h2 className="text-lg font-semibold text-slate-900">We couldn&apos;t load your cart</h2>
                    <p className="mt-2 text-sm text-slate-600">Please try again.</p>
                    <button type="button" onClick={() => refetch()} className={`${goldBtn} mt-6`}>
                        Try again
                    </button>
                </div>
            ) : items.length === 0 ? (
                <div className={`${cardCls} mx-auto mt-10 max-w-lg p-10 text-center`}>
                    <h2 className="text-lg font-semibold text-slate-900">Your cart is empty</h2>
                    <p className="mt-2 text-sm text-slate-600">Add something you love.</p>
                    <Link href="/user/shop" className={`${goldBtn} mt-6`}>Continue shopping</Link>
                </div>
            ) : (
                <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
                    <ul className="space-y-4">
                        {items.map((item) => (
                            <CartRow
                                key={item.cartItemId}
                                item={item}
                                busy={busy}
                                onQty={(quantity) => update.mutate({ itemId: item.cartItemId, quantity })}
                                onRemove={() => remove.mutate(item.cartItemId)}
                            />
                        ))}
                    </ul>

                    <aside className={`${cardCls} h-fit p-6 lg:sticky lg:top-24`}>
                        <h2 className="text-lg font-semibold text-slate-900">Order summary</h2>

                        <dl className="mt-5 space-y-3 text-sm">
                            <div className="flex justify-between">
                                <dt className="text-slate-600">Items</dt>
                                <dd className="font-medium text-slate-900">{totalItems}</dd>
                            </div>
                            <div className="flex justify-between border-t border-slate-200 pt-3 text-base">
                                <dt className="font-semibold text-slate-900">Subtotal</dt>
                                <dd className="font-semibold text-slate-900">{formatPrice(subtotal)}</dd>
                            </div>
                        </dl>

                        <div aria-live="polite" className="mt-4 space-y-2">
                            {hasProblem && (
                                <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-900">
                                    Some items need attention. Fix or remove them to continue.
                                </p>
                            )}
                            {validate.data && validate.data.valid === false && (
                                <p className="rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-700">
                                    {validate.data.message}
                                </p>
                            )}
                            {mutationError && (
                                <p className="rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-700">
                                    {mutationError}
                                </p>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={handleCheckout}
                            disabled={busy || hasProblem}
                            className={`${goldBtn} mt-5 w-full`}
                        >
                            {validate.isPending ? "Checking…" : "Proceed to checkout"}
                        </button>

                        <Link
                            href="/user/shop"
                            className="mt-3 block text-center text-sm font-medium text-slate-600 hover:text-slate-900"
                        >
                            Continue shopping
                        </Link>
                    </aside>
                </div>
            )}
        </div>
    );
}