const CONCURRENCY = 6;
/**
 * A queue that runs a maximum of 6 promises at a time, to stay within Workers' concurrent I/O limit.
 */
export class PromiseQueue {
	private queue: Promise<unknown>[];

	constructor() {
		this.queue = [];
	}

	/**
	 * Add a promise to the queue. Always await this function.
	 * @param promise The promise to add to the queue.
	 */
	async add(promise: Promise<unknown>): Promise<void> {
		this.queue.push(promise);
		if (this.queue.length === CONCURRENCY) {
			const completed = await Promise.race(
				this.queue.map(async (e, i) => {
					await e;
					return i;
				}),
			);
			this.queue = this.queue.splice(completed, 1);
		}
	}

	/**
	 * Flush the queue. Always await this function.
	 * @note Run this function when all tasks have been added to the queue.
	 */
	async flush() {
		await Promise.allSettled(this.queue);
		this.queue = [];
	}
}
