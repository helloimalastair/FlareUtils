import type { Environment } from "./[key]";
import {KV, startBetterKV} from "./Better";
export const onRequestGet: PagesFunction<Environment> = async ctx => {
  if(!KV) startBetterKV(ctx.env.KV, ctx.waitUntil);
  const { searchParams } = new URL(ctx.request.url),
    limit = Number(searchParams.get("limit")),
    prefix = searchParams.get("prefix"),
    cursor = searchParams.get("cursor"),
    cacheTtl = Number(searchParams.get("cacheTtl"));
  if(KV.warmingCache) await KV.warmingCache;
  return new Response(JSON.stringify((await KV.list({limit, prefix, cursor, cacheTtl}))), {headers: {"content-type": "application/json"}});
};
