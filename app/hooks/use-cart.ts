// FILE: app/hooks/use-cart.ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/app/lib/axios";

export interface AddToCartInput {
    productId: string;
    listingId: string | null; // null = admin product, otherwise the vendor listing
    quantity: number;
}

/** Cart contents. Use it anywhere: header badge, cart page, cart drawer. */
export function useCart() {
    return useQuery({
        queryKey: ["cart"],
        queryFn: async () => (await api.get("/api/cart")).data,
        staleTime: 60 * 1000,
    });
}

/** Add an item. The cart query is refreshed automatically on success. */
export function useAddToCart() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (input: AddToCartInput) =>
            (await api.post("/api/cart", input)).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["cart"] });
        },
    });
}