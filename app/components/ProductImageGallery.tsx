"use client";

import { useState } from "react";

import ProductImageDisplay from "./ProductImageDisplay";
import type { ProductImage } from "@/app/lib/product-images";

interface Props {
    images: ProductImage[];
    alt: string;
    badge?: string;
}

export default function ProductImageGallery({ images, alt, badge }: Props) {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const selected =
        images.find((image) => image.id === selectedId) ??
        images.find((image) => image.isPrimary) ??
        images[0];

    return (
        <div className="space-y-3">
            <div className="relative aspect-square overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 to-indigo-900 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.18)] ring-1 ring-slate-200/70">
                <ProductImageDisplay
                    src={selected?.url}
                    alt={alt}
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    priority
                />
                {badge && (
                    <span className="absolute left-4 top-4 rounded-full bg-white/85 px-3 py-1 text-xs font-medium text-slate-700 backdrop-blur">
                        {badge}
                    </span>
                )}
            </div>

            {images.length > 1 && (
                <div
                    className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
                    role="group"
                    aria-label="Product images"
                >
                    {images.map((image, index) => {
                        const active = selected?.id === image.id;

                        return (
                            <button
                                key={`${image.id}-${index}`}
                                type="button"
                                onClick={() => setSelectedId(image.id)}
                                aria-label={`Show image ${index + 1} of ${images.length}`}
                                aria-pressed={active}
                                className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-xl ring-2 transition sm:h-20 sm:w-20 ${
                                    active
                                        ? "ring-amber-400"
                                        : "ring-transparent hover:ring-slate-300"
                                }`}
                            >
                                <ProductImageDisplay
                                    src={image.url}
                                    alt={`${alt} thumbnail ${index + 1}`}
                                    sizes="80px"
                                />
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
