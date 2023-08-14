# Isaac

Cryptographically-secure random number generator. Based on the [ISAAC algorithm](http://burtleburtle.net/bob/rand/isaac.html) by [Bob Jenkins](http://burtleburtle.net/bob/), and the JS implementation by [Yves-Marie K. Rinquin](https://github.com/rubycon). Backed by [crypto.getRandomValues](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues), and the [DRAND](https://drand.love) network.

# Setup

To instantiate an Isaac instance, you need 2 things:

- A seed. This can be any string, but it is recommended that you use a random string, or a string that is unique to the project.
- The number of times you wish to run the seed through the mixer. This is optional, and defaults to 1.

```ts
import { Isaac } from "flareutils";

export default <ExportedHandler>{
	async fetch(req) {
		const isaac = new Isaac("my seed", 2);
		// ...
	},
};
```

::: warning
The seeding process occurs asynchronously, and may take a little bit of time. We recommend creating a single Isaac instance at startup, and then awaiting it before using it.
:::

```ts
if (isaac.seeding) {
	await isaac.seeding;
}
```

## Methods

### seed

This allows you to inject a new seed into the Isaac instance. This is useful if you want to change the seed mid-execution. Awaiting this method will ensure the instance will be ready to use.

```ts
await isaac.seed("someNewString");
```

### rand

This returns a random number between 0 and 1.

```ts
const rand = isaac.rand();
```
