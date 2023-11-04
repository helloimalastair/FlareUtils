import { nanoid } from "nanoid";

const inputFormats = [
	"image/jpeg",
	"image/png",
	"image/gif",
	"image/webp",
	"image/svg+xml",
];
type StreamOrBuffer = ReadableStream | ArrayBuffer;
export interface ResizerConfig<T extends "stream" | "buffer" = "stream"> {
	contentType: (typeof inputFormats)[number];
	transformOpts: Omit<RequestInitCfPropertiesImage, "origin-auth">;
	storage: {
		bucket: R2Bucket;
		url: string;
		prefix?: string;
	};
	returnType: T;
}

/**
 * Resizes an image using Image Resizing.
 * @note Requires manual setup. See https://flareutils.pages.dev/resizer/
 * @param image ReadableStream or ArrayBuffer
 * @param config ResizerConfig
 * @returns Resized image as ReadableStream or ArrayBuffer
 */
async function resizeImage(
	image: StreamOrBuffer,
	config: ResizerConfig<"buffer">,
): Promise<ArrayBuffer>;
async function resizeImage(
	image: StreamOrBuffer,
	config: ResizerConfig<"stream">,
): Promise<ReadableStream>;
async function resizeImage(
	image: StreamOrBuffer,
	config: ResizerConfig<"stream" | "buffer">,
): Promise<StreamOrBuffer> {
	// Prep/validate config
	if (!inputFormats.includes(config.contentType)) {
		throw new Error("Invalid content type");
	}
	const bucket = config.storage.bucket;
	const key = config.storage.prefix + nanoid();
	// Store image in R2
	await bucket.put(key, image, {
		httpMetadata: {
			contentType: config.contentType,
		},
	});
	// Resize image
	const resizedImage = await fetch(`${config.storage.url}/${key}`, {
		cf: {
			image: config.transformOpts,
		},
	});
	if (!(resizedImage.ok && resizedImage.body)) {
		throw {
			status: resizedImage.status,
			message: resizedImage.statusText,
		};
	}
	await bucket.delete(key);
	// Return resized image
	if (config.returnType === "buffer") {
		return resizedImage.arrayBuffer();
	} else {
		return resizedImage.body;
	}
}
export { resizeImage };
