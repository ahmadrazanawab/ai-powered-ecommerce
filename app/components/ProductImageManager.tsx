"use client";

import { useEffect, useRef, useState } from "react";

import {
    MAX_PRODUCT_IMAGES,
    type ProductImage,
} from "@/app/lib/product-images";
import { getProductImageFileError } from "@/app/lib/product-image-validation";

export interface ProductImageSelection {
    key: string;
    existingId?: string;
    file?: File;
    url: string;
    isPrimary: boolean;
}

interface Props {
    images: ProductImageSelection[];
    onChange: (images: ProductImageSelection[]) => void;
    uploadProgress?: number | null;
    disabled?: boolean;
}

function existingImageSelection(image: ProductImage): ProductImageSelection {
    return {
        key: image.id,
        existingId: image.id,
        url: image.url,
        isPrimary: image.isPrimary,
    };
}

export { existingImageSelection };

export default function ProductImageManager({
    images,
    onChange,
    uploadProgress = null,
    disabled = false,
}: Props) {
    const fileInput = useRef<HTMLInputElement>(null);
    const previewUrls = useRef(new Map<string, string>());
    const [error, setError] = useState("");

    useEffect(
        () => () => {
            for (const url of previewUrls.current.values()) {
                URL.revokeObjectURL(url);
            }
            previewUrls.current.clear();
        },
        []
    );

    const handleFiles = (selectedFiles: FileList | null) => {
        if (!selectedFiles?.length) return;

        const remaining = MAX_PRODUCT_IMAGES - images.length;

        if (remaining <= 0) {
            setError(`You can add up to ${MAX_PRODUCT_IMAGES} images.`);
            return;
        }

        const additions: ProductImageSelection[] = [];
        let nextError = "";

        for (const file of Array.from(selectedFiles)) {
            const fileError = getProductImageFileError(file);

            if (fileError) {
                nextError ||= fileError;
                continue;
            }

            if (additions.length >= remaining) {
                nextError = `You can add up to ${MAX_PRODUCT_IMAGES} images.`;
                break;
            }

            const key = crypto.randomUUID();
            const url = URL.createObjectURL(file);
            previewUrls.current.set(key, url);
            additions.push({
                key,
                file,
                url,
                isPrimary: images.length === 0 && additions.length === 0,
            });
        }

        if (additions.length > 0) {
            onChange([...images, ...additions]);
        }

        setError(nextError);
    };

    const removeImage = (index: number) => {
        const removed = images[index];

        if (removed) {
            const preview = previewUrls.current.get(removed.key);
            if (preview) URL.revokeObjectURL(preview);
            previewUrls.current.delete(removed.key);
        }

        const next = images.filter((_, currentIndex) => currentIndex !== index);
        if (removed?.isPrimary && next[0]) {
            next[0] = { ...next[0], isPrimary: true };
        }
        onChange(next);
        setError("");
    };

    const moveImage = (index: number, direction: -1 | 1) => {
        const target = index + direction;
        if (target < 0 || target >= images.length) return;

        const next = [...images];
        [next[index], next[target]] = [next[target], next[index]];
        onChange(next);
    };

    const setPrimary = (index: number) => {
        onChange(
            images.map((image, currentIndex) => ({
                ...image,
                isPrimary: currentIndex === index,
            }))
        );
    };

    return (
        <section aria-label="Product images" className="space-y-3">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <h3 className="text-sm font-medium text-slate-700">
                        Product images
                    </h3>
                    <p className="mt-1 text-xs text-slate-500">
                        Choose up to {MAX_PRODUCT_IMAGES}. The primary image is
                        shown first.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    disabled={disabled || images.length >= MAX_PRODUCT_IMAGES}
                    className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    Add images
                </button>
            </div>

            <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
                multiple
                className="hidden"
                disabled={disabled}
                onChange={(event) => {
                    handleFiles(event.currentTarget.files);
                    event.currentTarget.value = "";
                }}
            />

            {images.length > 0 ? (
                <ol className="grid gap-3 sm:grid-cols-2">
                    {images.map((image, index) => (
                        <li
                            key={image.key}
                            className={`flex min-w-0 items-center gap-3 rounded-xl p-2 ring-1 ${
                                image.isPrimary
                                    ? "bg-amber-50/60 ring-amber-300"
                                    : "bg-slate-50 ring-slate-200"
                            }`}
                        >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={image.url}
                                alt={`Product image ${index + 1} preview`}
                                className="h-16 w-16 shrink-0 rounded-lg object-cover"
                            />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium text-slate-700">
                                    {image.isPrimary
                                        ? "Primary image"
                                        : `Image ${index + 1}`}
                                </p>
                                {image.file && (
                                    <p className="truncate text-[11px] text-slate-500">
                                        {image.file.name}
                                    </p>
                                )}
                                <div className="mt-2 flex flex-wrap items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setPrimary(index)}
                                        aria-pressed={image.isPrimary}
                                        disabled={disabled}
                                        className="rounded px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-white"
                                    >
                                        Set primary
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => moveImage(index, -1)}
                                        disabled={disabled || index === 0}
                                        aria-label={`Move image ${index + 1} up`}
                                        className="rounded px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-white disabled:opacity-40"
                                    >
                                        Move up
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => moveImage(index, 1)}
                                        disabled={disabled || index === images.length - 1}
                                        aria-label={`Move image ${index + 1} down`}
                                        className="rounded px-2 py-1 text-[11px] font-medium text-slate-700 hover:bg-white disabled:opacity-40"
                                    >
                                        Move down
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => removeImage(index)}
                                        aria-label={`Remove image ${index + 1}`}
                                        disabled={disabled}
                                        className="rounded px-2 py-1 text-[11px] font-medium text-rose-600 hover:bg-white"
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>
                        </li>
                    ))}
                </ol>
            ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                    No images selected.
                </div>
            )}

            {uploadProgress !== null && (
                <div aria-live="polite">
                    <div className="mb-1 flex justify-between text-xs text-slate-500">
                        <span>Uploading images</span>
                        <span>{Math.round(uploadProgress)}%</span>
                    </div>
                    <progress
                        className="progress progress-primary h-2 w-full"
                        value={uploadProgress}
                        max={100}
                    />
                </div>
            )}

            {error && (
                <p role="alert" className="text-sm text-error">
                    {error}
                </p>
            )}
        </section>
    );
}
