# Phonetic
Generator that generates random phonetic strings. Cryptographic security is dependent on the random number generator that is passed in. Revision of [Erisa's](https://erisa.uk) [Phonetic Generator](https://github.com/Erisa/starbin/blob/b8a333b781a893dcae60c4fb2638d34e63c6f568/index.js#L38).

While we highly recommend using a cryptographically secure random number generator([Isaac](/isaac/), [`crypto.getRandomValues`](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues)) this generator will work with any random number generator that returns a number between 0 and 1([`Math.random`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random)).

## Usage
```ts
import { Phonetic } from "flareutils";

const random = Math.random;
const generator = new Phonetic(random);
console.log(rand());
console.log(rand(10)); // 10 characters
```