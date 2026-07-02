import Handlebars from 'handlebars';

/**
 * Template data is an arbitrary JSON object: values may be strings, numbers,
 * booleans, nested objects, or arrays (arrays/objects are required for
 * {{#each}} and dotted-path access).
 */
export type TemplateData = Record<string, unknown>;

/**
 * Error thrown when a template cannot be rendered — either because the template
 * source is malformed, or because it references a variable that is missing from
 * the supplied template data. `attribute` holds the offending variable name when
 * it can be determined.
 */
export class TemplateRenderError extends Error {
	readonly attribute?: string | undefined;

	constructor(message: string, attribute?: string) {
		super(message);
		this.name = 'TemplateRenderError';
		this.attribute = attribute;
	}
}

/**
 * Isolated Handlebars environment used to render AWS SES email templates.
 *
 * AWS SES renders stored templates with Handlebars but with two behaviours that
 * differ from the Handlebars defaults, both reproduced here:
 *   - HTML escaping is disabled (SES substitutes values raw), and
 *   - referencing a variable that is missing from the data is a rendering
 *     failure rather than a silent empty string.
 *
 * An isolated instance (created via `Handlebars.create()`) exposes only the
 * built-in helpers — SES does not allow registering custom helpers — and avoids
 * mutating the global Handlebars environment.
 */
const hb = Handlebars.create();

// Handlebars strict-mode messages look like: `"name" not defined in [object Object] - 1:5`
// For a dotted path like `{{user.name}}`, Handlebars names only the leaf segment,
// so `attribute` resolves to `name` (not `user.name`).
const missingAttributePattern = /"([^"]+)" not defined/;

const toRenderError = (error: unknown): TemplateRenderError => {
	const message = error instanceof Error ? error.message : String(error);
	const attribute = missingAttributePattern.exec(message)?.[1];
	if (attribute !== undefined) {
		return new TemplateRenderError(`attribute '${attribute}' is not present in the template data`, attribute);
	}

	return new TemplateRenderError(message);
};

/**
 * Compile a template source string once and return a function that renders it
 * against template data. Compiling once and rendering many times is used by the
 * bulk send path, where the same template is applied to many recipients.
 *
 * @throws {TemplateRenderError} for a malformed template (at compile time) or a
 * missing variable (at render time).
 */
export const compileTemplate = (source: string): ((data: TemplateData) => string) => {
	let render: HandlebarsTemplateDelegate<TemplateData>;
	try {
		hb.parse(source); // Eager syntax validation — hb.compile is otherwise lazy and defers parsing to first render.
		render = hb.compile<TemplateData>(source, {strict: true, noEscape: true});
	} catch (error: unknown) {
		throw toRenderError(error);
	}

	return (data: TemplateData): string => {
		try {
			return render(data);
		} catch (error: unknown) {
			throw toRenderError(error);
		}
	};
};

/**
 * Compile and render a template in one call. Convenience for the single-send path.
 *
 * @throws {TemplateRenderError}
 */
export const renderTemplate = (source: string, data: TemplateData): string => compileTemplate(source)(data);

/**
 * Parse an AWS SES `TemplateData` / `ReplacementTemplateData` JSON string into a
 * plain object. Returns `{}` for an empty/absent value and an `Error` (rather
 * than throwing) for malformed JSON or a non-object top-level value.
 */
export const parseTemplateData = (templateData: string | undefined): TemplateData | Error => {
	if (!templateData) {
		return {};
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(templateData);
	} catch (error: unknown) {
		return new Error(`Failed to parse template data: ${String(error)}`);
	}

	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		return new Error('TemplateData must be a JSON object');
	}

	return parsed as TemplateData;
};
