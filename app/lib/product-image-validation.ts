import {
    MAX_PRODUCT_IMAGE_SIZE,
    PRODUCT_IMAGE_TYPES,
} from "./product-images";

export function getProductImageFileError(file: File): string | null {
    if (file.size === 0) {
        return "The selected image is empty.";
    }

    if (!PRODUCT_IMAGE_TYPES.includes(file.type as (typeof PRODUCT_IMAGE_TYPES)[number])) {
        return "Only JPEG, PNG, and WebP images are allowed.";
    }

    if (file.size > MAX_PRODUCT_IMAGE_SIZE) {
        return "Each image must be 5 MB or smaller.";
    }

    return null;
}

export async function hasValidProductImageSignature(
    file: File
): Promise<boolean> {
    const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());

    if (file.type === "image/jpeg") {
        return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    }

    if (file.type === "image/png") {
        return (
            bytes[0] === 0x89 &&
            bytes[1] === 0x50 &&
            bytes[2] === 0x4e &&
            bytes[3] === 0x47 &&
            bytes[4] === 0x0d &&
            bytes[5] === 0x0a &&
            bytes[6] === 0x1a &&
            bytes[7] === 0x0a
        );
    }

    if (file.type === "image/webp") {
        return (
            String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
            String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
        );
    }

    return false;
}
