import type { Handler } from "hono";
import { Phonetic } from "../../src";

export const phonetic: Handler = (ctx) => {
	const phonetic = new Phonetic(Math.random);
	const len = Number(ctx.req.query("len"));
	return new Response(phonetic.rand(Number.isNaN(len) ? 10 : len));
};
