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
});
