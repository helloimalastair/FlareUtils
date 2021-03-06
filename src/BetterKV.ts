export declare type BetterKVGetReturns<V = any> = string | V | ArrayBuffer | ReadableStream;

export declare interface BetterKVTypedGetOptions<L extends string> {
  type: L;
  cacheTtl?: number;
}

export declare interface BetterKVGetOptions {
  type?: BetterKVTypeOptions;
  cacheTtl?: number;
}

export declare interface BetterKVWithMetadata<V, M> {
  value: V | null;
  metadata: M | null;
}

export declare interface BetterKVPutOptions<K = any> {
  expiration?: number;
  expirationTtl?: number;
  metadata?: K | null;
  cacheTtl?: number;
}

export declare interface BetterKVListOptions extends KVNamespaceListOptions {
  cacheTtl?: number;
}

export declare type BetterKVTypeOptions = "text" | "json" | "arrayBuffer" | "stream";
export declare type BetterKVValueOptions = string | ArrayBuffer | ArrayBufferView | ReadableStream;

function normalizeCacheTtl(cacheTtl?: number) : number {
  if(!cacheTtl || cacheTtl <= 60) return 60;
  return cacheTtl;
}

/**
 * A Storage namespace that uses the Cloudflare Workers [KV API](https://developers.cloudflare.com/workers/runtime-apis/kv) to store data, with a [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache) backing that allows you to reduce your KV billable reads.
 * 
 * For the most part, *BetterKV* should match to the Workers *KVNamespace* standard, other than how it is instantiated, and all methods(except delete) support cacheTtl. For the *KVNamespace* API, see the [types](https://github.com/cloudflare/workers-types) supplied by Cloudflare.
 */
export class BetterKV {
  /**
   * Base URL used by BetterKV in Cache Operations.
   */
  private readonly url: string = "https://better.kv/";
  /**
   * Root KV instance utilized by BetterKV.
   */
  private readonly kv: KVNamespace<string>;
  /**
   * Utilized to ensure that any operations performed on the cache do not block the main thread.
   */
  private waitUntil: ExecutionContext["waitUntil"];
  /**
   * Cache instance utilized by BetterKV.
   */
  private cache: Cache | undefined;
  /**
   * Can be used to check whether the custom cache has been warmed up. If it is not false, use await on it to wait for the cache to be warmed up.
   */
  warmingCache: Promise<void> | false;

  /**
   * Creates a new BetterKV instance.
   * @param {KVNamespace} kv The KV Namespace to use as the primary data store.
   * @param {ExecutionContext["waitUntil"]} waitUntil The waitUntil function used to asyncronously update the cache. Must be passed in before executing any other methods on every new request.
   * @param {string} cacheSpace The name utilized to create a dedicated cache for this BetterKV instance. If you have multiple instances of BetterKV running in parallel, make sure each has their own unique cacheSpace.
   * @example ```ts
   * const NAMESPACE = new BetterKV(env.KV, "BetterKVNamespace");
   * ```
   */
  constructor(kv: KVNamespace, waitUntil: ExecutionContext["waitUntil"], cacheSpace?: string) {
    this.kv = kv;
    this.waitUntil = waitUntil;
    this.warmingCache = this.startCache(cacheSpace ?? "BetterKV");
  }

  /**
   * Instantiates a BetterKV Cache Instance. Asynchronous function, run at the beginning of every publicly exposed function.
   * @param {string} cacheSpace The name utilized to create a dedicated cache for this BetterKV instance. If you have multiple instances of BetterKV running in parallel, make sure each has their own unique cacheSpace.
   * @private
  */
  private async startCache(cacheSpace: string) : Promise<void> {
    this.cache = await caches.open(cacheSpace);
    this.warmingCache = false;
  }

  /**
   * Used to update the waitUntil function to the ExecutionContext of the currently executing request. Should be passed in before executing any other methods on every new request.
   * @param {ExecutionContext["waitUntil"]} waitUntil The waitUntil function used to asyncronously update the cache.
  */
  setWaitUntil(waitUntil: ExecutionContext["waitUntil"]) : void {
    this.waitUntil = waitUntil;
  }

  /* Typed KV Get Responses */
  async get(key: string, options: BetterKVGetOptions): Promise<string | null>;
  async get(key: string, options: BetterKVTypedGetOptions<"text">): Promise<string | null>;
  async get(key: string, options: BetterKVTypedGetOptions<"arrayBuffer">): Promise<ArrayBuffer | null>;
  async get(key: string, options: BetterKVTypedGetOptions<"stream">): Promise<ReadableStream | null>;
  async get<V = any>(key: string, options: BetterKVTypedGetOptions<"json">): Promise<V | null>;

  /**
   * Retrieves a value from the BetterKV Namespace.
   * @template K The type of the value. Only used if using the "json" type.
   * @param {string} key The key to retrieve.
   * @param {BetterKVGetOptions} options Options for the retrieval.
   * @returns {Promise<BetterKVGetReturns | null>} The value of the key, or null if the key does not exist.
   * @example ```ts
   * const value = await NAMESPACE.get(key);
   * ```
   */
  async get<V = any>(key: string, options?: BetterKVGetOptions): Promise<BetterKVGetReturns | null> {
    const cacheKey = this.url + key,
      cacheTTL = normalizeCacheTtl(options?.cacheTtl),
      type = options?.type || "text",
      headers = new Headers({ "Cloudflare-CDN-Cache-Control": `max-age=${cacheTTL}` });
    let bodyVal = await this.cache?.match(cacheKey);

    if(bodyVal) {
      if(options && options.cacheTtl) {
        bodyVal = new Response(bodyVal.body, bodyVal);
        bodyVal.headers.set("Cloudflare-CDN-Cache-Control", `max-age=${cacheTTL}`);
        this.waitUntil(this.cache?.put(cacheKey, bodyVal) ?? Promise.resolve());
      }
      switch(options?.type) {
        case "json":
          return await bodyVal.json() as V;
        case "arrayBuffer":
          return await bodyVal.arrayBuffer();
        case "stream":
          return bodyVal.body;
        default:
          return await bodyVal.text();
      }
    }
    switch(type) {
      case "text":
        const textVal = await this.kv.get(key, { type: "text" }) as string | undefined;
        if(!textVal) return null;
        this.waitUntil(this.cache?.put(cacheKey, new Response(textVal, {headers})) ?? Promise.resolve());
        return textVal; 
      case "json":
        const jsonVal = await this.kv.get<V>(key, { type: "json" });
        if(!jsonVal) return null;
        this.waitUntil(this.cache?.put(cacheKey, new Response(JSON.stringify(jsonVal), {headers})) ?? Promise.resolve());
        return jsonVal;
      case "arrayBuffer":
        const bufVal = await this.kv.get(key, { type: "arrayBuffer" }) as ArrayBuffer | undefined;
        if(!bufVal) return null;
        this.waitUntil(this.cache?.put(cacheKey, new Response(bufVal, {headers})) ?? Promise.resolve());
        return bufVal;
      case "stream":
        const streamVal = await this.kv.get(key, { type: "stream" }) as ReadableStream | undefined;
        if(!streamVal) return null;
        this.waitUntil(this.cache?.put(cacheKey, new Response(streamVal, {headers})) ?? Promise.resolve());
        return streamVal;
    }
  }


  /* Typed KV Get(with Metadata) Responses */
  async getWithMetadata<M = any>(key: string, options: BetterKVGetOptions): Promise<BetterKVWithMetadata<string, M> | null>;
  async getWithMetadata<M = any>(key: string, options: BetterKVTypedGetOptions<"text">): Promise<BetterKVWithMetadata<string, M> | null>;
  async getWithMetadata<M = any>(key: string, options: BetterKVTypedGetOptions<"arrayBuffer">): Promise<BetterKVWithMetadata<ArrayBuffer, M> | null>;
  async getWithMetadata<M = any>(key: string, options: BetterKVTypedGetOptions<"stream">): Promise<BetterKVWithMetadata<ReadableStream, M> | null>;
  async getWithMetadata<V = any, M = any>(key: string, options: BetterKVTypedGetOptions<"json">): Promise<BetterKVWithMetadata<V, M> | null>;

  /**
   * Retrieves a value from the BetterKV Namespace, and its associated metadata, if provided.
   * @template V The type of the value. Only used if using the "json" type.
   * @template M The type of the metadata.
   * @param {string} key The key to retrieve.
   * @param {BetterKVGetOptions} options Options for the retrieval.
   * @returns {Promise<BetterKVWithMetadata<BetterKVGetReturns, M> | null>} The value of the key, and its associated metadata(if any), or null if the key does not exist.
  */
  /*
  Promise<
  {
    value: string | V | ArrayBuffer | ReadableStream;
    metadata: M;
  }
  |
  null
  >
  */
  async getWithMetadata<V = any, M = any>(key: string, options?: BetterKVGetOptions): Promise<BetterKVWithMetadata<BetterKVGetReturns, M> | null> {
    const cacheKey = this.url + key,
      cacheTTL = normalizeCacheTtl(options?.cacheTtl),
      type = options?.type || "text";
    let bodyVal = await this.cache?.match(cacheKey);;

    if(bodyVal) {
      if(options && options.cacheTtl) {
        bodyVal = new Response(bodyVal.body, bodyVal);
        bodyVal.headers.set("Cloudflare-CDN-Cache-Control", `max-age=${cacheTTL}`);
        this.waitUntil(this.cache?.put(cacheKey, bodyVal) ?? Promise.resolve());
      }
      const metadata = JSON.parse(bodyVal.headers.get("metadata") as string) as M;
      switch(options?.type) {
        case "json":
          return {
            value: await bodyVal.json() as any,
            metadata
          };
        case "arrayBuffer":
          return {
            value: await bodyVal.arrayBuffer(),
            metadata
          };
        case "stream":
          return {
            value: bodyVal.body,
            metadata
          };
        default:
          return {
            value: await bodyVal.text(),
            metadata
          };
      }
    }
    const headers = new Headers({ "Cloudflare-CDN-Cache-Control": `max-age=${cacheTTL}` });
    switch(type) {
      case "text":
        const textVal = await this.kv.getWithMetadata<M>(key);
        if(!textVal) return null;
        if(textVal.metadata) headers.set("metadata", JSON.stringify(textVal.metadata));
        this.waitUntil(this.cache?.put(cacheKey, new Response(textVal.value, {headers})) ?? Promise.resolve());
        return textVal; 
      case "json":
        const jsonVal = await this.kv.getWithMetadata<V, M>(key, { type: "json" });
        if(!jsonVal) return null;
        if(jsonVal.metadata) headers.set("metadata", JSON.stringify(jsonVal.metadata));
        this.waitUntil(this.cache?.put(cacheKey, new Response(JSON.stringify(jsonVal), {headers})) ?? Promise.resolve());
        return jsonVal;
      case "arrayBuffer":
        const bufVal = await this.kv.getWithMetadata<M>(key, { type: "arrayBuffer" });
        if(!bufVal) return null;
        if(bufVal.metadata) headers.set("metadata", JSON.stringify(bufVal.metadata));
        this.waitUntil(this.cache?.put(cacheKey, new Response(bufVal.value, {headers})) ?? Promise.resolve());
        return bufVal;
      case "stream":
        const streamVal = await this.kv.getWithMetadata<M>(key, { type: "stream" });
        if(!streamVal) return null;
        if(streamVal.metadata) headers.set("metadata", JSON.stringify(streamVal.metadata));
        this.waitUntil(this.cache?.put(cacheKey, new Response(streamVal.value, {headers})) ?? Promise.resolve());
        return streamVal;
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
  async put<M = any>(key: string, val: BetterKVValueOptions, options: BetterKVPutOptions<M>): Promise<void> {
    const cacheKey = this.url + key;
    let { cacheTtl, ...putOptions } = options;
    cacheTtl = normalizeCacheTtl(cacheTtl);
    const headers = new Headers({ "Cloudflare-CDN-Cache-Control": `max-age=${cacheTtl}` });
    if(putOptions.metadata) headers.set("metadata", JSON.stringify(putOptions.metadata));
    if(typeof val === "string" || val instanceof ArrayBuffer) {
      this.waitUntil(this.cache?.put(cacheKey, new Response(val, {headers})) ?? Promise.resolve());
      await this.kv.put(key, val, putOptions);
      return;
    }
    if(val instanceof ReadableStream) {
      const a = val.tee();
      this.waitUntil(this.cache?.put(cacheKey, new Response(a[0], {headers})) ?? Promise.resolve());
      await this.kv.put(key, a[1], putOptions);
      return;
    }
    if(typeof val !== "object") throw new Error("Invalid Put Type");
    this.waitUntil(this.cache?.put(cacheKey, new Response(JSON.stringify(val), {headers})) ?? Promise.resolve());
    await this.kv.put(key, val, putOptions);
  }

  /**
   * Removes a value from the BetterKV Namespace.
   * @param {string} key The key to remove.
   * @example ```ts
   * await NAMESPACE.delete(key);
   * ```
   */
  async delete(key: string): Promise<void> {
    this.waitUntil(this.cache?.delete(this.url + key) ?? Promise.resolve());
    await this.kv.delete(key);
  }

  /**
   * Lists keys in the BetterKV Namespace according to the options given. Supports CacheTtl.
   * @template M The type of the metadata.
   * @param {BetterKVListOptions} [options] Options for the listing.
   * @returns {Promise<BetterKVListReturns<M>>} The keys in the namespace, and their associated metadata(if any).
   * @example ```ts
   * const {keys, list_complete, cursor} = await NAMESPACE.list();
   * ```
   */
  async list<M = any>(opts?: BetterKVListOptions): Promise<KVNamespaceListResult<M>> {
    let prefix = opts?.prefix, limit = opts?.limit, cursor = opts?.cursor,
      cacheKey = new URL("https://list.better.kv");
    let cacheTtl = normalizeCacheTtl(opts?.cacheTtl);
    if(limit && (limit < 1 || limit > 1000)) limit = 1000;
    if(prefix) cacheKey.searchParams.set("prefix", prefix);
    if(limit) cacheKey.searchParams.set("limit", limit.toString());
    if(cursor) cacheKey.searchParams.append("cursor", cursor);

    let bodyVal = await this.cache?.match(cacheKey.toString());

    if(bodyVal) {
      if(cacheTtl) {
        bodyVal = new Response(bodyVal.body, bodyVal);
        bodyVal.headers.set("Cloudflare-CDN-Cache-Control", `max-age=${cacheTtl}`);
        this.waitUntil(this.cache?.put(cacheKey.toString(), bodyVal) ?? Promise.resolve());
      }
      return await bodyVal.json() as KVNamespaceListResult<any>;
    }
    const result = await this.kv.list<M>({prefix, limit, cursor});
    this.waitUntil(this.cache?.put(cacheKey.toString(), new Response(JSON.stringify(result), {
      headers: { "Cloudflare-CDN-Cache-Control": `max-age=${cacheTtl}` }
    })) ?? Promise.resolve());
    return result;
  }
};