import { compile } from '../src/index';

function check(pattern: string, examples: string[], counterExamples: string[] = []) {
	const match = compile(pattern);
	examples.forEach(str => {
		expect(match(str)).toBe(true);
	});
	counterExamples.forEach(str => {
		expect(match(str)).toBe(false);
	});
}

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
		// TODO: clean up errors thrown by the PEG parser?
		expect(() => compile('\\')).toThrow();
		expect(() => compile('a{3,2}')).toThrow('quantifier range is in the wrong order');
	});

	it('supports quantifiers', () => {
		check('a', ['a'], ['', 'aa']);
		check('a?', ['', 'a'], ['aa']);
		check('a*', ['', 'a', 'aa', 'aaaaa'], ['aaaaab']);
		check('a+', ['a', 'aa', 'aaaaa'], ['', 'aaaaab']);
		check('a{2,3}', ['aa', 'aaa'], ['', 'a', 'aaaa']);
		check('a{2,}', ['aa', 'aaa', 'aaaaa'], ['', 'a']);
		check('a{2}', ['aa'], ['', 'a', 'aaa', 'aaaaa']);
		check('a{0,2}', ['', 'a', 'aa'], ['aaa', 'aaaaa']);
		check('a{0,0}', [''], ['a', 'aa', 'aaa', 'b']);
	});
});
