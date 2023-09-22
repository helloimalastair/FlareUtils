# PromiseQueue

Simple utility to bulk-queue I/O-related promises without having to deal with Workers' concurrency limit.

::: info Note
Both `queue.add` and `queue.flush` return a promise, so you should `await` them. Not awaiting `queue.add` may result in the queue attempting to process more than 6 promises at once, which is counterproductive.
:::

## Usage

```ts
const queue = new PromiseQueue();

for (let i = 0; i < 100; i++) {
	await queue.add(env.KV.delete("key" + i));
}
await queue.flush();
```
