// FILE: app/(vendors)/vendor-dashbaord/page.tsx
// Temporary home page so you can see the layout working.
// I will replace it with real stats once I see your vendor API routes.


"use client";

import Link from "next/link";
import { Svg, cardCls } from "@/app/components/Shop-ui";
import { useVendorSession } from "@/app/hooks/use-vendor-session";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const BASE = "/vendor-dashboard";

const shortcuts = [
    {
        title: "Browse catalog",
        text: "Pick an admin product and list it in your store.",
        href: `${BASE}/catalog`,
        icon: (
            <>
                <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H20v14H5.5A1.5 1.5 0 0 0 4 19.5v-14Z" />
                <path d="M4 19.5A1.5 1.5 0 0 0 5.5 21H20v-3" />
            </>
        ),
    },
    {
        title: "My listings",
        text: "Update prices and stock, or remove a listing.",
        href: `${BASE}/products`,
        icon: (
            <>
                <path d="M12 3 3 7.5 12 12l9-4.5L12 3Z" />
                <path d="m3 12 9 4.5 9-4.5" />
            </>
        ),
    },
    {
        title: "Orders",
        text: "See new orders and update their status.",
        href: `${BASE}/orders`,
        icon: (
            <>
                <path d="M6 7h12l-1 12H7L6 7Z" />
                <path d="M9 7a3 3 0 0 1 6 0" />
            </>
        ),
    },
];

export default function VendorDashboardPage() {
    const router = useRouter();
    const { vendor, isPending } = useVendorSession();
    const [isVendor, setIsVendor] = useState(false);
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        const vendorToken = localStorage.getItem("vendor_token");
        const vendorId = localStorage.getItem("vendor_id");
        const vendorEmail = localStorage.getItem("vendor_email");
        const isActiveVendor = localStorage.getItem("isActive_vendor");

        // Check vendor login
        if (!vendorToken || !vendorId || !vendorEmail) {
            router.replace("/vendor/login");
            return;
        }

        // Check vendor active status
        if (isActiveVendor !== "true") {
            router.replace("/vendor/login");
            return;
        }

        setIsVendor(true);
        setIsChecking(false);

    }, [router]);

    // Prevent dashboard rendering during authentication validation
    if (isChecking || isPending) {
        return null;
    }

    if (!isVendor) {
        return null;
    }

    return (
        <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-amber-700">Overview</p>

            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                {isPending ? "Welcome back" : `Welcome back, ${vendor?.name ?? "vendor"}`}
            </h1>

            <p className="mt-2 max-w-xl text-sm text-slate-600">
                Manage your listings and orders from one place.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
                {shortcuts.map((s) => (
                    <Link
                        key={s.href}
                        href={s.href}
                        className={`${cardCls} group p-6 transition-all hover:-translate-y-0.5 hover:shadow-[0_28px_70px_-20px_rgba(15,23,42,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400`}
                    >
                        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-900 text-amber-300">
                            <Svg className="h-6 w-6">{s.icon}</Svg>
                        </span>

                        <h2 className="mt-5 text-base font-semibold text-slate-900">{s.title}</h2>

                        <p className="mt-1 text-sm text-slate-600">{s.text}</p>

                        <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-slate-900">
                            Open
                            <Svg className="h-4 w-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2}>
                                <path d="M5 12h14M13 6l6 6-6 6" />
                            </Svg>
                        </span>
                    </Link>
                ))}
            </div>
        </div>
    );
}
