import type { DialogType, StatusFilter } from "./types";

export const API_URL = "/api/auth/user/request-otp/";
export const PAGE_SIZE = 10;

export const cardCls =
    "rounded-3xl bg-white shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/70";

export const filters: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "active", label: "Active" },
    { key: "blocked", label: "Blocked" },
];

export const dialogCopy: Record<
    DialogType,
    { title: string; body: (name: string) => string; confirm: string; tone: string; done: string }
> = {
    block: {
        title: "Block customer",
        body: (n) => `${n} will not be able to log in until you unblock them.`,
        confirm: "Block customer",
        tone: "bg-rose-600 hover:bg-rose-700",
        done: "Customer blocked",
    },
    unblock: {
        title: "Unblock customer",
        body: (n) => `${n} will be able to log in again.`,
        confirm: "Unblock customer",
        tone: "bg-emerald-600 hover:bg-emerald-700",
        done: "Customer unblocked",
    },
    delete: {
        title: "Delete customer",
        body: (n) =>
            `${n} will be removed from this list and can no longer log in. Only super admins can do this.`,
        confirm: "Delete customer",
        tone: "bg-slate-900 hover:bg-slate-800",
        done: "Customer deleted",
    },
};