// FILE: app/components/vendor/vendor-navbar.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Svg } from "@/app/components/Shop-ui";
import { useVendorSession } from "@/app/hooks/use-vendor-session";
import { NAV_ITEMS, isActive } from "./VendorSidebar";

interface Props {
    onMenuClick: () => void; // opens the mobile drawer
}

export default function VendorNavbar({ onMenuClick }: Props) {
    const pathname = usePathname();
    const { vendor, isPending, logout, isLoggingOut } = useVendorSession();

    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // page title comes from the active sidebar item
    const title = NAV_ITEMS.find((item) => isActive(pathname, item))?.label ?? "Dashboard";

    // close the profile menu on route change
    useEffect(() => {
        setMenuOpen(false);
    }, [pathname]);

    // close on outside click and on Escape
    useEffect(() => {
        if (!menuOpen) return;
        const onClick = (e: MouseEvent) => {
            if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
        };
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
        document.addEventListener("mousedown", onClick);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onClick);
            document.removeEventListener("keydown", onKey);
        };
    }, [menuOpen]);

    const name = vendor?.name ?? "Vendor";

    return (
        <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
            <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
                {/* left: menu button + title */}
                <div className="flex min-w-0 items-center gap-3">
                    <button
                        type="button"
                        onClick={onMenuClick}
                        aria-label="Open menu"
                        aria-controls="vendor-sidebar"
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 lg:hidden"
                    >
                        <Svg className="h-5 w-5" strokeWidth={2}>
                            <path d="M4 7h16M4 12h16M4 17h10" />
                        </Svg>
                    </button>

                    <div className="min-w-0">
                        <p className="hidden text-[11px] font-medium uppercase tracking-[0.2em] text-amber-700 sm:block">
                            Vendor panel
                        </p>
                        <p className="truncate text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
                            {title}
                        </p>
                    </div>
                </div>

                {/* right: store link + profile */}
                <div className="flex items-center gap-2 sm:gap-3">
                    <Link
                        href="/user"
                        className="hidden h-10 items-center gap-2 rounded-xl px-4 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 sm:inline-flex"
                    >
                        <Svg className="h-4 w-4">
                            <path d="M14 4h6v6" />
                            <path d="M20 4 10 14" />
                            <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
                        </Svg>
                        View store
                    </Link>

                    <div ref={menuRef} className="relative">
                        <button
                            type="button"
                            onClick={() => setMenuOpen((v) => !v)}
                            aria-haspopup="menu"
                            aria-expanded={menuOpen}
                            className="flex h-10 items-center gap-2.5 rounded-xl pl-1 pr-2 ring-1 ring-slate-200 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 sm:pr-3"
                        >
                            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-slate-900 to-indigo-900 text-sm font-semibold uppercase text-amber-200">
                                {name.charAt(0)}
                            </span>
                            <span className="hidden max-w-[9rem] truncate text-sm font-medium text-slate-900 sm:block">
                                {isPending ? "Loading…" : name}
                            </span>
                            <Svg
                                className={`hidden h-4 w-4 text-slate-500 transition-transform sm:block ${menuOpen ? "rotate-180" : ""
                                    }`}
                                strokeWidth={2}
                            >
                                <path d="m6 9 6 6 6-6" />
                            </Svg>
                        </button>

                        {menuOpen && (
                            <div
                                role="menu"
                                className="absolute right-0 mt-2 w-64 origin-top-right overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_-20px_rgba(15,23,42,0.3)] ring-1 ring-slate-200/70"
                            >
                                <div className="border-b border-slate-100 px-4 py-3">
                                    <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
                                    {vendor?.email && (
                                        <p className="truncate text-xs text-slate-500">{vendor.email}</p>
                                    )}
                                </div>

                                <div className="p-2">
                                    <Link
                                        href="/user"
                                        role="menuitem"
                                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50 sm:hidden"
                                    >
                                        View store
                                    </Link>
                                    <button
                                        type="button"
                                        role="menuitem"
                                        onClick={logout}
                                        disabled={isLoggingOut}
                                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                                    >
                                        <Svg className="h-4 w-4">
                                            <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
                                            <path d="M16 8l4 4-4 4M20 12H9" />
                                        </Svg>
                                        {isLoggingOut ? "Logging out…" : "Log out"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}