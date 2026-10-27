"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { ConfirmDialog } from "./components/confirm-dialog";
import { UsersEmpty, UsersError, UsersSkeleton } from "./components/list-states";
import { Notice } from "./components/notice";
import { Pagination } from "./components/pagination";
import { StatCards } from "./components/stat-cards";
import { UsersHeader } from "./components/users-header";
import { UsersMobileList } from "./components/users-mobile-list";
import { UsersTable } from "./components/users-table";
import { UsersToolbar } from "./components/users-toolbar";
import { PAGE_SIZE, cardCls, dialogCopy } from "./lib/constants";
import { USERS_KEY, useUserAction, useUsersQuery } from "./lib/queries";
import type { DialogState, DialogType, Pagination as PaginationData, StatusFilter, User } from "./lib/types";
import { getErrorMessage } from "./lib/utils";

const EMPTY_PAGINATION: PaginationData = { page: 1, limit: PAGE_SIZE, total: 0, totalPages: 1 };

export default function UsersPage() {
    const queryClient = useQueryClient();

    const [role, setRole] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState<StatusFilter>("all");
    const [page, setPage] = useState(1);

    const [dialog, setDialog] = useState<DialogState>(null);
    const [reason, setReason] = useState("");
    const [dialogError, setDialogError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const { data, isFetching, isError, error: queryError, refetch } = useUsersQuery({
        page,
        status,
        search,
    });
    const action = useUserAction();

    const users = data?.users ?? [];
    const stats = data?.stats ?? null;
    const pagination = data?.pagination ?? EMPTY_PAGINATION;
    const loading = isFetching;
    const error = isError && !isFetching ? getErrorMessage(queryError, "Could not load customers") : null;
    const busy = action.isPending;
    const isSuperAdmin = role === "super_admin"; // cosmetic only; the API enforces permissions
    const hasFilters = search !== "" || status !== "all";

    useEffect(() => {
        setRole(localStorage.getItem("admin_role") ?? "");
    }, []);

    // if the current page no longer exists (e.g. after a delete), go to the last page
    useEffect(() => {
        if (data && page > data.pagination.totalPages) setPage(data.pagination.totalPages);
    }, [data, page]);

    // debounce search
    useEffect(() => {
        const t = setTimeout(() => {
            setSearch(searchInput.trim());
            setPage(1);
        }, 350);
        return () => clearTimeout(t);
    }, [searchInput]);

    // auto-dismiss success notice
    useEffect(() => {
        if (!notice) return;
        const t = setTimeout(() => setNotice(null), 3500);
        return () => clearTimeout(t);
    }, [notice]);

    function openDialog(type: DialogType, user: User) {
        setDialog({ type, user });
        setReason("");
        setDialogError(null);
    }

    function closeDialog() {
        setDialog(null);
        setReason("");
        setDialogError(null);
    }

    async function confirmDialog() {
        if (!dialog) return;
        if (dialog.type === "block" && reason.trim().length < 3) {
            setDialogError("Enter a reason of at least 3 characters.");
            return;
        }
        setDialogError(null);
        try {
            await action.mutateAsync({
                type: dialog.type,
                userId: dialog.user.userId,
                reason: reason.trim(),
            });
            setNotice(dialogCopy[dialog.type].done);
            closeDialog();
            await queryClient.invalidateQueries({ queryKey: USERS_KEY });
        } catch (err) {
            setDialogError(getErrorMessage(err));
        }
    }

    function clearFilters() {
        setSearchInput("");
        setSearch("");
        setStatus("all");
        setPage(1);
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <UsersHeader loading={loading} onRefresh={() => refetch()} />

            {notice && <Notice message={notice} />}

            <StatCards stats={stats} />

            <section className={`${cardCls} p-5 sm:p-6`}>
                <UsersToolbar
                    searchInput={searchInput}
                    onSearchChange={setSearchInput}
                    status={status}
                    onStatusChange={(value) => {
                        setStatus(value);
                        setPage(1);
                    }}
                    stats={stats}
                />

                {error && !loading && <UsersError message={error} onRetry={() => refetch()} />}

                {loading && <UsersSkeleton />}

                {!loading && !error && users.length === 0 && (
                    <UsersEmpty hasFilters={hasFilters} onClear={clearFilters} />
                )}

                {!loading && !error && users.length > 0 && (
                    <>
                        <UsersTable users={users} isSuperAdmin={isSuperAdmin} onAction={openDialog} />
                        <UsersMobileList users={users} isSuperAdmin={isSuperAdmin} onAction={openDialog} />
                        <Pagination
                            pagination={pagination}
                            onPrev={() => setPage((p) => Math.max(1, p - 1))}
                            onNext={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                        />
                    </>
                )}
            </section>

            {dialog && (
                <ConfirmDialog
                    dialog={dialog}
                    reason={reason}
                    onReasonChange={setReason}
                    error={dialogError}
                    busy={busy}
                    onClose={closeDialog}
                    onConfirm={confirmDialog}
                />
            )}
        </div>
    );
}
