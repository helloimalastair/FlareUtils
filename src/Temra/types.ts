type ReplaceFunction<Environment = unknown, Optionals = unknown> = (
	e: Element,
	optionals?: TransformationOptionals<Environment, Optionals>,
) => Promise<string> | string;

type SelectorType = "tagName" | "className" | "id" | "attribute" | "universal";

interface AddOptions<Environment, Optionals> {
	replacerFunction?: ReplaceFunction<Environment, Optionals>;
	selectorType?: SelectorType;
	attributeValue?: string;
	removeSelector?: boolean;
}

interface Replacer<Environment, Optionals> {
	type: SelectorType;
	attributeValue?: string;
	delete?: boolean;
	replacerFunction?: ReplaceFunction<Environment, Optionals>;
	isHTML?: boolean;
	removeSelector?: boolean;
}

interface TransformationOptionals<Environment = unknown, Optionals = unknown> {
	env?: Environment;
	req?: Request;
	other?: Optionals;
}

export {
	ReplaceFunction,
	SelectorType,
	AddOptions,
	Replacer,
	TransformationOptionals,
};
