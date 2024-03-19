# BetterKV

::: danger NOTE
~~This version of BetterKV is built for [KV v2](https://web.archive.org/web/20230629130349/https://blog.cloudflare.com/faster-workers-kv-architecture/).~~ KV v2 is currently being rebuilt, and thus is not available. The new BetterKV should still help you reduce costs while revalidating quicker. If you want to stick with the original BetterKV experience, then please refer to [BetterKV (old)](/betterkv/old).
:::

A Storage namespace that uses the Cloudflare Workers [KV API](https://developers.cloudflare.com/workers/runtime-apis/kv) to store data, with a [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache) backing that allows you to reduce your KV billable reads. Follows the best practices recommended by Cloudflare Engineers, storing data in cache for a short period of time, and exponentially increasing the likelihood it will refresh before the cached value expires.

For the most part, _BetterKV_ should match to the Workers _KVNamespace_ standard, other than how it is instantiated, and all methods(except delete) will be cached according to the configured `cacheTtl`. For the _KVNamespace_ API, see the [types](https://github.com/cloudflare/workers-types) supplied by Cloudflare.

## Setup

To instantiate a _BetterKV_ Namespace, you need 3 things:

- The KV Namespace that backs the BetterKV Namespace. You can get this from the `env` object passed to your Worker.
- The `waitUntil` function from the `ctx` object passed to your Worker. This should be bound to the current context before being passed in.
- The Cache Space that BetterKV should use. This is a string that is used to identify the Cache Space that BetterKV should use. This is useful if you have multiple BetterKV Namespaces, and do not to use the same Cache Space for all of them. This parameter is optional.

```ts
import { BetterKV } from "flareutils";

export default <ExportedHandler>{
	async fetch(req, env, ctx) {
		const bKv = new BetterKV(env.KV, ctx.waitUntil.bind(ctx), {
			cacheSpace: "cachespace",
		});
		// ...
	},
};
```

The BetterKV constructor also supports customizing the way it refreshes values in the background, in the form of the `probabilityGrowth`, `cacheTtl`, and `kvCacheTtl` values. These should not be modified unless you have a specific reason to do so, as they are, by default, set to recommended values.

::: tip
While a BetterKV Namespace must be initiated during a Request(and not at startup), once it is initiated, it can be hoisted into the global scope and reused. Note though that the `waitUntil` function must be provided fresh every time you process a new request, like so:
:::

```ts
bKv.setWaitUntil(ctx.waitUntil.bind(ctx));
```

## Cache Status

The [`getWithMetadata`](/betterkv/#getwithmetadata) and [`list`](/betterkv/#list) methods expose a field labeled `cacheStatus`. This field is a string that can be one of the following:

- If the status is **MISS**, your query hit KV directly, and was subsequently added to the cache.
- If the status was **HIT**, your query was served directly from the cache, saving you some money! Yay for you!
- If the status was **REVALIDATED**, your query was served from cache, but a background revalidation was triggered. This ensures that your data is kept fresh, while still cutting down on the number of billable queries you have. Note that REVALIDATED will only appear with BetterKV, and not BetterKV(old).

## Methods

### get

```ts
const value = await bKv.get("key");
const str = await bKv.get("key", "text"); // Same as the above
const buff = await bKv.get("key", "arrayBuffer");
const stream = await bKv.get("key", "stream");
const json = await bKv.get<MyType>("key", "json");
```

### getWithMetadata

```ts
const { value, metadata, cacheStatus } = await bKv.getWithMetadata("key");
const { buff, buffMetadata, cacheStatus } = await bKv.getWithMetadata(
	"vampireslayr",
	"buffer",
);
const { jsonValue, jsonMetadata, cacheStatus } =
	await bKv.getWithMetadata<MyType>("notxml", "json");
```

### put

```ts
await bKv.put("key", "value");
await bKv.put("stream", readableStream, {
	expirationTtl: 60 * 60 * 24 * 7, // 1 week
});
await bKv.put("buffer", buffer, {
	metadata: {
		some: "data",
	},
});
```

### list

```ts
const { keys } = await bKv.list();
const { keys, list_complete, cursor, cacheStatus } = await bKv.list({
	prefix: "some-prefix",
	limit: 1000,
});
```

### delete

```ts
await bKv.delete("key");
```
