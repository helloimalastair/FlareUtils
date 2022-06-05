export type RandNum = () => number;
export type RandLetter = () => string;

/**
 * Generator that generates random phonetic strings. Cryptographic security is dependent on the random number generator that is passed in.
*/
export class Phonetic {
  private readonly generator: RandNum;
  private randOf(collection: string, rand: RandNum) : RandLetter {
    return () => collection[Math.floor(rand() * collection.length)];
  }
  private readonly vowel: RandLetter;
  private readonly consonant: RandLetter;

  /**
   * Creates a new Phonetic generator.
   * @param {RandNum} rand Random Number Generator.
   * @constructor
  */
  constructor(rand: RandNum) {
    this.generator = rand;
    this.vowel = this.randOf("aeiou", rand);
    this.consonant = this.randOf("bcdfghjklmnpqrstvwxyz", rand);
  }

  /**
   * Generates a random phonetic string.
   * @param {number} length Length of the string to generate.
   * @returns {string} Random phonetic string.
   * @example
   * const phonetic = new Phonetic(Math.random);
  */
  rand(len: number = 10) : string {
    let id = "";
    const start = Math.round(this.generator());
    for (let i = 0; i < len; i++) id += (i % 2 == start) ? this.consonant() : this.vowel();
    return id;
  }
};