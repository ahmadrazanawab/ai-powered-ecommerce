

"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/app/lib/axios";
import { useUserSession } from "@/app/hooks/use-user-session";

/* ---------- edit these to match your store ---------- */
const BRAND = "Aurelia";
const ANNOUNCEMENT = "Complimentary shipping on your first order";

const links = [
    { label: "Home", href: "/user" },
    { label: "Shop", href: "/user/shop" },
    // Categories dropdown is rendered between Shop and the links below
    { label: "New arrivals", href: "/user/new-arrivals" },
    { label: "Contact", href: "/user/contact" },
];

interface CategoryI {
    categoryId: string;
    name: string;
    slug: string;
    imageUrl: string | null;
}

type NavbarUser = { name: string; email?: string } | null;

interface NavbarProps {
    cartCount?: number;
    wishlistCount?: number;
    user?: NavbarUser;
    onLogout?: () => void;
}

/* ---------- icons ---------- */
const iconPaths = {
    search: (
        <>
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
        </>
    ),
    heart: (
        <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z" />
    ),
    bag: (
        <>
            <path d="M5 8h14l-1 12H6L5 8Z" />
            <path d="M9 8V6a3 3 0 0 1 6 0v2" />
        </>
    ),
    user: (
        <>
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21a8 8 0 0 1 16 0" />
        </>
    ),
    menu: <path d="M4 7h16M4 12h16M4 17h10" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    chevron: <path d="m6 9 6 6 6-6" />,
    gem: (
        <>
            <path d="M6 4h12l3 5-9 11L3 9l3-5Z" />
            <path d="M3 9h18M9 4l3 5 3-5M12 9v11" />
        </>
    ),
    box: (
        <>
            <path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" />
            <path d="m4 7 8 4 8-4M12 11v10" />
        </>
    ),
    logout: (
        <>
            <path d="M10 4H5v16h5" />
            <path d="m16 8 4 4-4 4M20 12H9" />
        </>
    ),
};

const Icon = ({
    name,
    className = "h-5 w-5",
}: {
    name: keyof typeof iconPaths;
    className?: string;
}) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
    >
        {iconPaths[name]}
    </svg>
);

const Badge = ({ count }: { count: number }) =>
    count > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-gradient-to-br from-amber-200 to-amber-400 px-1 text-[10px] font-semibold text-slate-950 ring-2 ring-slate-950">
            {count > 99 ? "99+" : count}
        </span>
    ) : null;

const iconBtn =
    "relative grid h-10 w-10 place-items-center rounded-xl text-slate-300 transition-colors hover:bg-white/10 hover:text-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60";

const goldBtn =
    "inline-flex h-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-200 to-amber-400 px-5 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/20 transition hover:from-amber-100 hover:to-amber-300";

export default function Navbar({
    cartCount = 0,
    wishlistCount = 0,
    user = null,
    onLogout,
}: NavbarProps) {
    const pathname = usePathname();
    const router = useRouter();

    const [scrolled, setScrolled] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [searchOpen, setSearchOpen] = useState(false);
    const [openMenu, setOpenMenu] = useState<"categories" | "account" | null>(null);
    const [mobileCatsOpen, setMobileCatsOpen] = useState(false);
    const [announcementOpen, setAnnouncementOpen] = useState(true);
    const [query, setQuery] = useState("");

    /* Categories for the dropdown (public GET, shared cache with the admin page) */
    const { data, isPending } = useQuery({
        queryKey: ["categories"],
        queryFn: async () => {
            const res = await api.get("/api/categories");
            return res.data;
        },
        staleTime: 5 * 60 * 1000,
    });
    const categories: CategoryI[] = Array.isArray(data?.data) ? data.data : [];

    /* Shadow / blur after scrolling */
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 8);
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        return () => window.removeEventListener("scroll", onScroll);
    }, []);

    /*logout */
    const { authUser, logout, isLoggingOut, isLoading } = useUserSession();

    const isLoggedIn = !!authUser;

    const initial = authUser?.name?.charAt(0).toUpperCase() || "U";
    /* Close everything when the route changes */
    useEffect(() => {
        setDrawerOpen(false);
        setSearchOpen(false);
        setOpenMenu(null);
    }, [pathname]);

    /* Escape closes menus; click outside closes dropdowns */
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setDrawerOpen(false);
                setSearchOpen(false);
                setOpenMenu(null);
            }
        };
        const onClick = (e: MouseEvent) => {
            if (!(e.target as Element).closest("[data-menu]")) setOpenMenu(null);
        };
        window.addEventListener("keydown", onKey);
        document.addEventListener("mousedown", onClick);
        return () => {
            window.removeEventListener("keydown", onKey);
            document.removeEventListener("mousedown", onClick);
        };
    }, []);

    /* Lock page scroll while the drawer is open */
    useEffect(() => {
        const previous = document.body.style.overflow;
        document.body.style.overflow = drawerOpen ? "hidden" : previous;
        return () => {
            document.body.style.overflow = previous;
        };
    }, [drawerOpen]);

    const isActive = (href: string) =>
        href === "/user" ? pathname === "/user" : pathname.startsWith(href);

    const handleSearch = (e: FormEvent) => {
        e.preventDefault();
        const q = query.trim();
        if (!q) return;
        router.push(`/search?q=${encodeURIComponent(q)}`);
        setSearchOpen(false);
    };

    const navLinkCls = (active: boolean) =>
        `relative px-3 py-2 text-sm font-medium tracking-wide transition-colors ${active ? "text-amber-300" : "text-slate-300 hover:text-white"
        }`;

    const underline = (active: boolean) =>
        active ? (
            <span className="absolute inset-x-3 -bottom-0.5 h-px bg-gradient-to-r from-transparent via-amber-300 to-transparent" />
        ) : null;

    const categoriesActive = pathname.startsWith("/categories");

    const SearchForm = ({ id }: { id: string }) => (
        <form onSubmit={handleSearch} role="search" className="w-full">
            <label
                htmlFor={id}
                className="flex h-11 items-center gap-3 rounded-xl bg-white/10 px-4 ring-1 ring-white/15 transition focus-within:bg-white/15 focus-within:ring-amber-300/60"
            >
                <span className="text-slate-400">
                    <Icon name="search" className="h-[18px] w-[18px]" />
                </span>
                <input
                    id={id}
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search products"
                    className="w-full bg-transparent text-sm text-white placeholder:text-slate-400 focus:outline-none"
                />
            </label>
        </form>
    );

    // const initial = user?.name?.charAt(0) ?? "";

    return (
        <>
            {/* ---------- Announcement bar ---------- */}
            {announcementOpen && (
                <div className="relative bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 text-center text-xs text-amber-200/90">
                    <p className="px-10 py-2 tracking-[0.12em]">{ANNOUNCEMENT}</p>
                    <button
                        type="button"
                        onClick={() => setAnnouncementOpen(false)}
                        aria-label="Dismiss announcement"
                        className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-amber-200/70 hover:bg-white/10 hover:text-amber-200"
                    >
                        <Icon name="close" className="h-3.5 w-3.5" />
                    </button>
                </div>
            )}

            {/* ---------- Main navbar ---------- */}
            <header
                data-theme="light"
                className={`sticky top-0 z-40 border-b transition-all duration-300 ${scrolled
                    ? "border-white/10 bg-slate-950/90 shadow-lg shadow-black/20 backdrop-blur-xl"
                    : "border-white/5 bg-slate-950"
                    }`}
            >
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:h-[72px] lg:px-8">
                    {/* Left: hamburger + logo */}
                    <div className="flex items-center gap-2 sm:gap-3">
                        <button
                            type="button"
                            onClick={() => setDrawerOpen(true)}
                            aria-label="Open menu"
                            className={`${iconBtn} lg:hidden`}
                        >
                            <Icon name="menu" />
                        </button>

                        <Link href="/user" className="flex items-center gap-3">
                            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-amber-200 to-amber-400 text-slate-950 shadow-lg shadow-amber-400/20">
                                <Icon name="gem" className="h-5 w-5" />
                            </span>
                            <span className="text-base font-semibold uppercase tracking-[0.28em] text-white sm:text-lg">
                                {BRAND}
                            </span>
                        </Link>
                    </div>

                    {/* Center: desktop links */}
                    <nav
                        aria-label="Main"
                        className="hidden items-center gap-1 lg:flex"
                    >
                        {links.slice(0, 2).map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-current={isActive(item.href) ? "page" : undefined}
                                className={navLinkCls(isActive(item.href))}
                            >
                                {item.label}
                                {underline(isActive(item.href))}
                            </Link>
                        ))}

                        {/* Categories dropdown */}
                        <div data-menu className="relative">
                            <button
                                type="button"
                                onClick={() =>
                                    setOpenMenu((m) =>
                                        m === "categories" ? null : "categories"
                                    )
                                }
                                aria-expanded={openMenu === "categories"}
                                aria-haspopup="true"
                                className={`${navLinkCls(
                                    categoriesActive || openMenu === "categories"
                                )} flex items-center gap-1.5`}
                            >
                                Categories
                                <Icon
                                    name="chevron"
                                    className={`h-4 w-4 transition-transform ${openMenu === "categories" ? "rotate-180" : ""
                                        }`}
                                />
                                {underline(categoriesActive)}
                            </button>

                            {openMenu === "categories" && (
                                <div className="absolute left-1/2 top-full z-50 mt-3 w-[26rem] -translate-x-1/2 rounded-2xl bg-white p-3 shadow-2xl ring-1 ring-slate-200/70">
                                    {isPending ? (
                                        <div className="grid grid-cols-2 gap-2 p-1">
                                            {Array.from({ length: 6 }).map((_, i) => (
                                                <div
                                                    key={i}
                                                    className="h-14 animate-pulse rounded-xl bg-slate-100"
                                                />
                                            ))}
                                        </div>
                                    ) : categories.length === 0 ? (
                                        <p className="p-4 text-center text-sm text-slate-500">
                                            No categories yet.
                                        </p>
                                    ) : (
                                        <div className="grid max-h-80 grid-cols-2 gap-1 overflow-y-auto">
                                            {categories.slice(0, 10).map((c) => (
                                                <Link
                                                    key={c.categoryId}
                                                    href={`/user/categories/${c.slug}`}
                                                    className="flex items-center gap-3 rounded-xl p-2.5 transition-colors hover:bg-slate-50"
                                                >
                                                    <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-slate-900 to-indigo-900">
                                                        {c.imageUrl ? (
                                                            // eslint-disable-next-line @next/next/no-img-element
                                                            <img
                                                                src={c.imageUrl}
                                                                alt=""
                                                                loading="lazy"
                                                                className="h-full w-full object-cover"
                                                            />
                                                        ) : (
                                                            <span className="grid h-full w-full place-items-center text-sm font-semibold uppercase text-amber-200">
                                                                {c.name.charAt(0)}
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="truncate text-sm font-medium text-slate-800">
                                                        {c.name}
                                                    </span>
                                                </Link>
                                            ))}
                                        </div>
                                    )}

                                    <Link
                                        href="/user/shop"
                                        className="mt-2 flex items-center justify-center rounded-xl bg-slate-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                                    >
                                        Shop all products
                                    </Link>
                                </div>
                            )}
                        </div>

                        {links.slice(2).map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                aria-current={isActive(item.href) ? "page" : undefined}
                                className={navLinkCls(isActive(item.href))}
                            >
                                {item.label}
                                {underline(isActive(item.href))}
                            </Link>
                        ))}
                    </nav>

                    {/* Right: search, icons, account */}
                    <div className="flex items-center gap-1 sm:gap-2">
                        {/* Inline search on very wide screens */}
                        <div className="hidden w-64 xl:block">
                            <SearchForm id="search-desktop" />
                        </div>

                        {/* Search toggle on smaller screens */}
                        <button
                            type="button"
                            onClick={() => setSearchOpen((v) => !v)}
                            aria-label="Search"
                            aria-expanded={searchOpen}
                            className={`${iconBtn} xl:hidden`}
                        >
                            <Icon name={searchOpen ? "close" : "search"} />
                        </button>

                        <Link
                            href="/user/wishlist"
                            aria-label="Wishlist"
                            className={`${iconBtn} hidden sm:grid`}
                        >
                            <Icon name="heart" />
                            <Badge count={wishlistCount} />
                        </Link>

                        <Link href="/user/cart" aria-label="Shopping bag" className={iconBtn}>
                            <Icon name="bag" />
                            <Badge count={cartCount} />
                        </Link>

                        {/* Desktop account area */}
                        <div className="ml-1 hidden items-center gap-2 lg:flex">
                            {isLoading ? (
                                // Loading user profile
                                <div className="h-10 w-24 animate-pulse rounded-xl bg-white/10" />

                            ) : isLoggedIn ? (
                                <div data-menu className="relative">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setOpenMenu((m) =>
                                                m === "account" ? null : "account"
                                            )
                                        }
                                        aria-expanded={openMenu === "account"}
                                        aria-haspopup="true"
                                        aria-label="Account menu"
                                        className="flex items-center gap-2 rounded-xl p-1 pr-2 transition-colors hover:bg-white/10"
                                    >
                                        <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-amber-200 to-amber-400 text-sm font-semibold uppercase text-slate-950">
                                            {initial}
                                        </span>
                                        <Icon
                                            name="chevron"
                                            className={`h-4 w-4 text-slate-300 transition-transform ${openMenu === "account" ? "rotate-180" : ""
                                                }`}
                                        />
                                    </button>

                                    {openMenu === "account" && (
                                        <div className="absolute right-0 top-full z-50 mt-3 w-64 rounded-2xl bg-white p-2 shadow-2xl ring-1 ring-slate-200/70">
                                            <div className="px-3 py-3">
                                                <p className="truncate text-sm font-semibold text-slate-900">
                                                    {authUser.name || "Customer"}
                                                </p>
                                                {authUser?.email != null && (
                                                    <p className="truncate text-xs text-slate-500">
                                                        {authUser?.email}
                                                    </p>
                                                )}
                                                {authUser?.mobileNo != null && (
                                                    <p className="truncate text-xs text-slate-500">
                                                        {authUser?.mobileNo}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="border-t border-slate-100 pt-1">
                                                {[
                                                    { label: "My account", href: "/user/account", icon: "user" as const },
                                                    { label: "My orders", href: "/user/orders", icon: "box" as const },
                                                    { label: "Wishlist", href: "/user/wishlist", icon: "heart" as const },
                                                ].map((item) => (
                                                    <Link
                                                        key={item.href}
                                                        href={item.href}
                                                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                                                    >
                                                        <span className="text-slate-400">
                                                            <Icon name={item.icon} className="h-[18px] w-[18px]" />
                                                        </span>
                                                        {item.label}
                                                    </Link>
                                                ))}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setDrawerOpen(false);
                                                        logout();
                                                    }}
                                                    disabled={isLoggingOut}
                                                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-rose-600 transition-colors hover:bg-rose-50"
                                                >
                                                    <Icon name="logout" className="h-[18px] w-[18px]" />
                                                    {isLoggingOut ? "Logging out..." : "Log out"}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <>
                                    <Link
                                        href="/user/auth-user"
                                        className="px-3 py-2 text-sm font-medium tracking-wide text-slate-300 transition-colors hover:text-white"
                                    >
                                        Log in
                                    </Link>
                                    <Link href="/user/auth-user" className={goldBtn}>
                                        Sign up
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Search bar for screens narrower than xl */}
                {searchOpen && (
                    <div className="border-t border-white/10 px-4 pb-4 pt-3 sm:px-6 lg:px-8 xl:hidden">
                        <div className="mx-auto max-w-2xl">
                            <SearchForm id="search-mobile" />
                        </div>
                    </div>
                )}
            </header>

            {/* ---------- Mobile drawer ---------- */}
            <div
                className={`fixed inset-0 z-50 lg:hidden ${drawerOpen ? "" : "pointer-events-none"
                    }`}
                aria-hidden={!drawerOpen}
            >
                <div
                    onClick={() => setDrawerOpen(false)}
                    className={`absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-200 ${drawerOpen ? "opacity-100" : "opacity-0"
                        }`}
                />

                <aside
                    className={`absolute inset-y-0 left-0 flex w-80 max-w-[88%] flex-col overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white transition-transform duration-200 ${drawerOpen ? "translate-x-0" : "-translate-x-full"
                        }`}
                >
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

                    {/* Drawer header */}
                    <div className="relative flex items-center justify-between px-5 py-5">
                        <Link
                            href="/"
                            onClick={() => setDrawerOpen(false)}
                            className="flex items-center gap-3"
                        >
                            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-amber-200 to-amber-400 text-slate-950">
                                <Icon name="gem" className="h-5 w-5" />
                            </span>
                            <span className="text-base font-semibold uppercase tracking-[0.28em]">
                                {BRAND}
                            </span>
                        </Link>
                        <button
                            type="button"
                            onClick={() => setDrawerOpen(false)}
                            aria-label="Close menu"
                            className="grid h-9 w-9 place-items-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white"
                        >
                            <Icon name="close" />
                        </button>
                    </div>

                    {/* Drawer links */}
                    <nav
                        aria-label="Mobile"
                        className="relative flex-1 space-y-1 overflow-y-auto px-4 py-2"
                    >
                        {links.slice(0, 2).map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setDrawerOpen(false)}
                                className={`flex items-center rounded-xl px-4 py-3 text-sm font-medium transition-colors ${isActive(item.href)
                                    ? "bg-white text-slate-900 shadow-lg shadow-black/20"
                                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                                    }`}
                            >
                                {item.label}
                            </Link>
                        ))}

                        {/* Categories accordion */}
                        <div>
                            <button
                                type="button"
                                onClick={() => setMobileCatsOpen((v) => !v)}
                                aria-expanded={mobileCatsOpen}
                                className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
                            >
                                Categories
                                <Icon
                                    name="chevron"
                                    className={`h-4 w-4 transition-transform ${mobileCatsOpen ? "rotate-180" : ""
                                        }`}
                                />
                            </button>

                            {mobileCatsOpen && (
                                <div className="mt-1 space-y-0.5 pl-3">
                                    {isPending ? (
                                        <p className="px-4 py-2 text-sm text-slate-400">
                                            Loading...
                                        </p>
                                    ) : categories.length === 0 ? (
                                        <p className="px-4 py-2 text-sm text-slate-400">
                                            No categories yet.
                                        </p>
                                    ) : (
                                        categories.map((c) => (
                                            <Link
                                                key={c.categoryId}
                                                href={`/categories/${c.slug}`}
                                                onClick={() => setDrawerOpen(false)}
                                                className="flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-slate-300 transition-colors hover:bg-white/10 hover:text-amber-300"
                                            >
                                                <span className="h-1.5 w-1.5 rounded-full bg-amber-300/70" />
                                                {c.name}
                                            </Link>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        {links.slice(2).map((item) => (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={() => setDrawerOpen(false)}
                                className={`flex items-center rounded-xl px-4 py-3 text-sm font-medium transition-colors ${isActive(item.href)
                                    ? "bg-white text-slate-900 shadow-lg shadow-black/20"
                                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                                    }`}
                            >
                                {item.label}
                            </Link>
                        ))}

                        <Link
                            href="/user/wishlist"
                            onClick={() => setDrawerOpen(false)}
                            className="flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium text-slate-300 transition-colors hover:bg-white/10 hover:text-white sm:hidden"
                        >
                            Wishlist
                            {wishlistCount > 0 && (
                                <span className="rounded-full bg-amber-300/20 px-2 py-0.5 text-xs text-amber-200">
                                    {wishlistCount}
                                </span>
                            )}
                        </Link>
                    </nav>

                    {/* Drawer footer: account */}
                    <div className="relative border-t border-white/10 p-4">
                        {isLoading ? (
                            <div className="animate-pulse space-y-3">
                                <div className="h-10 w-full rounded-xl bg-white/10" />
                                <div className="h-10 w-full rounded-xl bg-white/10" />
                            </div>
                        ) : isLoggedIn ? (
                            <div className="space-y-1">
                                <div className="mb-2 flex items-center gap-3 px-2">
                                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-amber-200 to-amber-400 text-sm font-semibold uppercase text-slate-950">
                                        {initial}
                                    </span>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium">{authUser.name || "Customer"}</p>
                                        {authUser.email != null && (
                                            <p className="truncate text-xs text-slate-400">
                                                {authUser.email}
                                            </p>
                                        )}
                                        {authUser.mobileNo != null && (
                                            <p className="truncate text-xs text-slate-400">
                                                {authUser.mobileNo}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <Link
                                    href="/user/account"
                                    onClick={() => setDrawerOpen(false)}
                                    className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-slate-300 hover:bg-white/10 hover:text-white"
                                >
                                    <Icon name="user" className="h-[18px] w-[18px]" />
                                    My account
                                </Link>
                                <Link
                                    href="/user/orders"
                                    onClick={() => setDrawerOpen(false)}
                                    className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-slate-300 hover:bg-white/10 hover:text-white"
                                >
                                    <Icon name="box" className="h-[18px] w-[18px]" />
                                    My orders
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setDrawerOpen(false);
                                        logout();
                                    }}
                                    disabled={isLoggingOut}
                                    className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-slate-300 hover:bg-white/10 hover:text-white"
                                >
                                    <Icon name="logout" className="h-[18px] w-[18px]" />
                                    {isLoggingOut ? "Logging out..." : "Log out"}
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-3">
                                <Link
                                    href="/user/auth-user"
                                    onClick={() => setDrawerOpen(false)}
                                    className="inline-flex h-11 items-center justify-center rounded-xl border border-white/20 text-sm font-medium text-white transition-colors hover:bg-white/10"
                                >
                                    Log in
                                </Link>
                                <Link
                                    href="/user/auth-user"
                                    onClick={() => setDrawerOpen(false)}
                                    className={`${goldBtn} h-11`}
                                >
                                    Sign up
                                </Link>
                            </div>
                        )}
                    </div>
                </aside>
            </div>
        </>
    );
}