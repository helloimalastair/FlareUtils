export declare type RandNum = () => number;
export declare type RandLetter = () => string;

function randOf(collection: string, rand: RandNum): RandLetter {
	return () => collection[Math.floor(rand() * collection.length)];
}

/**
 * Generator that generates random phonetic strings. Cryptographic security is dependent on the random number generator that is passed in.
 */
export class Phonetic {
	/**
	 * Random number generator used by Phonetic. Must generate numbers from 0 to 1.
	 */
	private readonly generator: RandNum;
	/**
	 * Returns a random vowel.
	 */
	private readonly vowel: RandLetter;
	/**
	 * Returns a random consonant.
	 */
	private readonly consonant: RandLetter;

	/**
	 * Creates a new Phonetic generator.
	 * @param {RandNum} rand Random Number Generator. While it is recommended to use a cryptographically secure random number generator(a la. [Isaac](/classes/Isaac)), this is not required.
	 * @constructor
	 */
	constructor(rand: RandNum) {
		this.generator = rand;
		this.vowel = randOf("aeiou", rand);
		this.consonant = randOf("bcdfghjklmnpqrstvwxyz", rand);
	}

	/**
	 * Generates a random phonetic string.
	 * @param {number} length Length of the string to generate.
	 * @returns {string} Random phonetic string.
	 * @example
	 * const phonetic = phonetic.rand(10);
	 */
	rand(len = 10): string {
		let id = "";
		const start = Math.round(this.generator());
		for (let i = 0; i < len; i++)
			id += i % 2 === start ? this.consonant() : this.vowel();
		return id;
	}
}
