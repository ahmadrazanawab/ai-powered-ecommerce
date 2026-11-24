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

export interface CartResponseI {
    success: boolean;
    data: {
        items: CartItemI[];
        totalItems: number;
        subtotal: string;
    };
}

/** Cart contents. Response: { success, data: { items, totalItems, subtotal } } */
export function useCart() {
    return useQuery<CartResponseI>({
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
        onMutate: async (itemId) => {
            await queryClient.cancelQueries({ queryKey: ["cart"] });
            const previousCart = queryClient.getQueryData<CartResponseI>(["cart"]);

            queryClient.setQueryData<CartResponseI>(["cart"], (current) => {
                if (!current) return current;

                const items = current.data.items.filter(
                    (item) => item.cartItemId !== itemId
                );

                if (items.length === current.data.items.length) return current;

                return {
                    ...current,
                    data: {
                        ...current.data,
                        items,
                        totalItems: items.reduce(
                            (total, item) =>
                                total + (item.name === undefined ? 0 : item.quantity),
                            0
                        ),
                        subtotal: items
                            .reduce(
                                (total, item) => total + Number(item.lineTotal ?? 0),
                                0
                            )
                            .toFixed(2),
                    },
                };
            });

            return { previousCart };
        },
        onError: (_error, _itemId, context) => {
            if (context?.previousCart) {
                queryClient.setQueryData(["cart"], context.previousCart);
            }
        },
        onSettled: () => {
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