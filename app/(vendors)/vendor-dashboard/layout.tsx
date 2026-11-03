// FILE: app/(vendors)/vendor-dashbaord/layout.tsx
// Wraps every page inside vendor-dashbaord with the sidebar + navbar.
"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import VendorSidebar from "@/app/(vendors)/vendor-dashboard/components/VendorSidebar";
import VendorNavbar from "@/app/(vendors)/vendor-dashboard/components/Vendor-navbar";

export default function VendorDashboardLayout({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const closeSidebar = useCallback(() => setSidebarOpen(false), []);

    // close the mobile drawer after navigating
    useEffect(() => {
        setSidebarOpen(false);
    }, [pathname]);

    return (
        <div className="min-h-screen bg-slate-50">
            <a
                href="#vendor-main"
                className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-xl focus:bg-slate-950 focus:px-4 focus:py-2 focus:text-sm focus:text-amber-200"
            >
                Skip to content
            </a>

            <VendorSidebar open={sidebarOpen} onClose={closeSidebar} />

            {/* content is pushed right by the sidebar width on desktop */}
            <div className="flex min-h-screen flex-col lg:pl-72">
                <VendorNavbar onMenuClick={() => setSidebarOpen(true)} />

                <main
                    id="vendor-main"
                    className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8"
                >
                    {children}
                </main>
            </div>
        </div>
    );
}