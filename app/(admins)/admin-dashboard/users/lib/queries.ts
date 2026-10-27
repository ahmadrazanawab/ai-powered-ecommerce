import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { api } from "@/app/lib/axios";
import { API_URL, PAGE_SIZE } from "./constants";
import type { DialogType, ListResponse, UsersParams } from "./types";

export const USERS_KEY = ["admin-users"] as const;

export function useUsersQuery({ page, status, search }: UsersParams) {
    return useQuery({
        queryKey: [...USERS_KEY, { page, status, search }],
        queryFn: async () => {
            const { data } = await api.get<ListResponse>(API_URL, {
                params: { page, limit: PAGE_SIZE, status, ...(search ? { search } : {}) },
            });
            if (!data?.success) throw new Error(data?.message ?? "Something went wrong. Try again.");
            return data;
        },
        placeholderData: keepPreviousData, // keeps stats/pagination visible while reloading
        retry: false,
        refetchOnWindowFocus: false,
    });
}

export function useUserAction() {
    return useMutation({
        mutationFn: async (vars: { type: DialogType; userId: string; reason: string }) => {
            const url = `${API_URL}/${vars.userId}`;
            const { data } =
                vars.type === "delete"
                    ? await api.delete(url)
                    : await api.patch(url, { action: vars.type, reason: vars.reason });
            if (!data?.success) throw new Error(data?.message ?? "Something went wrong. Try again.");
            return data;
        },
    });
}