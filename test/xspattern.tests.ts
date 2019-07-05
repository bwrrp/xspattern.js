import { compile } from '../src/index';

describe('xspattern', () => {
	it('can compile a pattern', () => {
		const match = compile('a|b');
		expect(match('a')).toBe(true);
		expect(match('b')).toBe(true);
		expect(match('')).toBe(false);
		expect(match('c')).toBe(false);
		expect(match('aa')).toBe(false);
	});

	it('throws if the pattern is not valid', () => {
		expect(() => compile('\\')).toThrow();
	});
});
