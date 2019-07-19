import { compile } from '../src/index';

expect.extend({
	toBeMatchedBy(str: string, matcher: (str: string) => boolean) {
		if (matcher(str)) {
			return {
				message: () => `Input "${str}" should not match`,
				pass: true
			};
		} else {
			return {
				message: () => `Input "${str}" should match`,
				pass: false
			};
		}
	}
});

function check(pattern: string, examples: string[], counterExamples: string[] = []) {
	const match = compile(pattern);
	examples.forEach(str => {
		expect(str).toBeMatchedBy(match);
	});
	counterExamples.forEach(str => {
		expect(str).not.toBeMatchedBy(match);
	});
}

describe('xspattern', () => {
	it('can compile a pattern', () => {
		const match = compile('a|b');
		expect('a').toBeMatchedBy(match);
		expect('b').toBeMatchedBy(match);
		expect('').not.toBeMatchedBy(match);
		expect('c').not.toBeMatchedBy(match);
		expect('aa').not.toBeMatchedBy(match);
	});

	it('throws if the pattern is not valid', () => {
		// TODO: clean up errors thrown by the PEG parser?
		expect(() => compile('\\')).toThrow();
		expect(() => compile('a{3,2}')).toThrow('quantifier range is in the wrong order');
		expect(() => compile('[^]')).toThrow();
		expect(() => compile('[--z]')).toThrow(
			'unescaped hyphen may not be used as a range endpoint'
		);
	});

	it('supports basic branch / piece combinations', () => {
		check('ab|cde|', ['ab', 'cde', ''], ['a', 'abc', 'de', 'abcde']);
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

	it('handles surrogate pairs', () => {
		check('💩', ['💩', '\uD83D\uDCA9'], ['\uD83D', '\uDCA9']);
	});

	it('supports single-character escapes', () => {
		check('\\n', ['\n'], ['\r', '\r\n', '\\n']);
		check('\\r', ['\r'], ['\n', '\r\n', '\\r']);
		check('\\t', ['\t'], [' ', '    ']);
		check('\\\\', ['\\'], ['\\\\']);
		check('\\|', ['|'], ['\\']);
		check('\\.', ['.'], ['\\', 'a']);
		check('\\-', ['-'], ['\\']);
		check('\\^', ['^'], ['\\']);
		check('\\?', ['?'], ['\\', '']);
		check('\\*', ['*'], ['\\']);
		check('\\+', ['+'], ['\\']);
		check('\\{', ['{'], ['\\']);
		check('\\}', ['}'], ['\\']);
		check('\\(', ['('], ['\\']);
		check('\\)', [')'], ['\\']);
		check('\\[', ['['], ['\\']);
		check('\\]', [']'], ['\\']);
	});

	it('supports positive character groups', () => {
		check('[asd]', ['a', 's', 'd'], ['f', 'g', 'h']);
		check('[💣💰💩]', ['💣', '💰', '💩'], ['💚', '\uD83D', '\uDCA9']);
	});

	it('supports negative character groups', () => {
		check('[^x]', ['y'], ['x']);
		check('[^^asd]', ['f', 'g', 'h'], ['^', 'a', 's', 'd']);
	});

	it('supports character ranges', () => {
		check('[a-z]', ['a', 'g', 'z'], ['', 'aa', 'A', 'G', 'Z']);
		check('[a-zA-Z]', ['a', 'g', 'z', 'A', 'G', 'Z'], ['', ' ', '8']);
		check('[💣-💰]', ['💩'], ['💚']);
		check('[a-]', ['a', '-'], ['b']);
		check('[a-k-z]', ['a', 'c', '-', 'z'], ['l', 'x', 'y']);
	});

	it('supports character group subtraction', () => {
		check('[abcd-[cdef]]', ['a', 'b'], ['c', 'd', 'e', 'f', 'g']);
		check('[a-z-[aeoui]]', ['b', 'd', 'z'], ['a', 'u', 'o']);
		check('[a--[a]]', ['-'], ['a', 'b']);
	});

	it('supports the "." wildcard', () => {
		check('.', ['a', 'x', '\n'], ['', 'aa']);
	});
});
