// For the most part, BetterKV should stick to the Workers KVNamespace type, other than how it is instantiated, and the fact that all methods(except delete) support cacheTtl. For KV API, see https://developers.cloudflare.com/workers/runtime-apis/kv, and the types this module exports.

function normalizeCacheTtl(cacheTtl?: number) : number {
  if(!cacheTtl || cacheTtl <= 60) return 60;
  return cacheTtl;
}

/**
 * A Storage namespace that uses the Cloudflare Workers KV API to store data, with a Cache API backing that allows you to reduce your KV billable reads.
 */
export class BetterKV {
  private readonly url: string = "https://better.kv/";
  private readonly kv: KVNamespace<string>;
  private waitUntil: ExecutionContext["waitUntil"] | undefined;
  private cacheSpace: string;
  private cache: Cache | undefined;
  warmingCache: Promise<void> | false;

  /**
   * Creates a new BetterKV instance.
   * @param {KVNamespace} kv The KV Namespace to use as the primary data store.
   * @param {ExecutionContext["waitUntil"]} waitUntil The waitUntil function used to asyncronously update the cache. Must be passed in before executing any other methods on every new request.
   * @param {string} cacheSpace The name utilized to create a dedicated cache for this BetterKV instance. If you have multiple instances of BetterKV running in parallel, make sure each has their own unique cacheSpace.
   * @example
   * const NAMESPACE = new BetterKV(env.KV, "BetterKVNamespace");
  */
  constructor(kv: KVNamespace, waitUntil: ExecutionContext["waitUntil"], cacheSpace?: string) {
    this.kv = kv;
    this.waitUntil = waitUntil;
    this.cacheSpace = cacheSpace ?? "BetterKV";
    this.warmingCache = this.startCache();
  }

  /**
   * Instantiates a BetterKV Cache Instance. Asynchronous function, run at the beginning of every publicly exposed function.
   * @private
  */
  private async startCache() : Promise<void> {
    this.cache = await caches.open(this.cacheSpace);
    this.warmingCache = false;
  }

  /**
   * Normalizes cacheTtl values to a number greater than or equal to 60.
   * @private
  */

  /**
   * Used to update the waitUntil function to the ExecutionContext of the currently executing request.
   * @param {ExecutionContext["waitUntil"]} waitUntil The waitUntil function used to asyncronously update the cache. Must be passed in before executing any other methods on every new request.
  */
  setWaitUntil(waitUntil: ExecutionContext["waitUntil"]) : void {
    this.waitUntil = waitUntil;
  }

  /**
   * Retrieves a value from the BetterKV Namespace.
   * @template K The type of the value. Only used if using the "json" type.
   * @param {string} key The key to retrieve.
   * @param {BetterKVGetOptions} options Options for the retrieval.
   * @returns {Promise<string | null>} The value of the key, or null if the key does not exist.
   * @example
   * const value = await NAMESPACE.get(key);
  */
  async get<V = any>(key: string, options?: BetterKVGetOptions): Promise<BetterKVGetReturns | null> {
    const cacheKey = this.url + key,
      cacheTTL = normalizeCacheTtl(options.cacheTtl),
      type = options.type || "text",
      headers = new Headers({ "Cloudflare-CDN-Cache-Control": `max-age=${cacheTTL}` });
    let bodyVal = await this.cache.match(cacheKey);

    if(bodyVal) {
      if(options && options.cacheTtl) {
        bodyVal = new Response(bodyVal.body, bodyVal);
        bodyVal.headers.set("Cloudflare-CDN-Cache-Control", `max-age=${cacheTTL}`);
        this.waitUntil(this.cache.put(cacheKey, bodyVal));
      }
      switch(options.type) {
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
    
    console.log(type);
    switch(type) {
      case "text":
        const textVal = await this.kv.get(key, { type: "text" }) as string | undefined;
        if(!textVal) return null;
        this.waitUntil(this.cache.put(cacheKey, new Response(textVal, {headers})));
        return textVal; 
      case "json":
        const jsonVal = await this.kv.get<V>(key, { type: "json" });
        if(!jsonVal) return null;
        this.waitUntil(this.cache.put(cacheKey, new Response(JSON.stringify(jsonVal), {headers})));
        return jsonVal;
      case "arrayBuffer":
        const bufVal = await this.kv.get(key, { type: "arrayBuffer" }) as ArrayBuffer | undefined;
        if(!bufVal) return null;
        this.waitUntil(this.cache.put(cacheKey, new Response(bufVal, {headers})));
        return bufVal;
      case "stream":
        const streamVal = await this.kv.get(key, { type: "stream" }) as ReadableStream | undefined;
        if(!streamVal) return null;
        this.waitUntil(this.cache.put(cacheKey, new Response(streamVal, {headers})));
        return streamVal;
    }
  }

  /**
   * Retrieves a value from the BetterKV Namespace, and its associated metadata, if provided.
   * @template V The type of the value. Only used if using the "json" type.
   * @template M The type of the metadata.
   * @param {string} key The key to retrieve.
   * @param {BetterKVGetOptions} options Options for the retrieval.
   * @returns {Promise<BetterKVGetReturns>} The value of the key, and its associated metadata(if any), or null if the key does not exist.
  */
  async getWithMetadata<V = any, M = any>(key: string, options?: BetterKVGetOptions): Promise<BetterKVGetReturns | null> {
    const cacheKey = this.url + key,
      cacheTTL = normalizeCacheTtl(options.cacheTtl),
      type = options.type || "text";
    let bodyVal = await this.cache.match(cacheKey);;

    if(bodyVal) {
      if(options && options.cacheTtl) {
        bodyVal = new Response(bodyVal.body, bodyVal);
        bodyVal.headers.set("Cloudflare-CDN-Cache-Control", `max-age=${cacheTTL}`);
        this.waitUntil(this.cache.put(cacheKey, bodyVal));
      }
      const metadata = JSON.parse(bodyVal.headers.get("metadata") as string) as M;
      switch(options.type) {
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
        this.waitUntil(this.cache.put(cacheKey, new Response(textVal.value, {headers})));
        return textVal; 
      case "json":
        const jsonVal = await this.kv.getWithMetadata<V, M>(key, { type: "json" });
        if(!jsonVal) return null;
        if(jsonVal.metadata) headers.set("metadata", JSON.stringify(jsonVal.metadata));
        this.waitUntil(this.cache.put(cacheKey, new Response(JSON.stringify(jsonVal), {headers})));
        return jsonVal;
      case "arrayBuffer":
        const bufVal = await this.kv.getWithMetadata<M>(key, { type: "arrayBuffer" });
        if(!bufVal) return null;
        if(bufVal.metadata) headers.set("metadata", JSON.stringify(bufVal.metadata));
        this.waitUntil(this.cache.put(cacheKey, new Response(bufVal.value, {headers})));
        return bufVal;
      case "stream":
        const streamVal = await this.kv.getWithMetadata<M>(key, { type: "stream" });
        if(!streamVal) return null;
        if(streamVal.metadata) headers.set("metadata", JSON.stringify(streamVal.metadata));
        this.waitUntil(this.cache.put(cacheKey, new Response(streamVal.value, {headers})));
        return streamVal;
    }
  }

  /**
   * Adds a new value to the BetterKV Namespace. Supports CacheTtl.
   * @param {string} key The key to add.
   * @param {BetterKVValueOptions} val The value to add. Type is inferred from the value.
   * @param {BetterKVAddOptions} options Options for the addition.
   * @example
   * await NAMESPACE.put(key, value);
  */
  async put<M = any>(key: string, val: BetterKVValueOptions, options: BetterKVPutOptions<M>): Promise<void> {
    const cacheKey = this.url + key;
    let { cacheTtl, ...putOptions } = options;
    cacheTtl = normalizeCacheTtl(cacheTtl);
    const headers = new Headers({ "Cloudflare-CDN-Cache-Control": `max-age=${cacheTtl}` });
    if(putOptions.metadata) headers.set("metadata", JSON.stringify(putOptions.metadata));
    if(typeof val === "string" || val instanceof ArrayBuffer) {
      this.waitUntil(this.cache.put(cacheKey, new Response(val, {headers})));
      await this.kv.put(key, val, putOptions);
      return;
    }
    if(val instanceof ReadableStream) {
      const a = val.tee();
      this.waitUntil(this.cache.put(cacheKey, new Response(a[0], {headers})));
      await this.kv.put(key, a[1], putOptions);
      return;
    }
    if(typeof val !== "object") throw new Error("Invalid Put Type");
    this.waitUntil(this.cache.put(cacheKey, new Response(JSON.stringify(val), {headers})));
    await this.kv.put(key, val, putOptions);
  }

  /**
   * Removes a value from the BetterKV Namespace.
   * @param {string} key The key to remove.
   * @example
   * await NAMESPACE.delete(key);
  */
  async delete(key: string): Promise<void> {
    this.waitUntil(this.cache.delete(this.url + key));
    await this.kv.delete(key);
  }

  /**
   * Lists keys in the BetterKV Namespace according to the options given. Supports CacheTtl.
   * @template M The type of the metadata.
   * @param {BetterKVListOptions} options Options for the listing.
   * @returns {Promise<BetterKVListReturns<M>>} The keys in the namespace, and their associated metadata(if any).
   * @example
   * const {keys, list_complete, cursor} = await NAMESPACE.list();
  */
  async list<M = any>(opts?: BetterKVListOptions): Promise<KVNamespaceListResult<M>> {
    let {cacheTtl, prefix, limit, cursor} = opts,
      cacheKey = new URL("https://list.better.kv");
    cacheTtl = normalizeCacheTtl(cacheTtl);
    if(!limit && (limit < 1 || limit > 1000)) limit = 1000;
    console.log(limit, limit < 1);
    if(prefix) cacheKey.searchParams.set("prefix", prefix);
    if(limit) cacheKey.searchParams.set("limit", limit.toString());
    if(cursor) cacheKey.searchParams.append("cursor", cursor);

    let bodyVal = await this.cache.match(cacheKey.toString());

    if(bodyVal) {
      if(cacheTtl) {
        bodyVal = new Response(bodyVal.body, bodyVal);
        bodyVal.headers.set("Cloudflare-CDN-Cache-Control", `max-age=${cacheTtl}`);
        this.waitUntil(this.cache.put(cacheKey.toString(), bodyVal));
      }
      return await bodyVal.json() as KVNamespaceListResult<any>;
    }
    const result = await this.kv.list<M>({prefix, limit, cursor});
    this.waitUntil(this.cache.put(cacheKey.toString(), new Response(JSON.stringify(result), {
      headers: { "Cloudflare-CDN-Cache-Control": `max-age=${cacheTtl}` }
    })));
    return result;
  }
};

export type BetterKVGetReturns = string | any | ArrayBuffer | ReadableStream;

export interface BetterKVGetOptions {
  type: "text" | "json" | "arrayBuffer" | "stream" | string;
  cacheTtl?: number;
}

export interface BetterKVPutOptions<K = any> {
  expiration?: number;
  expirationTtl?: number;
  metadata?: K | null;
  cacheTtl?: number;
}

export interface BetterKVListOptions extends KVNamespaceListOptions {
  cacheTtl?: number;
}

export type BetterKVTypeOptions = "text" | "json" | "arrayBuffer" | "stream";
export type BetterKVValueOptions = string | ArrayBuffer | ArrayBufferView | ReadableStream;