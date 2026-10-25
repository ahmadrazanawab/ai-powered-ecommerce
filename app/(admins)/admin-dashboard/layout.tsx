"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

/* ---------- icons (inline, no extra dependency) ---------- */
const paths = {
    home: (
        <>
            <path d="M3 11 12 3l9 8" />
            <path d="M5 10v10h14V10" />
        </>
    ),
    approve: (
        <>
            <path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6l-7-3Z" />
            <path d="m9 12 2 2 4-4" />
        </>
    ),
    categories: (
        <>
            <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
            <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
            <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
            <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
        </>
    ),
    products: (
        <>
            <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" />
            <path d="m4 7 8 4 8-4" />
            <path d="M12 11v10" />
        </>
    ),
    vendors: (
        <>
            <path d="M3 9 5 4h14l2 5" />
            <path d="M4 9v11h16V9" />
            <path d="M9 20v-6h6v6" />
        </>
    ),
    users: (
        <>
            <circle cx="9" cy="8" r="3.5" />
            <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
            <path d="M16 4.5a3.5 3.5 0 0 1 0 7" />
            <path d="M18 14.5a6.5 6.5 0 0 1 3.5 5.5" />
        </>
    ),
    logs: (
        <>
            <path d="M7 3h8l4 4v14H7z" />
            <path d="M15 3v4h4" />
            <path d="M10 12h6M10 16h6" />
        </>
    ),
    profile: (
        <>
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
        </>
    ),
    logout: (
        <>
            <path d="M10 4H5v16h5" />
            <path d="m16 8 4 4-4 4" />
            <path d="M20 12H9" />
        </>
    ),
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
};

const Icon = ({
    name,
    className = "h-5 w-5",
}: {
    name: keyof typeof paths;
    className?: string;
}) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
    >
        {paths[name]}
    </svg>
);

/* ---------- navigation ---------- */
type NavItem = {
    label: string;
    href: string;
    icon: keyof typeof paths;
    superAdminOnly?: boolean;
};

type NavSection = {
    title?: string;
    items: NavItem[];
};

const navSections: NavSection[] = [
    {
        items: [{ label: "Overview", href: "/admin-dashboard", icon: "home" }],
    },
    {
        title: "Catalog",
        items: [
            {
                label: "Categories",
                href: "/admin-dashboard/categories",
                icon: "categories",
            },
            {
                label: "Products",
                href: "/admin-dashboard/products",
                icon: "products",
            },
        ],
    },
    {
        title: "People",
        items: [
            {
                label: "Vendors",
                href: "/admin-dashboard/vendors",
                icon: "vendors",
            },
            {
                label: "Customers",
                href: "/admin-dashboard/users",
                icon: "users",
            },
            {
                label: "Admin approvals",
                href: "/admin-dashboard/approve",
                icon: "approve",
                superAdminOnly: true,
            },
        ],
    },
    {
        title: "System",
        items: [
            {
                label: "Audit logs",
                href: "/admin-dashboard/audit-logs",
                icon: "logs",
                superAdminOnly: true,
            },
            {
                label: "Profile",
                href: "/admin-dashboard/profile",
                icon: "profile",
            },
        ],
    },
];

const roleLabel = (role: string) =>
    role === "super_admin" ? "Super admin" : "Admin";

export default function AdminDashboardLayout({
    children,
}: {
    children: ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();

    const [checking, setChecking] = useState(true);
    const [role, setRole] = useState("");
    const [sidebarOpen, setSidebarOpen] = useState(false);

    /* Role guard: only admin or super_admin with a saved token */
    useEffect(() => {
        const token = localStorage.getItem("admin_token");
        const savedRole = localStorage.getItem("admin_role") ?? "";

        if (!token || (savedRole !== "admin" && savedRole !== "super_admin")) {
            router.replace("/admin/login");
            return;
        }

        setRole(savedRole);
        setChecking(false);
    }, [router]);

    /* Close the mobile drawer when the route changes */
    useEffect(() => {
        setSidebarOpen(false);
    }, [pathname]);

    /* Close the drawer with Escape */
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setSidebarOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    const handleLogout = () => {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_role");
        localStorage.removeItem("admin_id");
        router.replace("/admin/login");
    };

    const isActive = (href: string) =>
        href === "/admin-dashboard"
            ? pathname === href
            : pathname.startsWith(href);

    if (checking) {
        return (
            <main
                data-theme="light"
                className="grid min-h-screen place-items-center bg-slate-50"
            >
                <div className="text-center">
                    <span className="loading loading-spinner loading-md text-slate-400" />
                    <p className="mt-3 text-sm text-slate-500">
                        Checking permissions...
                    </p>
                </div>
            </main>
        );
    }

    const visibleSections = navSections
        .map((section) => ({
            ...section,
            items: section.items.filter(
                (item) => !item.superAdminOnly || role === "super_admin"
            ),
        }))
        .filter((section) => section.items.length > 0);

    const visibleNav = visibleSections.flatMap((section) => section.items);

    const sidebar = (
        <div className="relative flex h-full flex-col overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white">
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-amber-300/10 blur-3xl" />
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.06]"
                style={{
                    backgroundImage:
                        "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
                    backgroundSize: "44px 44px",
                }}
            />

            {/* Brand */}
            <div className="relative flex items-center gap-3 px-6 py-6">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 ring-1 ring-white/20 backdrop-blur">
                    <Icon name="approve" className="h-6 w-6" />
                </span>
                <span className="text-lg font-semibold tracking-tight">
                    Admin Console
                </span>
            </div>

            {/* Links */}
            <nav className="relative flex-1 space-y-6 overflow-y-auto px-4 py-2">
                {visibleSections.map((section, index) => (
                    <div key={section.title ?? `section-${index}`}>
                        {section.title && (
                            <p className="mb-2 px-4 text-xs font-medium text-slate-400">
                                {section.title}
                            </p>
                        )}
                        <div className="space-y-1">
                            {section.items.map((item) => {
                                const active = isActive(item.href);
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        aria-current={active ? "page" : undefined}
                                        className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                                            active
                                                ? "bg-white text-slate-900 shadow-lg shadow-black/20"
                                                : "text-slate-300 hover:bg-white/10 hover:text-white"
                                        }`}
                                    >
                                        <Icon name={item.icon} />
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Logout */}
            <div className="relative border-t border-white/10 p-4">
                <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                >
                    <Icon name="logout" />
                    Log out
                </button>
            </div>
        </div>
    );

    return (
        <div data-theme="light" className="min-h-screen bg-slate-50">
            {/* Desktop sidebar */}
            <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 lg:block">
                {sidebar}
            </aside>

            {/* Mobile drawer */}
            <div
                className={`fixed inset-0 z-40 lg:hidden ${
                    sidebarOpen ? "" : "pointer-events-none"
                }`}
                aria-hidden={!sidebarOpen}
            >
                <div
                    onClick={() => setSidebarOpen(false)}
                    className={`absolute inset-0 bg-slate-950/50 backdrop-blur-sm transition-opacity ${
                        sidebarOpen ? "opacity-100" : "opacity-0"
                    }`}
                />
                <aside
                    className={`absolute inset-y-0 left-0 w-72 max-w-[85%] transition-transform duration-200 ${
                        sidebarOpen ? "translate-x-0" : "-translate-x-full"
                    }`}
                >
                    <button
                        type="button"
                        onClick={() => setSidebarOpen(false)}
                        aria-label="Close menu"
                        className="absolute right-3 top-4 z-10 grid h-9 w-9 place-items-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
                    >
                        <Icon name="close" />
                    </button>
                    {sidebar}
                </aside>
            </div>

            {/* Main column */}
            <div className="lg:pl-72">
                {/* Topbar */}
                <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur">
                    <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-8">
                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={() => setSidebarOpen(true)}
                                aria-label="Open menu"
                                className="grid h-10 w-10 place-items-center rounded-xl text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100 lg:hidden"
                            >
                                <Icon name="menu" />
                            </button>
                            <p className="text-sm font-medium text-slate-500">
                                {visibleNav.find((n) => isActive(n.href))
                                    ?.label ?? "Dashboard"}
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <span className="hidden rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200 sm:inline-flex">
                                {roleLabel(role)}
                            </span>
                            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-slate-900 to-indigo-900 text-sm font-semibold uppercase text-white">
                                {role === "super_admin" ? "S" : "A"}
                            </span>
                        </div>
                    </div>
                </header>

                <main className="px-4 py-6 sm:px-8 sm:py-8">{children}</main>
            </div>
        </div>
    );
}