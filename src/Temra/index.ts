import type { AddOptions, Replacer, TransformationOptionals } from "./types";

const deleteElement = {
	element: (e: Element) => {
		e.remove();
	},
};

/**
 * Simple Workers-native templating engine. Utilizes the [*HTMLRewriter*](http://developers.cloudflare.com/workers/runtime-apis/html-rewriter) API, allowing templating operations to be streamed to the user, rather than being a blocking process. While it is not required, it is recommended that any resulting HTML be cached before being returned.
 * @template Environment The Environment object, provided by the Workers Runtime.
 * @template Optional Optional parameters, provided to your replacer function.
 */
export class Temra<Environment = unknown, Optionals = unknown> {
	/**
	 * Default Prefix used for tag names.
	 */
	private readonly tagPrefix: string;
	/**
	 * Whether comments should be removed.
	 */
	private readonly deleteComments: boolean;
	/**
	 * Replacers applied to your HTML.
	 */
	private replacers: {
		[key: string]: Replacer<Environment, Optionals>;
	} = {};
	/**
	 * Initializes a new Temra instance.
	 * @param {string} prefix Default Prefix used for tag names. For example, if the prefix is "Temra", then the tag name "TemraName" will be read as "Name".
	 * @param {boolean} deleteComments Whether comments should be removed.
	 */
	constructor(prefix?: string, deleteComments?: boolean) {
		this.tagPrefix = prefix || "";
		this.deleteComments = deleteComments || false;
	}
	/**
	 * Add a replacer to the Temra instance.
	 * @param {string} selector Selector used to find elements.
	 * @param {AddOptions} options Options used to configure the replacer.
	 * @returns {Temra} Returns the Temra instance, for chaining.
	 * @example ```ts
	 * temra.add("username", () => "Jay Doe", {removeSelector: true});
	 * ```
	 */
	add(selector: string, options: AddOptions<Environment, Optionals>): this {
		const replacer: Replacer<Environment, Optionals> = {
			type: options.selectorType ? options.selectorType : "className",
		};
		if (options.replacerFunction) {
			replacer.replacerFunction = options.replacerFunction;
		}
		if (options.removeSelector) replacer.removeSelector = true;
		switch (options.selectorType) {
			case "universal":
				this.replacers[selector] = replacer;
				break;
			case "tagName":
				this.replacers[`${this.tagPrefix}${selector}`] = replacer;
				break;
			case "className":
				this.replacers[`*.${selector}`] = replacer;
				break;
			case "id":
				this.replacers[`*#${selector}`] = replacer;
				break;
			case "attribute":
				this.replacers[`*[${selector}${options.attributeValue}]`] = replacer;
				break;
			default:
				throw new Error(`Unknown selector type: ${options.selectorType}`);
		}
		return this;
	}

	/**
	 * Applies the currently added replacer functions to the provided HTML.
	 * @param {Response} body HTML response that will be transformed.
	 * @param {TransformationOptionals<E, O>} [optionals] Optional parameters to pass to the replacer function.
	 * @returns Response
	 * @example ```ts
	 * return temra.transform(await fetch(req), {req, env});
	 * ```
	 */
	transform(
		body: Response,
		optionals?: TransformationOptionals<Environment, Optionals>,
	): Response {
		const rewriter = new HTMLRewriter();
		for (const [selector, replacer] of Object.entries(this.replacers)) {
			if (replacer.delete) {
				rewriter.on(selector, deleteElement);
				continue;
			}
			const ElementHandler: HTMLRewriterElementContentHandlers = {};
			switch (replacer.type) {
				case "universal":
				case "tagName":
					ElementHandler.element = async (element: Element) => {
						if (replacer.replacerFunction) {
							const content = await replacer.replacerFunction(
								element,
								optionals,
							);
							element.replace(content, { html: replacer.isHTML });
						} else {
							element.remove();
						}
					};
					break;
				case "attribute":
					ElementHandler.element = async (element: Element) => {
						if (replacer.replacerFunction) {
							const content = await replacer.replacerFunction(
								element,
								optionals,
							);
							element.replace(content, { html: replacer.isHTML });
							if (replacer.removeSelector) element.removeAttribute(selector);
						} else {
							element.remove();
						}
					};
					break;
				case "className":
					ElementHandler.element = async (element: Element) => {
						if (replacer.replacerFunction) {
							const content = await replacer.replacerFunction(
								element,
								optionals,
							);
							element.replace(content, { html: replacer.isHTML });
							if (replacer.removeSelector) {
								const allClasses = element.getAttribute("class") as string;
								element.setAttribute(
									"class",
									allClasses
										.split(" ")
										.filter((e) => e !== selector)
										.join(" "),
								);
							}
						} else {
							element.remove();
						}
					};
					break;
				case "id":
					ElementHandler.element = async (element: Element) => {
						if (replacer.replacerFunction) {
							const content = await replacer.replacerFunction(
								element,
								optionals,
							);
							element.replace(content, { html: replacer.isHTML });
							if (replacer.removeSelector) element.removeAttribute("id");
						} else {
							element.remove();
						}
					};
					break;
			}
			rewriter.on(selector, ElementHandler);
		}
		if (this.deleteComments)
			rewriter.onDocument({
				comments: (c: Comment) => {
					c.remove();
				},
			});
		return rewriter.transform(body);
	}
}

export * from "./types";
