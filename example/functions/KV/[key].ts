import type { BetterKVPutOptions } from "flareutils";
import {KV, startBetterKV} from "./Better";
export interface Environment {
  KV: KVNamespace,
}


export const onRequestGet: PagesFunction<Environment> = async ctx => {
  if(!KV) startBetterKV(ctx.env.KV, ctx.waitUntil);
  const key = Array.isArray(ctx.params.key) ? ctx.params.key[0] : ctx.params.key,
    {searchParams} = new URL(ctx.request.url),
    cacheTtl = Number(searchParams.get("cacheTTL")),
    metadata = Boolean(searchParams.get("metadata"));
  let type = searchParams.get("type");
  if(!type || !(type === "text" || type === "json")) type = "text";
  if(KV.warmingCache) await KV.warmingCache;
  if(metadata) 
    return new Response(JSON.stringify(await KV.getWithMetadata(key, {cacheTtl, type})), {headers: {"content-type": "application/json"}});
  const r = await KV.get(key, {cacheTtl, type});
  console.log(r);
  return new Response(JSON.stringify(r), {headers: {"content-type": "application/json"}});
};

export const onRequestPost: PagesFunction<Environment> = async ctx => {
  if(!KV) startBetterKV(ctx.env.KV, ctx.waitUntil);
  const key = Array.isArray(ctx.params.key) ? ctx.params.key[0] : ctx.params.key,
    {searchParams} = new URL(ctx.request.url),
    headers = ctx.request.headers,
    cacheTtl = Number(searchParams.get("cacheTTL")),
    expiration = Number(searchParams.get("expiration")),
    expirationTtl = Number(searchParams.get("expirationTTL")),
    metadata = Boolean(searchParams.get("metadata"));
  if(!(headers.get("content-type") === "application/json" || headers.get("content-type") === "text/plain") || (metadata && headers.get("content-type") !== "application/json"))
    return new Response("Invalid Content-Type", {status: 400, headers: {"content-type": "text/plain"}});
  let putOptions : BetterKVPutOptions = {cacheTtl};
  if(expiration) putOptions.expiration = expiration;
  if(expirationTtl) putOptions.expirationTtl = expirationTtl;
  if(metadata) {
    let body: {value: any, metadata: any};
    try {
      body = await ctx.request.json();
    } catch(e) {
      return new Response("Malformed JSON", {status: 400});
    }
    if(!body.metadata) return new Response("No Metadata", {status: 400});
    putOptions.metadata = body.metadata;
    if(KV.warmingCache) await KV.warmingCache;
    await KV.put(key, body.value, putOptions);
  } else {
    let value: any | string;
    if(headers.get("content-type") === "application/json") value = await ctx.request.json();
    else value = await ctx.request.text();
    if(KV.warmingCache) await KV.warmingCache;
    await KV.put(key, value, putOptions);
  }
  return new Response("OK");
};