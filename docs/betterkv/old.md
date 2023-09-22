# BetterKV (old)

::: danger NOTE
This version of BetterKV is built for KV v1. If you are using KV v2, please refer to [BetterKV](/betterkv).
:::

A Storage namespace that uses the Cloudflare Workers [KV API](https://developers.cloudflare.com/workers/runtime-apis/kv) to store data, with a [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache) backing that allows you to reduce your KV billable reads.

For the most part, _BetterKV_ should match to the Workers _KVNamespace_ standard, other than how it is instantiated, and all methods(except delete) support cacheTtl. For the _KVNamespace_ API, see the [types](https://github.com/cloudflare/workers-types) supplied by Cloudflare.

## Setup

To instantiate a _BetterKV_ Namespace, you need 3 things:

- The KV Namespace that backs the BetterKV Namespace. You can get this from the `env` object passed to your Worker.
- The `waitUntil` function from the `ctx` object passed to your Worker. This should be bound to the current context before being passed in.
- The Cache Space that BetterKV should use. This is a string that is used to identify the Cache Space that BetterKV should use. This is useful if you have multiple BetterKV Namespaces, and do not to use the same Cache Space for all of them. This parameter is optional.

```ts
import { BetterKV } from "flareutils";

export default <ExportedHandler>{
	async fetch(req, env, ctx) {
		const bKv = new BetterKV(env.KV, ctx.waitUntil.bind(ctx), "cachespace");
		// ...
	},
};
```

::: tip
While a BetterKV Namespace must be initiated during a Request(and not at startup), once it is initiated, it can be hoisted into the global scope and reused. Note though that the `waitUntil` function must be provided fresh every time you process a new request, like so:
:::

```ts
bKv.setWaitUntil(ctx.waitUntil.bind(ctx));
```

## Methods

### get

```ts
const value = await bKv.get("key");
const longer = await bKv.get("key", {
  cacheTtl: 60 * 60 * 24 * 7 // 1 week
});
const buff = await bKv.get("buffer", { type: "buffer" });
const jsonValue = await bKv.get<MyType>("json", {
  cacheTtl: 60 * 60 * 24 * 7 // 1 week,
  type: "json"
});
```

### getWithMetadata

```ts
const { value, metadata, ca } = await bKv.getWithMetadata("key");
const { value: longer, metadata: longerMetadata } = await bKv.getWithMetadata("key", {
  cacheTtl: 60 * 60 * 24 * 7 // 1 week
});
const { value: buff, metadata: buffMetadata } = await bKv.getWithMetadata("buffer", {
  type: "buffer"
});
const { value: jsonValue, metadata: jsonMetadata, cacheStatus } = await bKv.getWithMetadata<MyType>("json", {
  cacheTtl: 60 * 60 * 24 * 7 // 1 week,
  type: "json"
});
```

### put

```ts
await bKv.put("key", "value");
await bKv.put("key", "value", {
	cacheTtl: 60 * 60 * 24, // 1 day
});
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
const { cachedKeys, list_complete } = await bKv.list({
	cacheTtl: 60 * 60 * 24 * 7, // 1 week
});
const { keys, list_complete, cursor } = await bKv.list({
	prefix: "some-prefix",
	limit: 1000,
});
```

### delete

```ts
await bKv.delete("key");
```
