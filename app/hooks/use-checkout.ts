// FILE: app/hooks/use-checkout.ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/app/lib/axios";

export interface AddressI {
    id: string;
    fullName: string;
    phone: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
}

export type AddressInput = Omit<AddressI, "id" | "addressLine2"> & {
    addressLine2?: string;
};

export function useAddresses() {
    return useQuery({
        queryKey: ["addresses"],
        queryFn: async () => (await api.get("/api/addresses")).data,
        retry: false,
    });
}

export function useCreateAddress() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: AddressInput) =>
            (await api.post("/api/addresses", input)).data,
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ["addresses"] }),
    });
}

export function useCheckout() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (input: { addressId: string; paymentMethod: "cod" }) =>
            (await api.post("/api/checkout", input)).data,
        onSuccess: () => {
            // cart is emptied and stock changed on the server
            queryClient.invalidateQueries({ queryKey: ["cart"] });
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            queryClient.invalidateQueries({ queryKey: ["products"] });
            queryClient.invalidateQueries({ queryKey: ["product"] });
        },
    });
}