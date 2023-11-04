# Resizer

Utility that simplifies the use of the [Image Resizing](https://developers.cloudflare.com/images/image-resizing/) API. Requires a bit of setup, and **is not free**.

## Setup

1. Have a Zone that is Pro+, and has Image Resizing enabled.
2. Create an R2 bucket, or a "directory"(R2 doesn't really have a concept of a directory, but in this case you can think of it as a filename prefix) to store your images in temporarily. This bucket/directory should not be shared with anything else.
3. Create a [Custom Domain](https://developers.cloudflare.com/r2/buckets/public-buckets//#custom-domains) for your bucket.
   The following steps are _optional_:
4. Create a firewall rule that blocks all incoming request not from your Workers. You can use `cf.worker.upstream_zone` to match agains any domains you posses.
5. Set up a [Lifecycle](https://developers.cloudflare.com/r2/buckets/object-lifecycles/#configure-a-buckets-lifecycle-policy) rule to automatically clear old images out of your bucket/directory. While `Resizer` should do this itself, this will ensure that you aren't billed if a request ends up failing.

## Usage

```ts
import { resizeImage } from "flareutils";

// ...
const resizedImage = await resizeImage(imageStreamFromUser, {
	contentType: "image/png",
	transformOpts: {
		format: "avif",
		quality: 70,
		blur: 100,
	},
	storage: {
		bucket: env.R2,
		url: "https://r2.mysite.dev",
		prefix: "temp",
	},
});
// ...
```
