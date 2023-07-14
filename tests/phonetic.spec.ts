import { expect, test } from "vitest";
import worker from "../dist/worker.js";

test("test phonetic generator", async () => {
  const req = new Request("http://localhost/phonetic");
  const id = await (await worker.fetch(req)).text();
	expect(id).match(/^[a-z]{10}$/i)
});

test("test phonetic generator with explicit length", async () => {
  const req = new Request("http://localhost/phonetic?len=20");
  const id = await (await worker.fetch(req)).text();
	expect(id).match(/^[a-z]{20}$/i);
});