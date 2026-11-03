// FILE: app/components/vendor/vendor-sidebar.tsx
"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BRAND, GemIcon, GridTexture, Svg } from "@/app/components/Shop-ui";
import { useVendorSession } from "@/app/hooks/use-vendor-session";

/* ---------- navigation (one item per backend area) ---------- */
export interface NavItem {
    label: string;
    href: string;
    exact?: boolean;
    icon: ReactNode;
}

const BASE = "/vendor-dashboard"; // keep this spelling: it matches your folder name

export const NAV_ITEMS: NavItem[] = [
    {
        label: "Dashboard",
        href: BASE,
        exact: true,
        icon: (
            <>
                <rect x="3" y="3" width="7" height="9" rx="1.5" />
                <rect x="14" y="3" width="7" height="5" rx="1.5" />
                <rect x="14" y="12" width="7" height="9" rx="1.5" />
                <rect x="3" y="16" width="7" height="5" rx="1.5" />
            </>
        ),
    },
    {
        label: "Catalog",
        href: `${BASE}/catalog`,
        icon: (
            <>
                <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H20v14H5.5A1.5 1.5 0 0 0 4 19.5v-14Z" />
                <path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20v-3" />
                <path d="M9 8h7M9 12h5" />
            </>
        ),
    },
    {
        label: "My listings",
        href: `${BASE}/products`,
        icon: (
            <>
                <path d="M12 3 3 7.5 12 12l9-4.5L12 3Z" />
                <path d="m3 12 9 4.5 9-4.5" />
                <path d="m3 16.5 9 4.5 9-4.5" />
            </>
        ),
    },
    {
        label: "Orders",
        href: `${BASE}/orders`,
        icon: (
            <>
                <path d="M6 7h12l-1 12H7L6 7Z" />
                <path d="M9 7a3 3 0 0 1 6 0" />
            </>
        ),
    },
];

export function isActive(pathname: string, item: NavItem) {
    return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

interface Props {
    open: boolean; // mobile drawer state
    onClose: () => void;
}

export default function VendorSidebar({ open, onClose }: Props) {
    const pathname = usePathname();
    const { vendor, logout, isLoggingOut } = useVendorSession();

    // Escape closes the drawer, and the page behind it must not scroll while it is open
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        document.addEventListener("keydown", onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = prev;
        };
    }, [open, onClose]);

    return (
        <>
            {/* backdrop (mobile only) */}
            <div
                onClick={onClose}
                aria-hidden="true"
                className={`fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
                    open ? "opacity-100" : "pointer-events-none opacity-0"
                }`}
            />

            <aside
                id="vendor-sidebar"
                aria-label="Vendor navigation"
                className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-indigo-950 text-white shadow-2xl transition-[transform,visibility] duration-300 lg:visible lg:translate-x-0 lg:shadow-none ${
                    open ? "visible translate-x-0" : "invisible -translate-x-full"
                }`}
            >
                <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
                <div className="pointer-events-none absolute -bottom-24 -left-16 h-64 w-64 rounded-full bg-amber-300/10 blur-3xl" />
                <GridTexture opacity="opacity-[0.04]" />

                {/* brand */}
                <div className="relative flex h-16 shrink-0 items-center justify-between px-5">
                    <Link
                        href={BASE}
                        className="flex items-center gap-3 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                    >
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-amber-200 to-amber-400 text-slate-950 shadow-lg shadow-amber-400/20">
                            <GemIcon className="h-6 w-6" />
                        </span>
                        <span className="leading-tight">
                            <span className="block text-base font-semibold tracking-tight">{BRAND}</span>
                            <span className="block text-[11px] font-medium uppercase tracking-[0.2em] text-amber-300">
                                Vendor
                            </span>
                        </span>
                    </Link>

                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close menu"
                        className="grid h-10 w-10 place-items-center rounded-xl text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 lg:hidden"
                    >
                        <Svg className="h-5 w-5" strokeWidth={2}>
                            <path d="M6 6l12 12M18 6 6 18" />
                        </Svg>
                    </button>
                </div>

                {/* links */}
                <nav className="relative mt-4 flex-1 overflow-y-auto px-3 pb-4">
                    <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">
                        Manage
                    </p>
                    <ul className="space-y-1">
                        {NAV_ITEMS.map((item) => {
                            const active = isActive(pathname, item);
                            return (
                                <li key={item.href}>
                                    <Link
                                        href={item.href}
                                        aria-current={active ? "page" : undefined}
                                        className={`group relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
                                            active
                                                ? "bg-white/10 text-amber-200 ring-1 ring-white/10"
                                                : "text-slate-300 hover:bg-white/5 hover:text-white"
                                        }`}
                                    >
                                        {active && (
                                            <span className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-gradient-to-b from-amber-200 to-amber-400" />
                                        )}
                                        <span
                                            className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition ${
                                                active
                                                    ? "bg-gradient-to-br from-amber-200 to-amber-400 text-slate-950"
                                                    : "bg-white/5 text-slate-300 group-hover:text-amber-300"
                                            }`}
                                        >
                                            <Svg className="h-5 w-5">{item.icon}</Svg>
                                        </span>
                                        {item.label}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>

                    <p className="mt-8 px-3 pb-2 text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">
                        Store
                    </p>
                    <ul>
                        <li>
                            <Link
                                href="/user"
                                className="group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                            >
                                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/5 text-slate-300 group-hover:text-amber-300">
                                    <Svg className="h-5 w-5">
                                        <path d="M14 4h6v6" />
                                        <path d="M20 4 10 14" />
                                        <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
                                    </Svg>
                                </span>
                                View store
                            </Link>
                        </li>
                    </ul>
                </nav>

                {/* account card */}
                <div className="relative shrink-0 border-t border-white/10 p-3">
                    <div className="flex items-center gap-3 rounded-2xl bg-white/5 p-3 ring-1 ring-white/10">
                        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-200 to-amber-400 text-sm font-semibold uppercase text-slate-950">
                            {(vendor?.name ?? "V").charAt(0)}
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{vendor?.name ?? "Vendor"}</p>
                            {vendor?.email && (
                                <p className="truncate text-xs text-slate-400">{vendor.email}</p>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={logout}
                            disabled={isLoggingOut}
                            aria-label="Log out"
                            title="Log out"
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:opacity-50"
                        >
                            <Svg className="h-5 w-5">
                                <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
                                <path d="M16 8l4 4-4 4M20 12H9" />
                            </Svg>
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}