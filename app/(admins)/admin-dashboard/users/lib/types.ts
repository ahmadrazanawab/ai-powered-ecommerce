export type User = {
    userId: string;
    name: string | null;
    email: string | null;
    mobileNo: string | null;
    isVerified: boolean;
    isBlocked: boolean;
    blockedReason: string | null;
    blockedAt: string | null;
    lastLoginAt: string | null;
    createdAt: string;
};

export type Stats = { total: number; active: number; blocked: number; newThisWeek: number };
export type Pagination = { page: number; limit: number; total: number; totalPages: number };
export type ListResponse = {
    success: boolean;
    message?: string;
    users: User[];
    pagination: Pagination;
    stats: Stats;
};

export type StatusFilter = "all" | "active" | "blocked";
export type DialogType = "block" | "unblock" | "delete";
export type DialogState = { type: DialogType; user: User } | null;
export type UsersParams = { page: number; status: StatusFilter; search: string };