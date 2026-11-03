// FILE: app/hooks/use-vendor-session.ts

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/app/lib/axios";

const VENDOR_ME_ENDPOINT = "/api/auth/vendor/me";
const VENDOR_LOGOUT_ENDPOINT = "/api/auth/vendor/logout";
const LOGIN_PATH = "/vendor/login";

export interface VendorI {
    vendorId?: string;
    name?: string;
    email?: string;
    isActive?: boolean;
    status?: string;
}
interface HttpErrorLike {
    response?: {
        status?: number;
    };
}

export function useVendorSession() {
    const router = useRouter();
    const queryClient = useQueryClient();

    // Get logged-in vendor
    const query = useQuery({
        queryKey: ["vendor-me"],
        queryFn: async () => (
            await api.get(VENDOR_ME_ENDPOINT)).data,
        retry: false,
        staleTime: 5 * 60 * 1000,
    });

    // Redirect if unauthorized
    const status = (query.error as HttpErrorLike | null)?.response?.status;

    useEffect(() => {
        if (status === 401) {
            router.replace(LOGIN_PATH);
        }
    }, [status, router]);

    // Logout
    const logoutMutation = useMutation({
        mutationFn: async () => {
            const response = await api.post(VENDOR_LOGOUT_ENDPOINT);
            return response.data;
        },

        onSuccess: () => {
            // Clear localStorage
            localStorage.removeItem("vendor_token");
            localStorage.removeItem("vendor_id");
            localStorage.removeItem("vendor_email");
            localStorage.removeItem("isActive_vendor");

            // Clear React Query cache
            queryClient.clear();

            // Redirect to login
            router.replace(LOGIN_PATH);
            router.refresh();
        },
    });

    const vendor: VendorI | undefined = query.data?.data;

    // console.log("fetch details vendor:- ", vendor);

    return {
        vendor,
        isPending: query.isPending,
        isError: query.isError,
        logout: () => logoutMutation.mutate(),
        isLoggingOut: logoutMutation.isPending,
        logoutError: logoutMutation.error,
    };
}

