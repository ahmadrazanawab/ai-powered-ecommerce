import assert from "node:assert/strict";
import test from "node:test";

import {
    parseProductImageManifest,
    resolveProductImages,
    sortProductImages,
    type ProductImage,
} from "../app/lib/product-images";
import {
    getProductImageFileError,
    hasValidProductImageSignature,
} from "../app/lib/product-image-validation";

const adminImage = (
    id: string,
    sortOrder: number,
    isPrimary: boolean
): ProductImage => ({
    id,
    url: `https://res.cloudinary.com/demo/${id}.jpg`,
    sortOrder,
    isPrimary,
});

test("vendor images completely replace the admin gallery", () => {
    const vendor = [adminImage("vendor-primary", 1, true)];
    const admin = [
        adminImage("admin-primary", 0, true),
        adminImage("admin-secondary", 1, false),
    ];

    assert.deepEqual(resolveProductImages(vendor, admin), vendor);
});

test("missing or removed vendor images fall back to the full admin gallery", () => {
    const admin = [
        adminImage("admin-secondary", 1, false),
        adminImage("admin-primary", 0, true),
    ];

    assert.deepEqual(resolveProductImages([], admin), [
        admin[1],
        admin[0],
    ]);
});

test("admin-only and image-less products have stable fallbacks", () => {
    const admin = [adminImage("admin-primary", 0, true)];

    assert.deepEqual(resolveProductImages([], admin), admin);
    assert.deepEqual(resolveProductImages([], []), []);
    assert.equal(
        resolveProductImages([], [], "https://example.test/legacy.jpg")[0]
            ?.url,
        "https://example.test/legacy.jpg"
    );
});

test("primary image sorts before the configured display order", () => {
    const images = [
        adminImage("secondary", 0, false),
        adminImage("primary", 2, true),
        adminImage("third", 1, false),
    ];

    assert.deepEqual(
        sortProductImages(images).map((image) => image.id),
        ["primary", "secondary", "third"]
    );
});

test("image manifest accepts ordered existing and uploaded images", () => {
    const existingId = "f31f6146-4d4a-4b6a-9baa-04c2117ec33c";

    assert.deepEqual(
        parseProductImageManifest(
            JSON.stringify([
                { existingId, isPrimary: true },
                { uploadIndex: 0, isPrimary: false },
            ]),
            1
        ),
        [
            { existingId, isPrimary: true },
            { uploadIndex: 0, isPrimary: false },
        ]
    );
});

test("image manifest rejects missing primaries, duplicate uploads, and over-limit sets", () => {
    assert.throws(() =>
        parseProductImageManifest(
            JSON.stringify([{ uploadIndex: 0, isPrimary: false }]),
            1
        )
    );
    assert.throws(() =>
        parseProductImageManifest(
            JSON.stringify([
                { uploadIndex: 0, isPrimary: true },
                { uploadIndex: 0, isPrimary: false },
            ]),
            1
        )
    );
    assert.throws(() =>
        parseProductImageManifest(
            JSON.stringify(
                Array.from({ length: 6 }, (_, uploadIndex) => ({
                    uploadIndex,
                    isPrimary: uploadIndex === 0,
                }))
            ),
            6
        )
    );
});

test("server-side image checks reject mismatched file contents", async () => {
    const validPng = new File(
        [
            new Uint8Array([
                0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
            ]),
        ],
        "product.png",
        { type: "image/png" }
    );
    const spoofedPng = new File(["not an image"], "product.png", {
        type: "image/png",
    });

    assert.equal(getProductImageFileError(validPng), null);
    assert.equal(await hasValidProductImageSignature(validPng), true);
    assert.equal(await hasValidProductImageSignature(spoofedPng), false);
    assert.match(
        getProductImageFileError(
            new File(["x"], "product.gif", { type: "image/gif" })
        ) ?? "",
        /Only JPEG, PNG, and WebP/
    );
});
