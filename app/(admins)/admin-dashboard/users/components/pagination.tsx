import type { Pagination as PaginationData } from "../lib/types";

const btn =
    "h-10 rounded-xl bg-white px-4 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-50";

export function Pagination({
    pagination,
    onPrev,
    onNext,
}: {
    pagination: PaginationData;
    onPrev: () => void;
    onNext: () => void;
}) {
    const { total, totalPages } = pagination;
    const from = total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
    const to = Math.min(pagination.page * pagination.limit, total);

    return (
        <div className="mt-5 flex flex-col items-center gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-between">
            <p className="text-sm text-slate-500">
                Showing {from}–{to} of {total.toLocaleString()}
            </p>
            <div className="flex items-center gap-2">
                <button type="button" onClick={onPrev} disabled={pagination.page === 1} className={btn}>
                    Previous
                </button>
                <span className="px-2 text-sm text-slate-500">
                    Page {pagination.page} of {totalPages}
                </span>
                <button
                    type="button"
                    onClick={onNext}
                    disabled={pagination.page === totalPages}
                    className={btn}
                >
                    Next
                </button>
            </div>
        </div>
    );
}