type BetterKVGetReturns<V = unknown> =
	| string
	| V
	| ArrayBuffer
	| ReadableStream;
type BetterKVPutValues =
	| string
	| ArrayBuffer
	| ArrayBufferView
	| ReadableStream;

type BetterKVCacheStatus = "HIT" | "MISS" | "REVALIDATED";

interface BetterKVWithMetadata<V, M> {
	value: V;
	metadata: M | null;
	cacheStatus: BetterKVCacheStatus;
}

interface BetterKVPutOptions<Metadata = unknown> {
	expiration?: number;
	expirationTtl?: number;
	metadata?: Metadata;
}

type BetterKVListReturns<Metadata = unknown> =
	KVNamespaceListResult<Metadata> & {
		cacheStatus: BetterKVCacheStatus;
	};

interface BetterKVConfig {
	/**
	 * The name utilized to create a dedicated cache for this BetterKV instance. If you have multiple instances of BetterKV running in parallel, make sure each has their own unique cacheSpace.
	 */
	cacheSpace: string | undefined;
	/**
	 * The rate at which the probability of BetterKV refetching a cached value increases. Default is 1.28 times per second.
	 * @warning Only modify this value if you know what you're doing.
	 */
	probabilityGrowth: number;
	/**
	 * Time to Live for the fronting Cache. Default is 55 seconds.
	 * @warning Only modify this value if you know what you're doing.
	 */
	cacheTtl: number;
	/**
	 * Time to Live for the back-end KV Cache. Default is 1 year.
	 * @note This value should be greater than the cacheTtl.
	 * @warning Only modify this value if you know what you're doing.
	 */
	kvCacheTtl: number;
}

type BetterKVValueOptions =
	| string
	| ArrayBuffer
	| ArrayBufferView
	| ReadableStream;

export {
	BetterKVGetReturns,
	BetterKVWithMetadata,
	BetterKVPutOptions,
	BetterKVConfig,
	BetterKVValueOptions,
	BetterKVPutValues,
	BetterKVCacheStatus,
	BetterKVListReturns,
};
