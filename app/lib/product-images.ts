export const MAX_PRODUCT_IMAGES = 5;
export const MAX_PRODUCT_IMAGE_SIZE = 5 * 1024 * 1024;
export const PRODUCT_IMAGE_TYPES = [
    "image/jpeg",
    "image/png",
    "image/webp",
] as const;

export interface ProductImage {
    id: string;
    url: string;
    sortOrder: number;
    isPrimary: boolean;
}

export type ProductImageManifestEntry =
    | { existingId: string; isPrimary: boolean; uploadIndex?: never }
    | { uploadIndex: number; isPrimary: boolean; existingId?: never };

const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function sortProductImages<T extends ProductImage>(images: T[]): T[] {
    return [...images].sort(
        (a, b) =>
            Number(b.isPrimary) - Number(a.isPrimary) ||
            a.sortOrder - b.sortOrder
    );
}

export function resolveProductImages(
    vendorImages: ProductImage[],
    adminImages: ProductImage[],
    legacyImageUrl: string | null = null
): ProductImage[] {
    const selected = vendorImages.length > 0 ? vendorImages : adminImages;

    if (selected.length > 0) {
        return sortProductImages(selected);
    }

    return legacyImageUrl
        ? [
              {
                  id: "legacy-product-image",
                  url: legacyImageUrl,
                  sortOrder: 0,
                  isPrimary: true,
              },
          ]
        : [];
}

export function parseProductImageManifest(
    raw: string | null,
    uploadCount: number
): ProductImageManifestEntry[] | null {
    if (raw === null) {
        return null;
    }

    let value: unknown;

    try {
        value = JSON.parse(raw);
    } catch {
        throw new Error("Image order is invalid");
    }

    if (!Array.isArray(value) || value.length > MAX_PRODUCT_IMAGES) {
        throw new Error(`Choose no more than ${MAX_PRODUCT_IMAGES} images`);
    }

    const manifest: ProductImageManifestEntry[] = [];
    const existingIds = new Set<string>();
    const uploadIndexes = new Set<number>();

    for (const entry of value) {
        if (
            typeof entry !== "object" ||
            entry === null ||
            Array.isArray(entry)
        ) {
            throw new Error("Image order is invalid");
        }

        const candidate = entry as Record<string, unknown>;

        if (typeof candidate.isPrimary !== "boolean") {
            throw new Error("Image order is invalid");
        }

        const hasExistingId = Object.hasOwn(candidate, "existingId");
        const hasUploadIndex = Object.hasOwn(candidate, "uploadIndex");

        if (hasExistingId === hasUploadIndex) {
            throw new Error("Image order is invalid");
        }

        if (hasExistingId) {
            if (
                typeof candidate.existingId !== "string" ||
                !uuidPattern.test(candidate.existingId) ||
                existingIds.has(candidate.existingId)
            ) {
                throw new Error("An existing image selection is invalid");
            }

            existingIds.add(candidate.existingId);
            manifest.push({
                existingId: candidate.existingId,
                isPrimary: candidate.isPrimary,
            });
            continue;
        }

        if (
            typeof candidate.uploadIndex !== "number" ||
            !Number.isInteger(candidate.uploadIndex) ||
            candidate.uploadIndex < 0 ||
            candidate.uploadIndex >= uploadCount ||
            uploadIndexes.has(candidate.uploadIndex)
        ) {
            throw new Error("An uploaded image selection is invalid");
        }

        uploadIndexes.add(candidate.uploadIndex);
        manifest.push({
            uploadIndex: candidate.uploadIndex,
            isPrimary: candidate.isPrimary,
        });
    }

    if (
        uploadIndexes.size !== uploadCount ||
        manifest.some(
            (entry) =>
                entry.uploadIndex !== undefined &&
                !uploadIndexes.has(entry.uploadIndex)
        )
    ) {
        throw new Error("Image order does not match the uploaded files");
    }

    const primaryCount = manifest.filter((entry) => entry.isPrimary).length;

    if (
        (manifest.length === 0 && primaryCount !== 0) ||
        (manifest.length > 0 && primaryCount !== 1)
    ) {
        throw new Error("Select exactly one primary image");
    }

    return manifest;
}
