interface DrandResponse {
  round: number;
  randomness: string;
  signature: string;
  previous_signature: string;
}

function xmur3(str: string) : () => number {
  for(var i = 0, h = 1779033703 ^ str.length; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 3432918353), h = h << 13 | h >>> 19;
  return function() {
    h = Math.imul(h ^ h >>> 16, 2246822507);
    h = Math.imul(h ^ h >>> 13, 3266489909);
    return (h ^= h >>> 16) >>> 0;
  }
}

function xoshiro128(a: number, b: number, c: number, d: number) : () => number {
  return function() : number {
    var t = b << 9, r = a * 5; r = (r << 7 | r >>> 25) * 9;
    c ^= a; d ^= b;
    b ^= c; a ^= d; c ^= t;
    d = d << 11 | d >>> 21;
    return (r >>> 0) / 4294967296;
  }
}

/**
 * Instantiates a BetterRand generator. Note that while BetterRand may provide random numbers backed by cryptographically-secure sources, the underlying algorithm itself is not cryptographically secure. Thus, it is recommended you reinstantiate the generator as often as possible to ensure that the random numbers are semi-cryptographically-secure.
 * @param {string} seed The seed used to instantiate the random number generator
 * @returns {Promise<() => number)>}
 * @constructor
*/
export default async function (userSeed?: string) : Promise<() => number> {
  const drand = (await(await fetch("https://drand.cloudflare.com/public/latest")).json() as DrandResponse).signature;
  const seed = xmur3(
    (
      userSeed === undefined ?
      null :
      userSeed
    ) +
    crypto.getRandomValues(new Uint8Array(10)).toString() +
    drand +
    Date.now()
  );
  return xoshiro128(seed(),seed(),seed(),seed());
};