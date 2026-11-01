"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/app/lib/axios";

/* ---------- edit these to match your store ---------- */
const BRAND = "Aurelia";
const CURRENCY = "$";

interface CategoryI {
    categoryId: string;
    name: string;
    slug: string;
    description: string | null;
    imageUrl: string | null;
}

/* ---------- placeholder content (replace with API data later) ---------- */
const stats = [
    { value: "10k+", label: "Happy customers" },
    { value: "500+", label: "Trusted vendors" },
    { value: "4.9", label: "Average rating" },
];

const trust = [
    {
        title: "Free shipping",
        text: "On your first order",
        icon: (
            <>
                <path d="M3 7h11v9H3z" />
                <path d="M14 10h4l3 3v3h-7" />
                <circle cx="7" cy="17.5" r="1.5" />
                <circle cx="17" cy="17.5" r="1.5" />
            </>
        ),
    },
    {
        title: "Secure payments",
        text: "Protected checkout",
        icon: (
            <>
                <path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" />
                <path d="m9 12 2 2 4-4" />
            </>
        ),
    },
    {
        title: "Easy returns",
        text: "Hassle-free process",
        icon: (
            <>
                <path d="M4 12a8 8 0 1 0 3-6.2" />
                <path d="M4 4v4h4" />
            </>
        ),
    },
    {
        title: "Friendly support",
        text: "We are here to help",
        icon: (
            <>
                <path d="M4 13v-1a8 8 0 0 1 16 0v1" />
                <rect x="3" y="13" width="4" height="6" rx="1.5" />
                <rect x="17" y="13" width="4" height="6" rx="1.5" />
            </>
        ),
    },
];

const featured = [
    { name: "Signature Leather Tote", vendor: "Maison Noir", price: 249, rating: 4.9, tag: "Bestseller", tone: "from-slate-900 to-indigo-900" },
    { name: "Minimal Chronograph", vendor: "Atelier Time", price: 389, rating: 4.8, tag: "New", tone: "from-indigo-950 to-slate-800" },
    { name: "Cashmere Wrap Scarf", vendor: "Nord & Co", price: 129, rating: 4.7, tag: "", tone: "from-slate-800 to-slate-950" },
    { name: "Gold Edge Sunglasses", vendor: "Verre Studio", price: 179, rating: 4.9, tag: "Limited", tone: "from-amber-900 to-slate-900" },
];

const testimonials = [
    {
        name: "Priya S.",
        role: "Verified buyer",
        text: "The quality is exceptional and delivery was faster than promised. The packaging felt like opening a gift.",
    },
    {
        name: "Daniel M.",
        role: "Verified buyer",
        text: "Finally a marketplace where every vendor feels curated. Checkout was smooth and support replied within minutes.",
    },
    {
        name: "Aisha K.",
        role: "Verified buyer",
        text: "I have ordered three times already. Every product matched the photos and arrived beautifully wrapped.",
    },
];

const footerColumns = [
    {
        title: "Shop",
        links: [
            { label: "All products", href: "/user/shop" },
            { label: "New arrivals", href: "/user/new-arrivals" },
            { label: "Categories", href: "/user#categories" },
        ],
    },
    {
        title: "Account",
        links: [
            { label: "Log in", href: "/user/login" },
            { label: "Sign up", href: "/user/signup" },
            { label: "My orders", href: "/user/orders" },
        ],
    },
    {
        title: "Company",
        links: [
            { label: "Contact", href: "/user/contact" },
            { label: "Become a vendor", href: "/vendor/signup" },
        ],
    },
];

/* ---------- small helpers ---------- */
const cardCls =
    "rounded-3xl bg-white shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/70";

const goldBtn =
    "inline-flex h-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-200 to-amber-400 px-7 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/20 transition hover:from-amber-100 hover:to-amber-300";

const Svg = ({
    children,
    className = "h-5 w-5",
    strokeWidth = 1.7,
}: {
    children: ReactNode;
    className?: string;
    strokeWidth?: number;
}) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
    >
        {children}
    </svg>
);

const GemIcon = ({ className }: { className?: string }) => (
    <Svg className={className} strokeWidth={1.5}>
        <path d="M6 4h12l3 5-9 11L3 9l3-5Z" />
        <path d="M3 9h18M9 4l3 5 3-5M12 9v11" />
    </Svg>
);

const Stars = ({ count = 5 }: { count?: number }) => (
    <div className="flex gap-0.5 text-amber-400" aria-label={`${count} out of 5 stars`}>
        {Array.from({ length: count }).map((_, i) => (
            <svg key={i} viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z" />
            </svg>
        ))}
    </div>
);

const Heading = ({
    eyebrow,
    title,
    action,
}: {
    eyebrow: string;
    title: string;
    action?: ReactNode;
}) => (
    <div className="flex items-end justify-between gap-4">
        <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-600">
                {eyebrow}
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
                {title}
            </h2>
        </div>
        {action}
    </div>
);

const GridTexture = ({ opacity = "opacity-[0.07]" }: { opacity?: string }) => (
    <div
        className={`pointer-events-none absolute inset-0 ${opacity}`}
        style={{
            backgroundImage:
                "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "44px 44px",
        }}
    />
);

export default function UserHomePage() {
    const [email, setEmail] = useState("");
    const [subscribed, setSubscribed] = useState(false);

    const { data, isPending, isError } = useQuery({
        queryKey: ["categories"],
        queryFn: async () => {
            const res = await api.get("/api/categories");
            return res.data;
        },
        staleTime: 5 * 60 * 1000,
    });

    const categories: CategoryI[] = Array.isArray(data?.data) ? data.data : [];

    // UI only: connect this to your newsletter API later
    const handleSubscribe = (e: FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return;
        setSubscribed(true);
        setEmail("");
    };

    return (
        <div>
            {/* ================= HERO ================= */}
            <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
                <div className="pointer-events-none absolute -right-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-indigo-500/20 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-40 -left-24 h-[28rem] w-[28rem] rounded-full bg-amber-300/10 blur-3xl" />
                <GridTexture />

                <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-24 pt-14 sm:px-6 sm:pb-28 sm:pt-20 lg:grid-cols-2 lg:gap-8 lg:px-8 lg:pb-36 lg:pt-28">
                    {/* Text */}
                    <div className="max-w-2xl">
                        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-amber-200 ring-1 ring-white/15 sm:text-xs">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
                            New season collection
                        </span>

                        <h1 className="mt-6 text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl xl:text-7xl">
                            Curated luxury,{" "}
                            <span className="bg-gradient-to-r from-amber-200 via-amber-300 to-amber-400 bg-clip-text text-transparent">
                                delivered to your door
                            </span>
                        </h1>

                        <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
                            Discover handpicked pieces from trusted vendors,
                            chosen for quality, craft and lasting style.
                        </p>

                        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                            <Link href="/user/shop" className={goldBtn}>
                                Shop now
                            </Link>
                            <a
                                href="#categories"
                                className="inline-flex h-12 items-center justify-center rounded-xl border border-white/20 px-7 text-sm font-medium text-white transition-colors hover:bg-white/10"
                            >
                                Explore categories
                            </a>
                        </div>

                        <dl className="mt-12 grid max-w-md grid-cols-3 gap-4 border-t border-white/10 pt-8">
                            {stats.map((s) => (
                                <div key={s.label}>
                                    <dd className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                                        {s.value}
                                    </dd>
                                    <dt className="mt-1 text-xs text-slate-400 sm:text-sm">
                                        {s.label}
                                    </dt>
                                </div>
                            ))}
                        </dl>
                    </div>

                    {/* Visual */}
                    <div className="relative mx-auto h-[340px] w-full max-w-sm sm:h-[420px] sm:max-w-md lg:h-[540px] lg:max-w-none">
                        {/* rings */}
                        <div className="absolute inset-0 grid place-items-center">
                            <div className="absolute h-[85%] w-[85%] max-h-[480px] max-w-[480px] rounded-full border border-white/10" />
                            <div className="absolute h-[62%] w-[62%] max-h-[350px] max-w-[350px] rounded-full border border-white/10" />
                            <div className="absolute h-[40%] w-[40%] max-h-[230px] max-w-[230px] rounded-full bg-amber-300/10 blur-2xl" />

                            {/* centerpiece */}
                            <div className="relative grid h-36 w-36 rotate-6 place-items-center rounded-[2rem] bg-gradient-to-br from-amber-100 via-amber-300 to-amber-500 text-slate-950 shadow-2xl shadow-amber-400/30 sm:h-44 sm:w-44 lg:h-52 lg:w-52 lg:rounded-[2.5rem]">
                                <GemIcon className="h-16 w-16 sm:h-20 sm:w-20 lg:h-24 lg:w-24" />
                                <div className="pointer-events-none absolute inset-0 rounded-[inherit] bg-gradient-to-br from-white/50 via-transparent to-transparent" />
                            </div>
                        </div>

                        {/* floating cards */}
                        <div className="absolute left-0 top-4 flex items-center gap-3 rounded-2xl bg-white/10 p-3 pr-5 shadow-xl ring-1 ring-white/20 backdrop-blur-md sm:top-8">
                            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 text-amber-300">
                                <Svg>{trust[0].icon}</Svg>
                            </span>
                            <div>
                                <p className="text-sm font-medium">Free shipping</p>
                                <p className="text-xs text-slate-300">First order</p>
                            </div>
                        </div>

                        <div className="absolute bottom-4 right-0 rounded-2xl bg-white/10 p-4 shadow-xl ring-1 ring-white/20 backdrop-blur-md sm:bottom-10">
                            <Stars />
                            <p className="mt-2 text-sm font-medium">4.9 rating</p>
                            <p className="text-xs text-slate-300">2,400+ reviews</p>
                        </div>

                        <div className="absolute bottom-20 left-2 hidden items-center gap-3 rounded-2xl bg-white/10 p-3 pr-5 shadow-xl ring-1 ring-white/20 backdrop-blur-md sm:flex lg:bottom-28">
                            <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 text-amber-300">
                                <Svg>{trust[1].icon}</Svg>
                            </span>
                            <div>
                                <p className="text-sm font-medium">Secure checkout</p>
                                <p className="text-xs text-slate-300">Protected payments</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ================= TRUST BAR ================= */}
            <section className="relative mx-auto -mt-12 max-w-7xl px-4 sm:-mt-14 sm:px-6 lg:px-8">
                <div className={`${cardCls} grid grid-cols-2 gap-px overflow-hidden bg-slate-200/70 lg:grid-cols-4`}>
                    {trust.map((b) => (
                        <div
                            key={b.title}
                            className="flex flex-col items-start gap-3 bg-white p-5 sm:flex-row sm:items-center sm:p-6"
                        >
                            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-900 text-amber-300">
                                <Svg>{b.icon}</Svg>
                            </span>
                            <div>
                                <p className="text-sm font-semibold text-slate-900">{b.title}</p>
                                <p className="text-xs text-slate-500">{b.text}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ================= CATEGORIES ================= */}
            <section
                id="categories"
                className="mx-auto mt-20 max-w-7xl scroll-mt-24 px-4 sm:px-6 lg:mt-28 lg:px-8"
            >
                <Heading
                    eyebrow="Browse"
                    title="Shop by category"
                    action={
                        <Link
                            href="/user/shop"
                            className="shrink-0 text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline"
                        >
                            View all
                        </Link>
                    }
                />

                {isPending ? (
                    <div className="mt-8 grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <div key={i} className="aspect-[4/5] animate-pulse rounded-3xl bg-slate-200/70" />
                        ))}
                    </div>
                ) : isError ? (
                    <div className={`${cardCls} mt-8 p-8 text-center`}>
                        <p className="text-sm font-medium text-rose-600">
                            Could not load categories. Please try again later.
                        </p>
                    </div>
                ) : categories.length === 0 ? (
                    <div className={`${cardCls} mt-8 p-8 text-center`}>
                        <p className="text-sm text-slate-500">
                            Categories will appear here soon.
                        </p>
                    </div>
                ) : (
                    <div className="mt-8 grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
                        {categories.map((c) => (
                            <Link
                                key={c.categoryId}
                                href={`/user/categories/${c.slug}`}
                                className="group relative block aspect-[4/5] overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-indigo-900 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.28)] ring-1 ring-slate-200/70"
                            >
                                {c.imageUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={c.imageUrl}
                                        alt={c.name}
                                        loading="lazy"
                                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                                    />
                                ) : (
                                    <span className="absolute inset-0 grid place-items-center text-6xl font-semibold uppercase text-white/20">
                                        {c.name.charAt(0)}
                                    </span>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/10 to-transparent" />
                                <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                                    <h3 className="text-base font-semibold tracking-tight text-white sm:text-lg">
                                        {c.name}
                                    </h3>
                                    <span className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-300">
                                        Explore
                                        <Svg className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" strokeWidth={2}>
                                            <path d="M5 12h14M13 6l6 6-6 6" />
                                        </Svg>
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </section>

            {/* ================= FEATURED (placeholder) ================= */}
            <section className="mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:mt-28 lg:px-8">
                <Heading
                    eyebrow="Handpicked"
                    title="Featured pieces"
                    action={
                        <Link
                            href="/user/shop"
                            className="shrink-0 text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline"
                        >
                            Shop all
                        </Link>
                    }
                />

                <div className="mt-8 grid grid-cols-2 gap-4 sm:gap-5 lg:grid-cols-4">
                    {featured.map((item) => (
                        <article key={item.name} className={`${cardCls} group overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-[0_28px_70px_-20px_rgba(15,23,42,0.28)]`}>
                            <div className={`relative aspect-square bg-gradient-to-br ${item.tone}`}>
                                <div className="absolute inset-0 grid place-items-center text-amber-200/40 transition-transform duration-500 group-hover:scale-110">
                                    <GemIcon className="h-16 w-16 sm:h-20 sm:w-20" />
                                </div>
                                {item.tag && (
                                    <span className="absolute left-3 top-3 rounded-full bg-gradient-to-br from-amber-200 to-amber-400 px-3 py-1 text-[11px] font-semibold text-slate-950">
                                        {item.tag}
                                    </span>
                                )}
                            </div>
                            <div className="p-4 sm:p-5">
                                <p className="text-xs text-slate-400">{item.vendor}</p>
                                <h3 className="mt-1 line-clamp-1 text-sm font-semibold text-slate-900 sm:text-base">
                                    {item.name}
                                </h3>
                                <div className="mt-2 flex items-center justify-between">
                                    <p className="text-base font-semibold text-slate-900">
                                        {CURRENCY}
                                        {item.price}
                                    </p>
                                    <span className="flex items-center gap-1 text-xs text-slate-500">
                                        <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 text-amber-400" aria-hidden="true">
                                            <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9L12 3Z" />
                                        </svg>
                                        {item.rating}
                                    </span>
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            </section>

            {/* ================= PROMO BANNER ================= */}
            <section className="mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:mt-28 lg:px-8">
                <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-amber-100 via-amber-200 to-amber-300 p-8 sm:p-12 lg:p-16">
                    <div className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full bg-white/40 blur-3xl" />
                    <GemIcon className="pointer-events-none absolute -bottom-8 -right-6 h-48 w-48 text-slate-950/10 sm:h-64 sm:w-64" />

                    <div className="relative max-w-xl">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-800">
                            Limited time
                        </p>
                        <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-slate-950 sm:text-4xl lg:text-5xl">
                            Enjoy up to 30% off the seasonal edit
                        </h2>
                        <p className="mt-4 text-sm leading-relaxed text-slate-700 sm:text-base">
                            Selected pieces from our top vendors, available while
                            stocks last.
                        </p>
                        <Link
                            href="/user/shop"
                            className="mt-8 inline-flex h-12 items-center justify-center rounded-xl bg-slate-950 px-7 text-sm font-semibold text-white shadow-lg shadow-slate-950/20 transition-colors hover:bg-slate-800"
                        >
                            Discover the edit
                        </Link>
                    </div>
                </div>
            </section>

            {/* ================= TESTIMONIALS ================= */}
            <section className="mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:mt-28 lg:px-8">
                <Heading eyebrow="Loved by customers" title="What people are saying" />

                <div className="mt-8 grid gap-5 md:grid-cols-3">
                    {testimonials.map((t) => (
                        <figure key={t.name} className={`${cardCls} flex flex-col p-6 sm:p-7`}>
                            <Stars />
                            <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-slate-600 sm:text-base">
                                &ldquo;{t.text}&rdquo;
                            </blockquote>
                            <figcaption className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-5">
                                <span className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-slate-900 to-indigo-900 text-sm font-semibold uppercase text-amber-200">
                                    {t.name.charAt(0)}
                                </span>
                                <div>
                                    <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                                    <p className="text-xs text-slate-400">{t.role}</p>
                                </div>
                            </figcaption>
                        </figure>
                    ))}
                </div>
            </section>

            {/* ================= NEWSLETTER ================= */}
            <section className="mx-auto mt-20 max-w-7xl px-4 sm:px-6 lg:mt-28 lg:px-8">
                <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-8 text-white sm:p-12 lg:p-16">
                    <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-indigo-500/25 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-amber-300/10 blur-3xl" />
                    <GridTexture />

                    <div className="relative mx-auto max-w-2xl text-center">
                        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">
                            Join the inner circle
                        </h2>
                        <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base">
                            Be first to hear about new arrivals, private sales and
                            curated collections.
                        </p>

                        {subscribed ? (
                            <div
                                role="status"
                                className="mx-auto mt-8 max-w-md rounded-2xl bg-white/10 px-5 py-4 text-sm text-amber-200 ring-1 ring-white/15"
                            >
                                Thank you for subscribing. Welcome to the circle.
                            </div>
                        ) : (
                            <form
                                onSubmit={handleSubscribe}
                                className="mx-auto mt-8 flex max-w-lg flex-col gap-3 sm:flex-row"
                            >
                                <label htmlFor="newsletter-email" className="sr-only">
                                    Email address
                                </label>
                                <input
                                    id="newsletter-email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="Enter your email"
                                    className="h-12 flex-1 rounded-xl bg-white/10 px-4 text-sm text-white ring-1 ring-white/15 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-300/60"
                                />
                                <button type="submit" className={goldBtn}>
                                    Subscribe
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
}