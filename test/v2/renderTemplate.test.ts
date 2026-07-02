import {test, expect} from 'vitest';
import {
	compileTemplate, parseTemplateData, renderTemplate, TemplateRenderError,
} from '../../src/v2/renderTemplate';

test('substitutes simple and whitespace-padded variables', () => {
	expect(renderTemplate('Hi {{name}} and {{ other }}', {name: 'A', other: 'B'})).toBe('Hi A and B');
});

test('does not HTML-escape values (SES parity)', () => {
	expect(renderTemplate('{{v}}', {v: '<b>&amp;</b>'})).toBe('<b>&amp;</b>');
	// Triple-stache is redundant under noEscape but must still work.
	expect(renderTemplate('{{{v}}}', {v: '<i>x</i>'})).toBe('<i>x</i>');
});

test('resolves nested/dotted paths', () => {
	expect(renderTemplate('{{user.name}}', {user: {name: 'Zoe'}})).toBe('Zoe');
});

test('iterates arrays with #each', () => {
	expect(renderTemplate('{{#each items}}[{{this}}]{{/each}}', {items: ['a', 'b']})).toBe('[a][b]');
});

test('supports #if/#else and #unless', () => {
	expect(renderTemplate('{{#if on}}Y{{else}}N{{/if}}', {on: false})).toBe('N');
	expect(renderTemplate('{{#unless on}}Z{{/unless}}', {on: false})).toBe('Z');
});

test('throws TemplateRenderError naming a missing direct variable', () => {
	let caught: unknown;
	try {
		renderTemplate('Hi {{name}}', {});
	} catch (error: unknown) {
		caught = error;
	}

	expect(caught).toBeInstanceOf(TemplateRenderError);
	expect((caught as TemplateRenderError).attribute).toBe('name');
	expect((caught as TemplateRenderError).message).toContain('attribute \'name\'');
});

test('does not throw for a guarded missing variable', () => {
	expect(renderTemplate('{{#if missing}}X{{/if}}', {})).toBe('');
	expect(renderTemplate('{{#each missing}}X{{/each}}', {})).toBe('');
});

test('compileTemplate compiles once and renders many times', () => {
	const render = compileTemplate('Hello {{name}}');
	expect(render({name: 'A'})).toBe('Hello A');
	expect(render({name: 'B'})).toBe('Hello B');
});

test('compileTemplate throws TemplateRenderError for a malformed template (compile-time)', () => {
	expect(() => compileTemplate('{{#if x}}unclosed')).toThrow(TemplateRenderError);
});

test('supports #with', () => {
	expect(renderTemplate('{{#with u}}{{n}}{{/with}}', {u: {n: 'Q'}})).toBe('Q');
});

test('strips comments', () => {
	expect(renderTemplate('A{{! inline }}B{{!-- block --}}C', {})).toBe('ABC');
});

test('exposes @index and @key inside #each', () => {
	expect(renderTemplate('{{#each xs}}{{@index}}:{{this}};{{/each}}', {xs: ['a', 'b']})).toBe('0:a;1:b;');
	expect(renderTemplate('{{#each o}}{{@key}}={{this}};{{/each}}', {o: {a: '1', b: '2'}})).toBe('a=1;b=2;');
});

test('supports inline partials', () => {
	expect(renderTemplate('{{#*inline "row"}}[{{.}}]{{/inline}}{{#each xs}}{{> row}}{{/each}}', {xs: ['x', 'y']})).toBe('[x][y]');
});

test('does not provide custom helpers (unregistered helper throws)', () => {
	expect(() => renderTemplate('{{myHelper x}}', {x: 1})).toThrow(TemplateRenderError);
});

test('parseTemplateData returns an object, {} for empty, and Error for bad input', () => {
	expect(parseTemplateData(JSON.stringify({a: 1}))).toEqual({a: 1});
	expect(parseTemplateData(undefined)).toEqual({});
	expect(parseTemplateData('')).toEqual({});
	expect(parseTemplateData('not json')).toBeInstanceOf(Error);
	expect(parseTemplateData('[1,2]')).toBeInstanceOf(Error); // arrays are not valid top-level TemplateData
	expect(parseTemplateData('"a string"')).toBeInstanceOf(Error);
});
