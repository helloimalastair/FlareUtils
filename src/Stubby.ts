/**
 * Stores Durable Object Stubs in Memory, allowing faster recall. Utilizes KV and Unique DO IDs to reduce time to stub return, due to not necessitating global DO availability checks.
 */
export class Stubby {
  /**
   * Durable Object Namespace, to which the stubs pertain.
   */
  private readonly ns: DurableObjectNamespace;
  /**
   * KV Namespace used to globally cache DO Stub IDs.
   */
  private readonly kv: KVNamespace;
  /**
   * Used to ensure Cache Operations are executed while not blocking script execution.
   */
  private readonly waitUntil: ExecutionContext["waitUntil"];
  /**
   * Prefix used in KV operations, allows for multiple projects to share one KV namespace. Should be unique.
   */
  private readonly prefix: string;
  /**
   * In memory DO Stub Cache.
   */
  private readonly stubMap = new Map<string, DurableObjectStub>();
  
  /**
   * Constructs a Stubby Instance.
   * @param {DurableObjectNamespace} ns Durable Object Namespace utilized for stubs. 
   * @param {KVNamespace} kv KV Namespace used to store raw DO IDs. 
   * @param {ExecutionContext["waitUntil"]} waitUntil Used to unblock thread, ensuring KV writes are completed without pausing execution of the rest of the script.
   * @param {string} prefix Used to prefix KV writes, allowing multiple systems to share one KV namespaces without collisions.
   */
  constructor(ns: DurableObjectNamespace, kv: KVNamespace, waitUntil: ExecutionContext["waitUntil"], prefix?: string) {
    this.ns = ns;
    this.kv = kv;
    this.waitUntil = waitUntil;
    this.prefix = prefix || "";
  }

  /**
   * Returns a stub from memory or KV, or generates a new stub if not available. Caches returned stubs to ensure quickest recall.
   * @param {string} key Used to identify stub for retrieval or creation.
   * @returns {Promise<DurableObjectStub>}
   */
  async get(key: string): Promise<DurableObjectStub> {
    let stub = this.stubMap.get(key);
    if(stub) return stub;
    let idString = await this.kv.get(this.prefix + key);
    if(idString) {
      stub = this.ns.get(this.ns.idFromString(idString));
      this.stubMap.set(key, stub);
      return stub;
    }
    let id = this.ns.newUniqueId();
    this.waitUntil(this.kv.put(this.prefix + key, id.toString()));
    stub = this.ns.get(id);
    this.stubMap.set(key, stub);
    return stub;
  }
  /**
   * Removes a singular stub from local and KV storage. Note that this operation is irreversable, and stubs will not be recoverable unless stored elsewhere.
   * @param {string} key Used to identify stub to remove.
   * @returns {Promise<void>}
   */
  async remove(key: string): Promise<void> {
    this.stubMap.delete(key);
    await this.kv.delete(key);
  }
  /**
   * Clears all stubs belonging to this Stubby instance.
   * @returns {Promise<void>}
   */
  async clearAll(): Promise<void> {
    const keys: Promise<void>[] = [];
    let cursor = "";
    while(true) {
      const listRet = await this.kv.list({prefix: this.prefix, cursor: cursor});
      for(const key of listRet.keys)
        keys.push(this.kv.delete(key.name));
      if(listRet.list_complete) break;
      if(typeof(listRet.cursor) === 'string') cursor = listRet.cursor;
    }
    await Promise.allSettled(keys);
    this.stubMap.clear();
  }
}