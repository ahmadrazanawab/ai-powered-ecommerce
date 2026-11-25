import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
});

export async function uploadPrivateInvoicePdf(
    invoiceId: string,
    vendorId: string,
    pdf: Buffer
): Promise<string> {
    const result = await new Promise<{ public_id: string }>(
        (resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    folder: `aiecommerce/vendor-invoices/${vendorId}`,
                    public_id: invoiceId,
                    resource_type: "raw",
                    type: "private",
                    format: "pdf",
                    overwrite: true,
                    unique_filename: false,
                },
                (error, uploaded) => {
                    if (error) {
                        reject(error);
                        return;
                    }
                    if (!uploaded) {
                        reject(new Error("Cloudinary returned no invoice asset"));
                        return;
                    }
                    resolve({ public_id: uploaded.public_id });
                }
            );
            stream.end(pdf);
        }
    );
    return result.public_id;
}

export function getPrivateInvoiceDownloadUrl(storageKey: string): string {
    return cloudinary.utils.private_download_url(storageKey, "pdf", {
        resource_type: "raw",
        type: "private",
        expires_at: Math.floor(Date.now() / 1000) + 60,
        attachment: true,
    });
}
