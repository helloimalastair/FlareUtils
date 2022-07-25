export declare type ReplaceFunction<E = any, O = any> = (e: Element, optionals?: TransformationOptionals<E, O>) => Promise<string> | string;

export declare type SelectorType = "tagName" | "className" | "id" | "attribute" | "universal";

export declare interface AddOptions {
  selectorType?: SelectorType,
  attributeValue?: string,
  removeSelector?: boolean
}

export declare interface Replacer {
  type: SelectorType,
  attributeValue?: string,
  delete?: boolean,
  replacerFunction?: ReplaceFunction,
  isHTML?: boolean,
  removeSelector?: boolean
}

export declare interface TransformationOptionals<E = any, O = any> {
  env?: E,
  req?: Request,
  other?: O;
}

const deleteElement = {
  element: (e: Element) => {e.remove()}
};

/**
 * Simple Workers-native templating engine. Utilizes the [*HTMLRewriter*](http://developers.cloudflare.com/workers/runtime-apis/html-rewriter) API, allowing templating operations to be streamed to the user, rather than being a blocking process. While it is not required, it is recommended that any resulting HTML be cached before being returned.
 * @template E The Environment object, provided by the Workers Runtime.
 * @template O Optional parameters, provided to your replacer function.
 */
export class Temra<E = any, O = any> {
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
    [key: string]: Replacer,
  } = {};
  /**
   * Initializes a new Temra instance.
   * @template E The Environment object, provided by the Workers Runtime.
   * @param {string} prefix Default Prefix used for tag names. For example, if the prefix is "Temra", then the tag name "TemraName" will be read as "Name".
   * @param {boolean} deleteComments Whether comments should be removed.
   */
  constructor(prefix?: string, deleteComments?: boolean) {
    this.tagPrefix = prefix || "";
    this.deleteComments = deleteComments || false;
  }
  /**
   * Add a replacer to the Temra instance.
   * @todo Add support for modifying tag names.
   * @template E The Environment object, provided by the Workers Runtime.
   * @param {string} selector Selector used to find elements.
   * @param {ReplaceFunction=} replacerFunction Function to be called when the selector is found. Must return a string which will be used to replace the element. If no function is provided, the element will be removed.
   * @param {AddOptions=} options Options used to configure the replacer.
   * @returns {Temra} Returns the Temra instance, for chaining.
   * @example ```ts
   * temra.add("username", () => "Jay Doe", {removeSelector: true});
   * ```
   */
  add<E = any>(selector: string, replacerFunction?: ReplaceFunction<E, O>, options?: AddOptions): Temra {
    // If replaceFunction is not defined, then matched Elements are removed
    const replacer: Replacer = {replacerFunction, type: options?.selectorType || "className"};
    if(options?.removeSelector) replacer.removeSelector = true;
    switch(options?.selectorType) {
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
        throw new Error(`Unknown selector type: ${options?.selectorType}`);
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
  transform(body: Response, optionals?: TransformationOptionals<E, O>): Response {
    const rewriter = new HTMLRewriter();
    for(const [selector, replacer] of Object.entries(this.replacers)) {
      if(replacer.delete) {
        rewriter.on(selector, deleteElement);
        continue;
      }
      let ElementHandler: HTMLRewriterElementContentHandlers;
      switch(replacer.type) {
        case "universal":
        case "tagName":
          ElementHandler.element = async (element: Element) => {
            const content = await replacer.replacerFunction(element, optionals);
            element.replace(content, {html: replacer.isHTML});
          }
          break;
        case "attribute":
          ElementHandler.element = async (element: Element) => {
            const content = await replacer.replacerFunction(element, optionals);
            element.replace(content, {html: replacer.isHTML});
            if(replacer.removeSelector) element.removeAttribute(selector);
          }
          break;
        case "className":
          ElementHandler.element = async (element: Element) => {
            const content = await replacer.replacerFunction(element, optionals);
            element.replace(content, {html: replacer.isHTML});
            if(replacer.removeSelector) {
              const allClasses = element.getAttribute("class");
              if (allClasses) element.setAttribute("class", allClasses.split(" ").filter(e => e !== selector).join(" "));
            }
          };
          break;
        case "id":
          ElementHandler.element = async (element: Element) => {
            const content = await replacer.replacerFunction(element, optionals);
            element.replace(content, {html: replacer.isHTML});
            if(replacer.removeSelector) element.removeAttribute("id");
          };
          break;
      }
      rewriter.on(replacer[0], ElementHandler);
    }
    if(this.deleteComments) rewriter.onDocument({comments: (c: Comment) => {
      c.remove();
    }});
    return rewriter.transform(body);
  }
};