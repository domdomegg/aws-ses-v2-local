import Handlebars from 'handlebars';

// Values may be strings, numbers, nested objects, or arrays (the latter for {{#each}} and dotted paths).
export type TemplateData = Record<string, unknown>;

export class TemplateRenderError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'TemplateRenderError';
	}
}

/**
 * By default a missing variable renders as an empty string and the send succeeds,
 * matching SES (which accepts the request and reports rendering failures
 * asynchronously). Set AWS_SES_STRICT_TEMPLATE_RENDERING=true to fail fast instead —
 * a deliberate, SES-divergent local debugging aid. See the README.
 */
export const strictTemplateRenderingEnabled = (): boolean => process.env.AWS_SES_STRICT_TEMPLATE_RENDERING === 'true';

// Isolated instance: no HTML escaping (SES renders raw) and only built-in helpers (SES forbids custom ones).
const hb = Handlebars.create();

// Pass the original Handlebars message through rather than rewriting it, which previously
// misreported unknown helpers as missing data attributes and coupled us to Handlebars' wording.
const toRenderError = (error: unknown): TemplateRenderError => new TemplateRenderError(error instanceof Error ? error.message : String(error));

export type RenderOptions = {
	strict?: boolean;
};

/**
 * Compile a template source once and return a render function. Parses exactly once:
 * hb.parse validates syntax eagerly (malformed templates throw here) and hb.compile reuses that AST.
 *
 * @throws {TemplateRenderError} for a malformed template, or a missing variable when strict.
 */
export const compileTemplate = (source: string, options: RenderOptions = {}): ((data: TemplateData) => string) => {
	let render: HandlebarsTemplateDelegate<TemplateData>;
	try {
		render = hb.compile<TemplateData>(hb.parse(source), {strict: options.strict ?? false, noEscape: true});
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

export const renderTemplate = (source: string, data: TemplateData, options?: RenderOptions): string => compileTemplate(source, options)(data);

export type TemplateParts = {
	Subject?: string | undefined;
	Html?: string | undefined;
	Text?: string | undefined;
};

// Compile a template's three parts once into a single per-data renderer, shared by the send paths.
export const compileTemplateParts = (parts: TemplateParts, options: RenderOptions = {}): ((data: TemplateData) => {subject: string; html: string; text: string}) => {
	const renderSubject = compileTemplate(parts.Subject ?? '', options);
	const renderHtml = compileTemplate(parts.Html ?? '', options);
	const renderText = compileTemplate(parts.Text ?? '', options);
	return (data: TemplateData) => ({
		subject: renderSubject(data),
		html: renderHtml(data),
		text: renderText(data),
	});
};

// Parse a TemplateData/ReplacementTemplateData JSON string; returns {} when empty and an Error (not thrown) for invalid input.
export const parseTemplateData = (templateData: string | undefined, fieldName = 'TemplateData'): TemplateData | Error => {
	if (!templateData) {
		return {};
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(templateData);
	} catch (error: unknown) {
		return new Error(`Failed to parse ${fieldName}: ${String(error)}`);
	}

	if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
		return new Error(`${fieldName} must be a JSON object`);
	}

	return parsed as TemplateData;
};
