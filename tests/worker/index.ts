import { Hono } from "hono";
import { phonetic } from "./Phonetic";

const hono = new Hono();

hono.get("/phonetic", phonetic);

export default {
	fetch: hono.fetch,
};
