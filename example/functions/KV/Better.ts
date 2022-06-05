import { BetterKV } from "flareutils";
let KV: BetterKV | undefined;
function startBetterKV(kv: KVNamespace, waitUntil: ExecutionContext["waitUntil"]) {
  if(!KV) KV = new BetterKV(kv, waitUntil);
}
export { startBetterKV, KV };