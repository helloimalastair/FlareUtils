/* ----------------------------------------------------------------------
 * Copyright (c) 2012 Yves-Marie K. Rinquin
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 * ----------------------------------------------------------------------
 *
 * ISAAC is a cryptographically secure pseudo-random number generator
 * (or CSPRNG for short) designed by Robert J. Jenkins Jr. in 1996 and
 * based on RC4. It is designed for speed and security.
 *
 * ISAAC's informations & analysis:
 *   http://burtleburtle.net/bob/rand/isaac.html
 * ISAAC's implementation details:
 *   http://burtleburtle.net/bob/rand/isaacafa.html
 *
 * ISAAC succesfully passed TestU01
 */

export declare interface DrandResponse {
	round: number;
	randomness: string;
	signature: string;
	previous_signature: string;
}

/**
 * Supported seed types for Isaac.
 */
export declare type IsaacSeed = string | number | number[];

function toIntArray(str: string): number[] {
	let w1: number;
	let w2: number;
	let u: number;
	let r4: number[] = [];
	let r: number[] = [];
	let i = 0;
	// pad string to avoid discarding last chars
	const s = `${str}\0\0\0`;
	const l = s.length - 1;

	while (i < l) {
		w1 = s.charCodeAt(i++);
		w2 = s.charCodeAt(i + 1);
		if (w1 < 0x0080)
			// 0x0000 - 0x007f code point: basic ascii
			r4.push(w1);
		else if (w1 < 0x0800) {
			// 0x0080 - 0x07ff code point
			r4.push(((w1 >>> 6) & 0x1f) | 0xc0);
			r4.push(((w1 >>> 0) & 0x3f) | 0x80);
		} else if ((w1 & 0xf800) !== 0xd800) {
			// 0x0800 - 0xd7ff / 0xe000 - 0xffff code point
			r4.push(((w1 >>> 12) & 0x0f) | 0xe0);
			r4.push(((w1 >>> 6) & 0x3f) | 0x80);
			r4.push(((w1 >>> 0) & 0x3f) | 0x80);
		} else if (((w1 & 0xfc00) === 0xd800) && ((w2 & 0xfc00) === 0xdc00)) {
			// 0xd800 - 0xdfff surrogate / 0x10ffff - 0x10000 code point
			u = ((w2 & 0x3f) | ((w1 & 0x3f) << 10)) + 0x10000;
			r4.push(((u >>> 18) & 0x07) | 0xf0);
			r4.push(((u >>> 12) & 0x3f) | 0x80);
			r4.push(((u >>> 6) & 0x3f) | 0x80);
			r4.push(((u >>> 0) & 0x3f) | 0x80);
			i++;
		}
		/* add integer (four utf-8 value) to array */
		if (r4.length > 3) {
			// little endian
			r.push((r4.shift() << 0) | (r4.shift() << 8) | (r4.shift() << 16) | (r4.shift() << 24));
		}
	}

	return r;
}

function add(a: number, b: number): number {
	const lsb = (a & 0xffff) + (b & 0xffff);
	const msb = (a >>> 16) + (b >>> 16) + (lsb >>> 16);
	return (msb << 16) | (lsb & 0xffff);
}

function seed_mix(arr: number[]): number[] {
	arr[0] ^= arr[1] << 11; arr[3] = add(arr[3], arr[0]); arr[1] = add(arr[1], arr[2]);
	arr[1] ^= arr[2] >>> 2; arr[4] = add(arr[4], arr[1]); arr[2] = add(arr[2], arr[3]);
	arr[2] ^= arr[3] << 8; arr[5] = add(arr[5], arr[2]); arr[3] = add(arr[3], arr[4]);
	arr[3] ^= arr[4] >>> 16; arr[6] = add(arr[6], arr[3]); arr[4] = add(arr[4], arr[5]);
	arr[4] ^= arr[5] << 10; arr[7] = add(arr[7], arr[4]); arr[5] = add(arr[5], arr[6]);
	arr[5] ^= arr[6] >>> 4; arr[0] = add(arr[0], arr[5]); arr[6] = add(arr[6], arr[7]);
	arr[6] ^= arr[7] << 8; arr[1] = add(arr[1], arr[6]); arr[7] = add(arr[7], arr[0]);
	arr[7] ^= arr[0] >>> 9; arr[2] = add(arr[2], arr[7]); arr[0] = add(arr[0], arr[1]);
	return arr;
}

/**
 * Cryptographically-secure random number generator. Based on the [ISAAC algorithm](http://burtleburtle.net/bob/rand/isaac.html) by [Bob Jenkins](http://burtleburtle.net/bob/), and the JS implementation by [Yves-Marie K. Rinquin](https://github.com/rubycon). Backed by [crypto.getRandomValues](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues), and the [DRAND](https://drand.love) network.
*/
export class Isaac {
	private readonly runs: number;
	private m: number[];
	private acc: number;
	private brs: number;
	private cnt: number;
	private r: number[];
	private gnt: number;
	/**
	 * This promise represents whether the seeding process has been completed. It is recommended that you create the Isaac object as early as possible, do other tasks as needed, and then *await* the promise afterward to ensure that the seeding process has completed. If it is *false*, then the seeding process has completed, and no *await* is necessary.
	 */
	seeding: Promise<void> | false;

	/**
	 * Creates a new Isaac CSPRNG. Note that you must await `seeding` before using the generator.
	 * @param {IsaacSeed} seed Seed to be fed into the generator.
	 * @param {number} runs Number of times to re-run the generator.
	 * @constructor
	*/
	constructor(seed: IsaacSeed, runs?: number) {
		this.runs = runs || 1;
		this.m = this.r = Array(256);
		this.acc = this.brs = this.cnt = this.gnt = 0;
		this.seeding = this.seed(seed);
	};

	/**
	 * Batch-generates 256 random numbers, and stores them in the number buffer.
	 * @private
	*/
	private prng(): void {
		let i: number;
		let x: number;
		let y: number;
		let n: number = this.runs;

		while (n--) {
			this.cnt = add(this.cnt, 1);
			this.brs = add(this.brs, this.cnt);

			for (i = 0; i < 256; i++) {
				switch (i & 3) {
					case 0: this.acc ^= this.acc << 13; break;
					case 1: this.acc ^= this.acc >>> 6; break;
					case 2: this.acc ^= this.acc << 2; break;
					case 3: this.acc ^= this.acc >>> 16; break;
				}
				this.acc = add(this.m[(i + 128) & 0xff], this.acc); x = this.m[i];
				this.m[i] = y = add(this.m[(x >>> 2) & 0xff], add(this.acc, this.brs));
				this.r[i] = this.brs = add(this.m[(y >>> 10) & 0xff], x);
			}
		}
	};

	/**
	 * Shuffles the given array with the seed array, to ensure even mix.
	 * @param {number[]} arr Array filled with mixed numbers
	 * @param {number[]} s The seed, as an array of numbers
	 * @returns {number[]} The mixed array
	 * @private
	*/
	private superShuffle(arr: number[], s: number[]): number[] {
		for (let i = 0; i < 256; i += 8) {
			if (s) /* use all the information in the seed */
				for (let j = 0; j < 8; j++)
					arr[j] = add(arr[j], this.r[i + j]);
			arr = seed_mix(arr);
			/* fill in m[] with messy stuff */
			for (let j = 0; j < 8; j++)
				this.m[i + j] = arr[j];
		}
		return arr;
	}

	/**
	 * Resets the internal state of the generator.
	 * @private
	*/
	private reset(): void {
		this.acc = this.brs = this.cnt = this.gnt = 0;
		for (var i = 0; i < 256; ++i)
			this.m[i] = this.r[i] = 0;
	};

	/**
	 * Seeds the generator. Note that you must await `seeding` before using the generator, if not manually seeded and awaited.
	 * @param {IsaacSeed} seed Seed to be fed into the generator
	 * @returns {Promise<void>} Promise that resolves when the generator has been seeded
	 * @async
	 * @example ```ts
	 * await isaac.seed(seed);
	 * ```
	 */
	async seed(seed: IsaacSeed): Promise<void> {
		let arr: number[] = Array.from(crypto.getRandomValues(new Uint32Array(9)));
		let s: number[];
		let i: number;

		/* seeding the seeds of love */
		// a = b = c = d = e = f = g = h = 0x9e3779b9; /* the golden ratio */


		if (seed && typeof (seed) === "string")
			s = toIntArray(seed);

		if (seed && typeof (seed) === "number")
			s = [seed];
		try {
			s.push(Number((await (await fetch("https://drand.cloudflare.com/public/latest")).json() as DrandResponse).signature));
		} catch (e) { }

		s.push(Date.now());

		this.reset();
		for (i = 0; i < s.length; i++)
			this.r[i & 0xff] += (typeof (s[i]) === "number") ? s[i] : 0;

		for (i = 0; i < 4; i++) /* scramble it */
			arr = seed_mix(arr);

		arr = this.superShuffle(arr, s);

		/* if more of the seed still exists, do a second pass to make all of the seed affect all of m[] */
		if (s)
			arr = this.superShuffle(arr, s);

		this.prng(); /* fill in the first set of results */
		this.gnt = 256;  /* prepare to use the first set of results */;
		this.seeding = false;
	};

	/**
	 * Returns a pre-generated random number from the number buffer.
	 * @returns {number} A random number between 0 and 1
	 * @example ```ts
	 * const num = isaac.rand();
	 * ```
	 */
	rand(): number {
		if (!this.gnt--) {
			this.prng();
			this.gnt = 255;
		}
		return 0.5 + this.r[this.gnt] * 2.3283064365386963e-10;
	};
};