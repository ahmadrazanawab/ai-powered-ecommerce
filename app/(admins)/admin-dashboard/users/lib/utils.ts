import { isAxiosError } from "axios";
import type { User } from "../lib/types";

export function displayName(u: User) {
    return u.name?.trim() || u.email || u.mobileNo || "This customer";
}

export function initials(u: User) {
    const parts = displayName(u).split(/[\s@.]+/).filter(Boolean);
    return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function formatDate(iso: string | null) {
    if (!iso) return "Never";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "Unknown";
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function getErrorMessage(err: unknown, fallback = "Something went wrong. Try again.") {
    if (isAxiosError(err)) {
        const message = err.response?.data?.message;
        if (typeof message === "string" && message) return message;
        const status = err.response?.status;
        if (status === 401 || status === 403) return "You are not authorized to do this";
        return fallback;
    }
    return err instanceof Error ? err.message : fallback;
}