import { asc, desc, inArray, or } from "drizzle-orm";

import { db } from "./db";
import { productImages } from "./schema/product-image-schema";
import {
    resolveProductImages,
    sortProductImages,
    type ProductImage,
} from "@/app/lib/product-images";

export interface ProductImageGroups {
    adminByProduct: Map<string, ProductImage[]>;
    vendorByListing: Map<string, ProductImage[]>;
}

export async function getProductImageGroups(
    productIds: string[],
    vendorProductIds: string[]
): Promise<ProductImageGroups> {
    const filters = [];

    if (productIds.length > 0) {
        filters.push(inArray(productImages.productId, productIds));
    }

    if (vendorProductIds.length > 0) {
        filters.push(
            inArray(productImages.vendorProductId, vendorProductIds)
        );
    }

    const adminByProduct = new Map<string, ProductImage[]>();
    const vendorByListing = new Map<string, ProductImage[]>();

    if (filters.length === 0) {
        return { adminByProduct, vendorByListing };
    }

    const rows = await db
        .select({
            id: productImages.id,
            productId: productImages.productId,
            vendorProductId: productImages.vendorProductId,
            source: productImages.source,
            url: productImages.imageUrl,
            sortOrder: productImages.sortOrder,
            isPrimary: productImages.isPrimary,
        })
        .from(productImages)
        .where(filters.length === 1 ? filters[0] : or(...filters))
        .orderBy(
            asc(productImages.sortOrder),
            desc(productImages.isPrimary),
            asc(productImages.id)
        );

    for (const row of rows) {
        const image: ProductImage = {
            id: row.id,
            url: row.url,
            sortOrder: row.sortOrder,
            isPrimary: row.isPrimary,
        };
        const group =
            row.source === "admin"
                ? row.productId
                    ? adminByProduct
                    : null
                : row.vendorProductId
                  ? vendorByListing
                  : null;
        const key =
            row.source === "admin" ? row.productId : row.vendorProductId;

        if (!group || !key) {
            continue;
        }

        const images = group.get(key) ?? [];
        images.push(image);
        group.set(key, images);
    }

    for (const [productId, images] of adminByProduct) {
        adminByProduct.set(productId, sortProductImages(images));
    }

    for (const [listingId, images] of vendorByListing) {
        vendorByListing.set(listingId, sortProductImages(images));
    }

    return { adminByProduct, vendorByListing };
}

export function getResolvedProductImages(
    groups: ProductImageGroups,
    productId: string,
    vendorProductId: string | null,
    legacyImageUrl: string | null
): ProductImage[] {
    return resolveProductImages(
        vendorProductId
            ? groups.vendorByListing.get(vendorProductId) ?? []
            : [],
        groups.adminByProduct.get(productId) ?? [],
        legacyImageUrl
    );
}
