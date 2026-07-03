import {test, expect} from 'vitest';
import {
	compileTemplate, compileTemplateParts, parseTemplateData, renderTemplate, TemplateRenderError,
} from '../../src/v2/renderTemplate';

test('substitutes simple and whitespace-padded variables', () => {
	expect(renderTemplate('Hi {{name}} and {{ other }}', {name: 'A', other: 'B'})).toBe('Hi A and B');
});

test('does not HTML-escape values (SES parity)', () => {
	expect(renderTemplate('{{v}}', {v: '<b>&amp;</b>'})).toBe('<b>&amp;</b>');
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

test('renders a missing variable as empty by default (lenient / SES parity)', () => {
	expect(renderTemplate('Hi {{name}}', {})).toBe('Hi ');
});

test('throws TemplateRenderError for a missing variable in strict mode', () => {
	expect(() => renderTemplate('Hi {{name}}', {}, {strict: true})).toThrow(TemplateRenderError);
});

test('renders bare inverse/block sections with missing fields (SES parity)', () => {
	// Bare (non-helper) sections throw under strict mode but render fine on real SES.
	expect(renderTemplate('{{^premium}}upgrade today{{/premium}}', {})).toBe('upgrade today');
	expect(renderTemplate('{{#firstName}}{{firstName}}{{/firstName}}', {})).toBe('');
});

test('does not throw for a guarded missing variable', () => {
	expect(renderTemplate('{{#if missing}}X{{/if}}', {})).toBe('');
	expect(renderTemplate('{{#each missing}}X{{/each}}', {})).toBe('');
});

test('compileTemplate compiles once and renders many times', () => {
	const render = compileTemplate('Hi {{name}}');
	expect(render({name: 'A'})).toBe('Hi A');
	expect(render({name: 'B'})).toBe('Hi B');
});

test('compileTemplate throws TemplateRenderError for a malformed template (compile-time)', () => {
	expect(() => compileTemplate('{{#if x}}oops')).toThrow(TemplateRenderError);
});

test('compileTemplateParts renders subject/html/text together', () => {
	const render = compileTemplateParts({Subject: 'Hi {{n}}', Html: '<b>{{n}}</b>', Text: '{{n}}'});
	expect(render({n: 'A'})).toEqual({subject: 'Hi A', html: '<b>A</b>', text: 'A'});
});

test('supports #with', () => {
	expect(renderTemplate('{{#with user}}{{name}}{{/with}}', {user: {name: 'Q'}})).toBe('Q');
});

test('strips comments', () => {
	expect(renderTemplate('A{{! hidden }}B', {})).toBe('AB');
});

test('exposes @index inside #each', () => {
	expect(renderTemplate('{{#each items}}{{@index}}:{{this}} {{/each}}', {items: ['x', 'y']})).toBe('0:x 1:y ');
});

test('supports inline partials', () => {
	expect(renderTemplate('{{#*inline "p"}}Hi {{name}}{{/inline}}{{> p}}', {name: 'Z'})).toBe('Hi Z');
});

test('does not provide custom helpers (unregistered helper throws)', () => {
	expect(() => renderTemplate('{{myHelper x}}', {x: 1})).toThrow(TemplateRenderError);
});

test('parseTemplateData returns an object, {} for empty, and Error for bad input', () => {
	expect(parseTemplateData(JSON.stringify({a: 1}))).toEqual({a: 1});
	expect(parseTemplateData(undefined)).toEqual({});
	expect(parseTemplateData('')).toEqual({});
	expect(parseTemplateData('not json')).toBeInstanceOf(Error);
	expect(parseTemplateData('[1,2]')).toBeInstanceOf(Error);
	// fieldName is reflected in the error message (used to name ReplacementTemplateData).
	expect((parseTemplateData('[1,2]', 'ReplacementTemplateData') as Error).message).toContain('ReplacementTemplateData');
});
