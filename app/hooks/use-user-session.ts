// FILE: app/hooks/use-user-session.ts

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/app/lib/axios";

const USER_PROFILE_ENDPOINT = "/api/auth/user/profile";
const USER_LOGOUT_ENDPOINT = "/api/auth/user/logout";
const LOGIN_PATH = "/user/auth-user";

export interface UserI {
    id: string;
    name: string | null;
    email: string | null;
    mobileNo: string | null;
}

interface HttpErrorLike {
    response?: {
        status?: number;
    };
}

export function useUserSession() {
    const router = useRouter();
    const queryClient = useQueryClient();

    // 1. Get logged-in user
    const query = useQuery({
        queryKey: ["user-profile"],
        queryFn: async () => {
            const res = await api.get(USER_PROFILE_ENDPOINT);
            return res.data;
        },
        retry: false,
        staleTime: 5 * 60 * 1000,
    });

    // 2. Redirect if unauthorized
    // const status = (query.error as HttpErrorLike | null)?.response?.status;

    // useEffect(() => {
    //     if (status === 401) {
    //         router.replace(LOGIN_PATH);
    //     }
    // }, [status, router]);

    // 3. Logout
    const logoutMutation = useMutation({
        mutationFn: async () => {
            const response = await api.post(USER_LOGOUT_ENDPOINT);
            return response.data;
        },

        onSuccess: () => {
            // Clear localStorage
            localStorage.removeItem("user_token");
            localStorage.removeItem("user_id");

            // Clear React Query cache
            queryClient.clear();

            // Redirect to login
            router.replace(LOGIN_PATH);
            router.refresh();
        },
    });

    // 4. Extract authenticated user
    const authUser: UserI | undefined = query.data?.user;

    return {
        authUser,
        isLoading: query.isLoading,
        isError: query.isError,
        logout: () => logoutMutation.mutate(),
        isLoggingOut: logoutMutation.isPending,
        logoutError: logoutMutation.error,
    };
}
