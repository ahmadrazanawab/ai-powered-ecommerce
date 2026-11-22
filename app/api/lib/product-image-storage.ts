import { eq } from "drizzle-orm";

import { uploadImageToCloudinary, default as cloudinary } from "./cloudinary";
import { db } from "./db";
import { productImages } from "./schema/product-image-schema";
import {
    MAX_PRODUCT_IMAGES,
    parseProductImageManifest,
    sortProductImages,
    type ProductImageManifestEntry,
} from "@/app/lib/product-images";
import {
    getProductImageFileError,
    hasValidProductImageSignature,
} from "@/app/lib/product-image-validation";

export interface UploadedProductImage {
    url: string;
    publicId: string;
}

export class ProductImageValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ProductImageValidationError";
    }
}

export class ProductImageStorageError extends Error {
    constructor() {
        super("Could not upload product images. Please try again.");
        this.name = "ProductImageStorageError";
    }
}

type ExistingProductImage = Pick<
    typeof productImages.$inferSelect,
    "id" | "imageUrl" | "publicId" | "sortOrder" | "isPrimary"
>;

type ProductImageOwner =
    | { source: "admin"; productId: string }
    | { source: "vendor"; vendorProductId: string };

export function getProductImageFiles(formData: FormData): File[] {
    const imageEntries = formData.getAll("images");
    const legacyEntries = formData.getAll("image");

    if (imageEntries.length > 0 && legacyEntries.length > 0) {
        throw new ProductImageValidationError(
            "Send images using only one upload field"
        );
    }

    const entries = imageEntries.length > 0 ? imageEntries : legacyEntries;

    return entries.map((entry) => {
        if (!(entry instanceof File)) {
            throw new ProductImageValidationError(
                "Every image upload must be a file"
            );
        }

        return entry;
    });
}

export function prepareProductImageManifest(
    formData: FormData,
    files: File[],
    existingImages: ExistingProductImage[]
): ProductImageManifestEntry[] {
    const rawManifest = formData.get("imageManifest");

    if (rawManifest !== null && typeof rawManifest !== "string") {
        throw new ProductImageValidationError("Image order is invalid");
    }

    let manifest: ProductImageManifestEntry[];

    try {
        const parsed = parseProductImageManifest(rawManifest, files.length);

        if (parsed) {
            manifest = parsed;
        } else {
            const existing = sortProductImages(
                existingImages.map((image) => ({
                    id: image.id,
                    url: image.imageUrl,
                    sortOrder: image.sortOrder,
                    isPrimary: image.isPrimary,
                }))
            );

            if (existing.length + files.length > MAX_PRODUCT_IMAGES) {
                throw new Error(
                    `Choose no more than ${MAX_PRODUCT_IMAGES} images`
                );
            }

            manifest = [
                ...existing.map((image) => ({
                    existingId: image.id,
                    isPrimary: image.isPrimary,
                })),
                ...files.map((_, uploadIndex) => ({
                    uploadIndex,
                    isPrimary: false,
                })),
            ];

            if (manifest.length > 0 && !manifest.some((item) => item.isPrimary)) {
                manifest[0].isPrimary = true;
            }
        }
    } catch (error) {
        if (error instanceof ProductImageValidationError) {
            throw error;
        }

        throw new ProductImageValidationError(
            error instanceof Error ? error.message : "Image order is invalid"
        );
    }

    const existingIds = new Set(existingImages.map((image) => image.id));

    if (
        manifest.some(
            (entry) =>
                entry.existingId !== undefined &&
                !existingIds.has(entry.existingId)
        )
    ) {
        throw new ProductImageValidationError(
            "One or more selected images do not belong to this product"
        );
    }

    return manifest;
}

export function buildProductImageRows(
    owner: ProductImageOwner,
    manifest: ProductImageManifestEntry[],
    existingImages: ExistingProductImage[],
    uploadedImages: UploadedProductImage[]
) {
    const existingById = new Map(
        existingImages.map((image) => [image.id, image])
    );

    const images = manifest.map((entry, sortOrder) => {
        if (entry.existingId) {
            const image = existingById.get(entry.existingId);

            if (!image) {
                throw new ProductImageValidationError(
                    "One or more selected images do not belong to this product"
                );
            }

            return {
                id: image.id,
                source: owner.source,
                productId:
                    owner.source === "admin" ? owner.productId : null,
                vendorProductId:
                    owner.source === "vendor" ? owner.vendorProductId : null,
                imageUrl: image.imageUrl,
                publicId: image.publicId,
                sortOrder,
                isPrimary: entry.isPrimary,
            };
        }

        if (entry.uploadIndex === undefined) {
            throw new ProductImageValidationError(
                "An uploaded image selection is missing"
            );
        }

        const uploaded = uploadedImages[entry.uploadIndex];

        if (!uploaded) {
            throw new ProductImageValidationError(
                "An uploaded image selection is missing"
            );
        }

        return {
            source: owner.source,
            productId: owner.source === "admin" ? owner.productId : null,
            vendorProductId:
                owner.source === "vendor" ? owner.vendorProductId : null,
            imageUrl: uploaded.url,
            publicId: uploaded.publicId,
            sortOrder,
            isPrimary: entry.isPrimary,
        };
    });

    const keptIds = new Set(
        manifest.flatMap((entry) =>
            entry.existingId ? [entry.existingId] : []
        )
    );
    const removed = existingImages.filter((image) => !keptIds.has(image.id));

    return { images, removed };
}

export async function validateProductImageFiles(
    files: File[]
): Promise<void> {
    if (files.length > MAX_PRODUCT_IMAGES) {
        throw new ProductImageValidationError(
            `Choose no more than ${MAX_PRODUCT_IMAGES} images`
        );
    }

    for (const [index, file] of files.entries()) {
        const error = getProductImageFileError(file);

        if (error) {
            throw new ProductImageValidationError(
                `Image ${index + 1}: ${error}`
            );
        }

        if (!(await hasValidProductImageSignature(file))) {
            throw new ProductImageValidationError(
                `Image ${index + 1} is not a valid JPEG, PNG, or WebP file`
            );
        }
    }
}

export async function deleteCloudinaryImages(
    images: Pick<UploadedProductImage, "publicId">[]
): Promise<void> {
    for (const image of images) {
        try {
            const result = await cloudinary.uploader.destroy(image.publicId, {
                resource_type: "image",
                invalidate: true,
            });

            if (result.result !== "ok" && result.result !== "not found") {
                throw new Error(
                    `Cloudinary returned ${String(result.result)}`
                );
            }
        } catch (error) {
            console.error("CLOUDINARY_IMAGE_CLEANUP_ERROR:", {
                publicId: image.publicId,
                error,
            });
        }
    }
}

export async function uploadProductImageFiles(
    files: File[],
    folder: string
): Promise<UploadedProductImage[]> {
    await validateProductImageFiles(files);

    const uploaded: UploadedProductImage[] = [];

    try {
        for (const file of files) {
            uploaded.push(await uploadImageToCloudinary(file, folder));
        }

        return uploaded;
    } catch (error) {
        console.error("PRODUCT_IMAGE_UPLOAD_ERROR:", error);
        await deleteCloudinaryImages(uploaded);
        throw new ProductImageStorageError();
    }
}

export async function cleanupOrphanedProductImages(
    images: Array<{ publicId: string | null }>
): Promise<void> {
    const checked = new Set<string>();

    for (const image of images) {
        const publicId = image.publicId;

        if (!publicId || checked.has(publicId)) {
            continue;
        }

        checked.add(publicId);

        try {
            const [stillReferenced] = await db
                .select({ id: productImages.id })
                .from(productImages)
                .where(eq(productImages.publicId, publicId))
                .limit(1);

            if (!stillReferenced) {
                await deleteCloudinaryImages([{ publicId }]);
            }
        } catch (error) {
            console.error("PRODUCT_IMAGE_ORPHAN_CLEANUP_ERROR:", {
                publicId,
                error,
            });
        }
    }
}
