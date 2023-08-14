function toIntArray(str: string): number[] {
	let w1: number;
	let w2: number;
	let u: number;
	const r4: number[] = [];
	const r: number[] = [];
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
		} else if ((w1 & 0xfc00) === 0xd800 && (w2 & 0xfc00) === 0xdc00) {
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
			r.push(
				((r4.shift() as number) << 0) |
					((r4.shift() as number) << 8) |
					((r4.shift() as number) << 16) |
					((r4.shift() as number) << 24),
			);
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
	arr[0] ^= arr[1] << 11;
	arr[3] = add(arr[3], arr[0]);
	arr[1] = add(arr[1], arr[2]);
	arr[1] ^= arr[2] >>> 2;
	arr[4] = add(arr[4], arr[1]);
	arr[2] = add(arr[2], arr[3]);
	arr[2] ^= arr[3] << 8;
	arr[5] = add(arr[5], arr[2]);
	arr[3] = add(arr[3], arr[4]);
	arr[3] ^= arr[4] >>> 16;
	arr[6] = add(arr[6], arr[3]);
	arr[4] = add(arr[4], arr[5]);
	arr[4] ^= arr[5] << 10;
	arr[7] = add(arr[7], arr[4]);
	arr[5] = add(arr[5], arr[6]);
	arr[5] ^= arr[6] >>> 4;
	arr[0] = add(arr[0], arr[5]);
	arr[6] = add(arr[6], arr[7]);
	arr[6] ^= arr[7] << 8;
	arr[1] = add(arr[1], arr[6]);
	arr[7] = add(arr[7], arr[0]);
	arr[7] ^= arr[0] >>> 9;
	arr[2] = add(arr[2], arr[7]);
	arr[0] = add(arr[0], arr[1]);
	return arr;
}

export { toIntArray, add, seed_mix };
