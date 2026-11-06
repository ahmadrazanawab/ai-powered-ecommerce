import Link from "next/link";

/* ---------- edit these to match your store ---------- */
const BRAND = "Aurelia";

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
            { label: "About", href: "/user/about" },
            { label: "Become a vendor", href: "/vendor/signup" },
        ],
    },
];

const GemIcon = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
    >
        <path d="M6 4h12l3 5-9 11L3 9l3-5Z" />
        <path d="M3 9h18M9 4l3 5 3-5M12 9v11" />
    </svg>
);

export default function Footer() {
    return (
        <footer className="mt-20 bg-slate-950 text-slate-300 lg:mt-28">
            <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
                <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-5">
                    <div className="lg:col-span-2">
                        <div className="flex items-center gap-3">
                            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-amber-200 to-amber-400 text-slate-950">
                                <GemIcon className="h-5 w-5" />
                            </span>
                            <span className="text-lg font-semibold uppercase tracking-[0.28em] text-white">
                                {BRAND}
                            </span>
                        </div>
                        <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate-400">
                            A curated marketplace of trusted vendors, bringing
                            quality and craft to your door.
                        </p>
                    </div>

                    {footerColumns.map((col) => (
                        <div key={col.title}>
                            <h3 className="text-sm font-semibold text-white">
                                {col.title}
                            </h3>
                            <ul className="mt-4 space-y-3 text-sm">
                                {col.links.map((l) => (
                                    <li key={l.label}>
                                        <Link
                                            href={l.href}
                                            className="text-slate-400 transition-colors hover:text-amber-300"
                                        >
                                            {l.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className="mt-12 flex flex-col gap-2 border-t border-white/10 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                    <p>
                        &copy; {new Date().getFullYear()} {BRAND}. All rights reserved.
                    </p>
                    <p>Crafted with care.</p>
                </div>
            </div>
        </footer>
    );
}