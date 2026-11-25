import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
});

const MAX_DOCUMENT_SIZE = 5 * 1024 * 1024;
const allowedTypes = new Set([
    "application/pdf",
    "image/jpeg",
    "image/png",
]);

export class VendorDocumentValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "VendorDocumentValidationError";
    }
}

export function getVendorDocumentFile(formData: FormData): File {
    const entry = formData.get("document");
    if (!(entry instanceof File)) {
        throw new VendorDocumentValidationError(
            "Choose a GST registration document to upload"
        );
    }
    return entry;
}

export async function getVendorDocumentFormat(file: File): Promise<string> {
    if (!allowedTypes.has(file.type)) {
        throw new VendorDocumentValidationError(
            "Only PDF, JPEG, and PNG documents are allowed"
        );
    }
    if (file.size === 0 || file.size > MAX_DOCUMENT_SIZE) {
        throw new VendorDocumentValidationError(
            "Document size must be between 1 byte and 5 MB"
        );
    }

    const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    const isPdf =
        file.type === "application/pdf" &&
        String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
    const isJpeg =
        file.type === "image/jpeg" &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff;
    const isPng =
        file.type === "image/png" &&
        bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a;

    if (isPdf) return "pdf";
    if (isJpeg) return "jpg";
    if (isPng) return "png";
    throw new VendorDocumentValidationError(
        "Document contents do not match the selected file type"
    );
}

export async function uploadVendorGstDocument(
    file: File,
    vendorId: string
): Promise<{ publicId: string; format: string }> {
    const format = await getVendorDocumentFormat(file);
    const buffer = Buffer.from(await file.arrayBuffer());

    const uploaded = await new Promise<{ public_id: string }>(
        (resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    folder: `aiecommerce/vendor-business/${vendorId}`,
                    resource_type: "raw",
                    type: "private",
                    unique_filename: true,
                    overwrite: false,
                    format,
                },
                (error, result) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    if (!result) {
                        reject(new Error("Cloudinary returned no uploaded file"));
                        return;
                    }
                    resolve({ public_id: result.public_id });
                }
            );
            stream.end(buffer);
        }
    );

    return { publicId: uploaded.public_id, format };
}

export async function deleteVendorGstDocument(publicId: string): Promise<void> {
    const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: "raw",
        type: "private",
        invalidate: true,
    });

    if (result.result !== "ok" && result.result !== "not found") {
        throw new Error("Cloudinary did not delete the private GST document");
    }
}

export function createVendorGstDocumentReviewUrl(
    publicId: string,
    format: string
): string {
    return cloudinary.utils.private_download_url(publicId, format, {
        resource_type: "raw",
        type: "private",
        expires_at: Math.floor(Date.now() / 1000) + 5 * 60,
        attachment: false,
    });
}
