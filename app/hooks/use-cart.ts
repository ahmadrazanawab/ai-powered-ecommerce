// FILE: app/hooks/use-cart.ts
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/app/lib/axios";

export interface AddToCartInput {
    productId: string;
    listingId: string | null; // null = admin product (backend can't add these yet)
    quantity: number;
}

export interface CartItemI {
    cartItemId: string;
    listingId: string;
    quantity: number;
    available: boolean;
    message?: string;
    // missing when the offer was removed
    productId?: string;
    name?: string;
    slug?: string;
    imageUrl?: string | null;
    categoryName?: string;
    vendorId?: string;
    vendorName?: string;
    price?: string | number;
    stock?: number;
    lineTotal?: string;
}

/** Cart contents. Response: { success, data: { items, totalItems, subtotal } } */
export function useCart() {
    return useQuery({
        queryKey: ["cart"],
        queryFn: async () => (await api.get("/api/cart")).data,
        staleTime: 60 * 1000,
        retry: false,
    });
}

export function useAddToCart() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (input: AddToCartInput) =>
            (
                await api.post("/api/cart/items", {
                    listingId: input.listingId,
                    quantity: input.quantity,
                })
            ).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["cart"] });
        },
    });
}

export function useUpdateCartItem() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) =>
            (await api.patch(`/api/cart/items/${itemId}`, { quantity })).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["cart"] });
        },
    });
}

export function useRemoveCartItem() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (itemId: string) =>
            (await api.delete(`/api/cart/items/${itemId}`)).data,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["cart"] });
        },
    });
}

/** Run right before checkout: re-checks stock and current prices. */
export function useValidateCart() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => (await api.post("/api/cart/items/validate")).data,
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ["cart"] });
        },
    });
}


// FILE: app/hooks/use-cart.ts
// "use client";

// import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
// import { api } from "@/app/lib/axios";

// export interface AddToCartInput {
//     productId: string;
//     listingId: string | null; // null = admin product, otherwise the vendor listing
//     quantity: number;
// }

// /** Cart contents. Use it anywhere: header badge, cart page, cart drawer. */
// export function useCart() {
//     return useQuery({
//         queryKey: ["cart"],
//         queryFn: async () => (await api.get("/api/cart")).data,
//         staleTime: 60 * 1000,
//     });
// }

// /** Add an item. The cart query is refreshed automatically on success. */
// export function useAddToCart() {
//     const queryClient = useQueryClient();

//     return useMutation({
//         mutationFn: async (input: AddToCartInput) =>
//             (await api.post("/api/cart", input)).data,
//         onSuccess: () => {
//             queryClient.invalidateQueries({ queryKey: ["cart"] });
//         },
//     });
// }