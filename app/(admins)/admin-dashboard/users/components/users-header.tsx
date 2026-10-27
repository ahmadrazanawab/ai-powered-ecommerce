import { Icon } from "./icons";

export function UsersHeader({ loading, onRefresh }: { loading: boolean; onRefresh: () => void }) {
    return (
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                    Customers
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                    Search customer accounts and block or unblock access.
                </p>
            </div>
            <button
                type="button"
                onClick={onRefresh}
                disabled={loading}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-medium text-white transition-colors hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
                <Icon className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}>
                    <path d="M20 11a8 8 0 1 0-2.3 5.7" />
                    <path d="M20 4v7h-7" />
                </Icon>
                {loading ? "Refreshing" : "Refresh"}
            </button>
        </section>
    );
}