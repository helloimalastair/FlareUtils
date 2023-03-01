# Temra
A simple Workers-native templating engine. Utilizes the [*HTMLRewriter*](http://developers.cloudflare.com/workers/runtime-apis/html-rewriter) API, allowing templating operations to be streamed to the user, rather than being a blocking process.

While it is not required, it is recommended that any resulting HTML be cached before being returned.

## Setup
The Temra constructor accepts two optional parameters:
* A prefix. This is the default prefix for all template tags. As an example, if the prefix is set to `@`, then the `@name` tag will be read as a `name` tag. This is useful if you want to easily deliniate between the tags you want to use for templating, and the tags that should remain as they are.
* deleteComments. If set to `true`, all comments will be deleted from the HTML before being parsed. This is useful if you want to keep your HTML clean, but still have comments in your template.
```ts
import { Temra } from "flareutils";

export default <ExportedHandler> {
  async fetch(request: Request, env: Env) {
    const temra = new Temra("@", true);
    // ...
  }
}
```

## Methods
### add
Adds a new replacer to the Temra instance. `add` statements can be chained.

`add` accepts three parameters:
* The name/class/attribute/id of the tag to replace.
* A function that returns the replacement text. This function accepts two parameters:
  * The element that is being replaced.
  * The object that is passed to the `render` method. This includes any data that you want to pass to the template, plus the `env` object.
* An optional object that can contain the following properties:
  * `selectorType`. The type of selector to use. Can be one of `className`, `id`, `attribute`, `universal`, or `tagName`. Defaults to `className`.
  * `attributeValue`. The value of the attribute to use. Only used if `selectorType` is set to `attribute`.
  * `removeSelector`. If set to `true`, the selector will be removed from the element. Defaults to `false`.
```ts
temra.add("junkElement")
  .add("username", () => "John Doe")
  .add("secret", (e, o) => {
    if (o.secret) {
      return e;
    }
    return "";
  })
  .add("heatfromfire", () => "firefromheat", {
    selectorType: "id",
    removeSelector: true
  });
```
### transform
Applies the currently added replacer functions to the provided HTML.

To run this function, you need to supply a HTML Response Object, and you can optionally pass your own data/the env object into the replacers as necessary.

```ts
const res = temra.transform(await fetch("https://template.com"));
const resTwo = temra.transform(await fetch("https://template.com", {
  env,
  req,
  other: {
    data: "here"
  }
}));
```