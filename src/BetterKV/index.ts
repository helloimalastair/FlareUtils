import type {
	BetterKVConfig,
	BetterKVGetReturns,
	BetterKVWithMetadata,
	BetterKVPutOptions,
	BetterKVPutValues,
	BetterKVListReturns,
} from "./types";

/**
 * A Storage namespace that uses the Cloudflare Workers [KV API](https://developers.cloudflare.com/workers/runtime-apis/kv) to store data, with a [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache) backing that allows you to reduce your KV billable reads.
 *
 * For the most part, *BetterKV* should match to the Workers *KVNamespace* standard, other than how it is instantiated, and all methods(except delete) will be cached according to the configured `cacheTtl`. For the *KVNamespace* API, see the [types](https://github.com/cloudflare/workers-types) supplied by Cloudflare.
 *
 * @note This version of BetterKV supports KV v2. If you require support for KV v1, please import `BetterKVOld`.
 */
export class BetterKV {
	/**
	 * Base URL used by BetterKV in Cache Operations.
	 * @private
	 */
	private readonly URL: string = "https://better.kv/";
	/**
	 * Root KV instance utilized by BetterKV.
	 * @private
	 */
	private readonly KV: KVNamespace<string>;
	/**
	 * Utilized to ensure that any operations performed on the cache do not block the main thread.
	 * @private
	 */
	private waitUntil: ExecutionContext["waitUntil"];
	/**
	 * The name utilized to create a dedicated cache for this BetterKV instance. If you have multiple instances of BetterKV running in parallel, make sure each has their own unique cacheSpace.
	 * @private
	 */
	private readonly config: BetterKVConfig;
	/**
	 * Cache instance utilized by BetterKV.
	 * @private
	 */
	private cache: Cache | undefined;
	/**
	 * Creates a new BetterKV instance.
	 * @param {KVNamespace} KV The KV Namespace to use as the primary data store.
	 * @param {ExecutionContext["waitUntil"]} waitUntil The waitUntil function used to asyncronously update the cache. Must be passed in before executing any other methods on every new request.
	 * @param {BetterKVConfig} config Configuration for the BetterKV instance.
	 * @example ```ts
	 * const NAMESPACE = new BetterKV(env.KV, ctx.waitUntil);
	 * ```
	 */
	constructor(
		KV: KVNamespace,
		waitUntil: ExecutionContext["waitUntil"],
		config?: Partial<BetterKVConfig>,
	) {
		this.KV = KV;
		this.waitUntil = waitUntil;
		this.config = {
			cacheSpace: undefined,
			probabilityGrowth: 1.28,
			cacheTtl: 50,
			kvCacheTtl: 3.15576e7,
			...config,
		};
	}

	/**
	 * Retrieves the cache instance utilized by BetterKV. Ensures that the cache is only opened once, and can be shared across multiple runs of BetterKV. If no cacheSpace is provided, the default cache is used.
	 * @private
	 */
	private async getCache(): Promise<Cache> {
		if (!this.cache) {
			if (this.config.cacheSpace) {
				this.cache = await caches.open(this.config.cacheSpace);
			} else {
				this.cache = caches.default;
			}
		}
		return this.cache;
	}

	/**
	 * Used to update the waitUntil function to the ExecutionContext of the currently executing request. Should be passed in before executing any other methods on every new request.
	 * @param {ExecutionContext["waitUntil"]} waitUntil The waitUntil function used to asyncronously update the cache.
	 */
	setWaitUntil(waitUntil: ExecutionContext["waitUntil"]): void {
		this.waitUntil = waitUntil;
	}

	/**
	 * Function to handle all GET-ops hitting origin KV. Should not be called manually.
	 * @param {string} key The key to retrieve.
	 * @private
	 */
	private async getFromOrigin<Metadata = unknown>(key: string) {
		const baseHeaders: HeadersInit = {
			"cloudflare-cdn-cache-control": `max-age=${this.config.cacheTtl}`,
			"betterkv-internal-created": Date.now().toString(),
		};
		const { value, metadata } = await this.KV.getWithMetadata<Metadata>(key, {
			type: "stream",
			cacheTtl: this.config.kvCacheTtl,
		});
		if (value === null) return null;
		return {
			res: new Response(value, {
				headers: {
					...baseHeaders,
					"betterkv-internal-meta": metadata ? JSON.stringify(metadata) : "{}",
					"betterkv-internal-created": Date.now().toString(),
				},
			}),
			meta: metadata,
		};
	}

	/**
	 * Retrieves a value from the BetterKV Namespace.
	 * @template JSONValue The type of the value. Only used if using the "json" type.
	 * @param {string} key The key to retrieve.
	 * @param {BetterKVTypeOptions} type Type of value to retrieve.
	 * @returns {Promise<BetterKVGetReturns | null>} The value of the key, or null if the key does not exist.
	 * @example ```ts
	 * const value = await NAMESPACE.get(key);
	 * ```
	 */
	async get(key: string, type?: "text"): Promise<string | null>;
	async get(key: string, type: "arrayBuffer"): Promise<ArrayBuffer | null>;
	async get(key: string, type: "stream"): Promise<ReadableStream | null>;
	async get<JSONValue = unknown>(
		key: string,
		type: "json",
	): Promise<JSONValue | null>;
	async get<JSONValue = unknown>(
		key: string,
		type?: "text" | "arrayBuffer" | "stream" | "json",
	) {
		const cache = await this.getCache();
		const cacheKey = this.URL + key;
		const bodyVal = await cache.match(cacheKey);
		if (bodyVal) {
			const created = Number(bodyVal.headers.get("betterkv-internal-created"));
			const probability = isNaN(created)
				? 1
				: Math.pow(
						this.config.probabilityGrowth,
						Date.now() - created - this.config.cacheTtl,
					);
			if (Math.random() < probability) {
				const a = async () => {
					const newResponse = await this.getFromOrigin(key);
					if (newResponse) {
						await cache.put(cacheKey, newResponse.res);
					} else {
						await cache.delete(cacheKey);
					}
				};
				this.waitUntil(a());
			}
			switch (type) {
				case "json":
					return (await bodyVal.json()) as JSONValue;
				case "arrayBuffer":
					return await bodyVal.arrayBuffer();
				case "stream":
					return bodyVal.body;
				case "text":
				default:
					return await bodyVal.text();
			}
		}
		const originResponse = await this.getFromOrigin<JSONValue>(key);
		if (!originResponse) return null;
		this.waitUntil(cache.put(cacheKey, originResponse.res.clone()));
		switch (type) {
			case "json":
				return originResponse.res.json<JSONValue>();
			case "arrayBuffer":
				return originResponse.res.arrayBuffer();
			case "stream":
				return originResponse.res.body;
			case "text":
			default:
				return originResponse.res.text();
		}
	}

	/**
	 * Retrieves a value from the BetterKV Namespace, and its associated metadata, if provided.
	 * @template JSONValue The type of the value. Only used if using the "json" type.
	 * @template Metadata The type of the metadata.
	 * @param {string} key The key to retrieve.
	 * @param {BetterKVTypeOptions} type Type of value to retrieve.
	 * @returns {Promise<BetterKVWithMetadata<BetterKVGetReturns, M> | null>} The value of the key, and its associated metadata(if any), or null if the key does not exist.
	 */
	async getWithMetadata<Metadata = unknown>(
		key: string,
		type?: "text",
	): Promise<BetterKVWithMetadata<string, Metadata> | null>;
	async getWithMetadata<Metadata = unknown>(
		key: string,
		type: "arrayBuffer",
	): Promise<BetterKVWithMetadata<ArrayBuffer, Metadata> | null>;
	async getWithMetadata<Metadata = unknown>(
		key: string,
		type: "stream",
	): Promise<BetterKVWithMetadata<ReadableStream, Metadata> | null>;
	async getWithMetadata<JSONValue = unknown, Metadata = unknown>(
		key: string,
		type: "json",
	): Promise<BetterKVWithMetadata<JSONValue, Metadata> | null>;
	async getWithMetadata<JSONValue = unknown, Metadata = unknown>(
		key: string,
		type?: "text" | "arrayBuffer" | "stream" | "json",
	): Promise<BetterKVWithMetadata<
		BetterKVGetReturns<JSONValue>,
		Metadata
	> | null> {
		const cache = await this.getCache();
		const cacheKey = this.URL + key;
		const bodyVal = await cache.match(cacheKey);
		if (bodyVal) {
			const created = Number(bodyVal.headers.get("betterkv-internal-created"));
			const probability = isNaN(created)
				? 1
				: Math.pow(
						this.config.probabilityGrowth,
						Date.now() - created - this.config.cacheTtl,
					);
			let revalidated = false;
			if (Math.random() < probability) {
				revalidated = true;
				const a = async () => {
					const newResponse = await this.getFromOrigin(key);
					if (newResponse) {
						await cache.put(cacheKey, newResponse.res);
					} else {
						await cache.delete(cacheKey);
					}
				};
				this.waitUntil(a());
			}
			const rawMeta = bodyVal.headers.get("betterkv-internal-meta");
			const metadata = rawMeta ? JSON.parse(rawMeta) : null;
			switch (type) {
				case "json": {
					return {
						value: await bodyVal.json<JSONValue>(),
						metadata,
						cacheStatus: revalidated ? "REVALIDATED" : "HIT",
					};
				}
				case "arrayBuffer": {
					return {
						value: await bodyVal.arrayBuffer(),
						metadata,
						cacheStatus: revalidated ? "REVALIDATED" : "HIT",
					};
				}
				case "stream": {
					return {
						value: bodyVal.body as ReadableStream,
						metadata,
						cacheStatus: revalidated ? "REVALIDATED" : "HIT",
					};
				}
				case "text":
				default: {
					return {
						value: await bodyVal.text(),
						metadata,
						cacheStatus: revalidated ? "REVALIDATED" : "HIT",
					};
				}
			}
		}
		const originResponse = await this.getFromOrigin<Metadata>(key);
		if (!originResponse) return null;
		this.waitUntil(cache.put(cacheKey, originResponse.res.clone()));
		switch (type) {
			case "json": {
				return {
					value: await originResponse.res.json<JSONValue>(),
					metadata: originResponse.meta,
					cacheStatus: "MISS",
				};
			}
			case "arrayBuffer": {
				return {
					value: await originResponse.res.arrayBuffer(),
					metadata: originResponse.meta,
					cacheStatus: "MISS",
				};
			}
			case "stream": {
				return {
					value: originResponse.res.body as ReadableStream,
					metadata: originResponse.meta,
					cacheStatus: "MISS",
				};
			}
			case "text":
			default: {
				return {
					value: await originResponse.res.text(),
					metadata: originResponse.meta,
					cacheStatus: "MISS",
				};
			}
		}
	}

	/**
	 * Adds a new value to the BetterKV Namespace. Supports CacheTtl.
	 * @param {string} key The key to add.
	 * @param {BetterKVValueOptions} val The value to add. Type is inferred from the value.
	 * @param {BetterKVAddOptions} options Options for the addition.
	 * @example ```ts
	 * await NAMESPACE.put(key, value);
	 * ```
	 */
	async put<Metadata = unknown>(
		key: string,
		val: BetterKVPutValues,
		options?: BetterKVPutOptions<Metadata>,
	): Promise<void> {
		const cache = await this.getCache();
		const cacheKey = this.URL + key;
		let cacheVal: BetterKVPutValues;
		let originVal: BetterKVPutValues;
		if (val instanceof ReadableStream) {
			const teed = val.tee();
			cacheVal = teed[0];
			originVal = teed[1];
		} else {
			cacheVal = originVal = val;
		}
		this.waitUntil(
			cache.put(
				cacheKey,
				new Response(cacheVal, {
					headers: {
						"cloudflare-cdn-cache-control": `max-age=${this.config.cacheTtl}`,
						"betterkv-internal-created": Date.now().toString(),
						"betterkv-internal-meta": options?.metadata
							? JSON.stringify(options.metadata)
							: "{}",
					},
				}),
			),
		);
		await this.KV.put(key, originVal, options);
	}

	/**
	 * Removes a value from the BetterKV Namespace.
	 * @param {string} key The key to remove.
	 * @example ```ts
	 * await NAMESPACE.delete(key);
	 * ```
	 */
	async delete(key: string): Promise<void> {
		const cache = await this.getCache();
		this.waitUntil(cache.delete(this.URL + key));
		await this.KV.delete(key);
	}

	/**
	 * Lists keys in the BetterKV Namespace according to the options given. Supports CacheTtl.
	 * @template M The type of the metadata.
	 * @param {KVNamespaceListOptions} [opts] Options for the listing.
	 * @returns {Promise<BetterKVListReturns<M>>} The keys in the namespace, and their associated metadata(if any).
	 * @example ```ts
	 * const {keys, list_complete, cursor} = await NAMESPACE.list();
	 * ```
	 */
	async list<M = unknown>(
		opts?: KVNamespaceListOptions,
	): Promise<BetterKVListReturns<M>> {
		const cache = await this.getCache();
		const cacheKey = new URL("https://list.better.kv");
		let limit = 1000;
		let prefix: string | null = null;
		let cursor: string | null = null;
		if (opts) {
			if (opts.limit && opts.limit >= 1 && opts.limit < 1000) {
				limit = opts.limit;
			}
			if (opts.prefix) {
				prefix = opts.prefix;
				cacheKey.searchParams.set("prefix", prefix);
			}
			if (opts.limit) {
				limit = opts.limit;
				cacheKey.searchParams.set("limit", limit.toString());
			}
			if (opts.cursor) {
				cursor = opts.cursor;
				cacheKey.searchParams.append("cursor", cursor);
			}
		}
		const bodyVal = await cache.match(cacheKey.toString());
		if (bodyVal) {
			const created = Number(bodyVal.headers.get("betterkv-internal-created"));
			const probability = isNaN(created)
				? 1
				: Math.pow(
						this.config.probabilityGrowth,
						Date.now() - created - this.config.cacheTtl,
					);
			let revalidated = false;
			if (Math.random() < probability) {
				revalidated = true;
				const a = async () => {
					const newResponse = await this.KV.list<M>({ prefix, limit, cursor });
					if (newResponse) {
						await cache.put(
							cacheKey,
							new Response(JSON.stringify(newResponse), {
								headers: {
									"cloudflare-cdn-cache-control": `max-age=${this.config.cacheTtl}`,
								},
							}),
						);
					} else {
						await cache.delete(cacheKey);
					}
				};
				this.waitUntil(a());
			}
			const res = (await bodyVal.json()) as KVNamespaceListResult<M>;
			return {
				...res,
				cacheStatus: revalidated ? "REVALIDATED" : "HIT",
			};
		}
		const result = await this.KV.list<M>({ prefix, limit, cursor });
		this.waitUntil(
			cache.put(
				cacheKey.toString(),
				new Response(JSON.stringify(result), {
					headers: {
						"cloudflare-cdn-cache-control": `max-age=${this.config.cacheTtl}`,
					},
				}),
			),
		);
		return {
			...result,
			cacheStatus: "MISS",
		};
	}
}

export * from "./types";

export { BetterKVOld } from "./old";
