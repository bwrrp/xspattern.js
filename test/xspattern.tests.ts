import { compile, MatchFn } from '../src/index';

declare global {
	namespace jest {
		interface Matchers<R, T = {}> {
			toBeMatchedBy(matcher: (str: string) => boolean, pattern: string): void;
		}
	}
}

expect.extend({
	toBeMatchedBy(str: string, matcher: MatchFn, pattern: string) {
		if (matcher(str)) {
			return {
				message: () => `Input "${str}" should not match pattern "${pattern}"`,
				pass: true
			};
		} else {
			return {
				message: () => `Input "${str}" should match pattern "${pattern}"`,
				pass: false
			};
		}
	}
});

function check(pattern: string, examples: string[], counterExamples: string[] = [], xpath = false) {
	const match = compile(pattern, { language: xpath ? 'xpath' : 'xsd' });
	expect(match).not.toBeNull();
	examples.forEach(str => {
		expect(str).toBeMatchedBy(match, pattern);
	});
	counterExamples.forEach(str => {
		expect(str).not.toBeMatchedBy(match, pattern);
	});
}

describe('xspattern', () => {
	describe('xpath', () => {
		it('can match substrings instead of full strings', () => {
			const match = compile('a|b', { language: 'xpath' });
			expect('xxxa').toBeMatchedBy(match, 'a|b');
			expect('axxx').toBeMatchedBy(match, 'a|b');
			expect('xxxaxxx').toBeMatchedBy(match, 'a|b');
			expect('xxxbxxx').toBeMatchedBy(match, 'a|b');
			expect('xxxyxxx').not.toBeMatchedBy(match, 'a|b');
		});

		it('can match the start of the string with "^"', () => {
			const match = compile('^a', { language: 'xpath' });
			expect('abc').toBeMatchedBy(match, '^a');
			expect('a').toBeMatchedBy(match, '^a');
			expect('b').not.toBeMatchedBy(match, '^a');
			expect('ba').not.toBeMatchedBy(match, '^a');
		});

		it('can match the end of the string with "$"', () => {
			const match = compile('a$', { language: 'xpath' });
			expect('a').toBeMatchedBy(match, 'a$');
			expect('ba').toBeMatchedBy(match, 'a$');
			expect('b').not.toBeMatchedBy(match, 'a$');
			expect('ab').not.toBeMatchedBy(match, 'a$');
		});

		it('can match the end of the string halfway a pattern', () => {
			const match = compile('a($|x)', { language: 'xpath' });
			expect('a').toBeMatchedBy(match, 'a($|x)');
			expect('ba').toBeMatchedBy(match, 'a($|x)');
			expect('ax').toBeMatchedBy(match, 'a($|x)');
			expect('b').not.toBeMatchedBy(match, 'a($|x)');
			expect('ab').not.toBeMatchedBy(match, 'a($|x)');
		});

		it('can escape "^"', () => {
			const match = compile('a\\^', { language: 'xpath' });
			expect('a^').toBeMatchedBy(match, 'a\\^');
			expect('xa^x').toBeMatchedBy(match, 'a\\^');
			expect('a').not.toBeMatchedBy(match, 'a\\^');
			expect('ax').not.toBeMatchedBy(match, 'a\\^');
			expect('b').not.toBeMatchedBy(match, 'a\\^');
			expect('ab').not.toBeMatchedBy(match, 'a\\^');
		});

		it('can escape "$"', () => {
			const match = compile('a\\$', { language: 'xpath' });
			expect('a$').toBeMatchedBy(match, 'a\\$');
			expect('xa$x').toBeMatchedBy(match, 'a\\$');
			expect('a').not.toBeMatchedBy(match, 'a\\$');
			expect('ax').not.toBeMatchedBy(match, 'a\\$');
			expect('b').not.toBeMatchedBy(match, 'a\\$');
			expect('ab').not.toBeMatchedBy(match, 'a\\$');
		});

		it('allows "(?:)" for non-capturing groups', () => {
			const match = compile('(?:a|b)?c', { language: 'xpath' });
			expect('ac').toBeMatchedBy(match, '(?:a|b)?c');
			expect('bc').toBeMatchedBy(match, '(?:a|b)?c');
			expect('c').toBeMatchedBy(match, '(?:a|b)?c');
			expect('a').not.toBeMatchedBy(match, '(?:a|b)?c');
			expect('b').not.toBeMatchedBy(match, '(?:a|b)?c');
			expect('x').not.toBeMatchedBy(match, '(?:a|b)?c');
		});
	});

	it('can compile a pattern', () => {
		const match = compile('a|b');
		expect('a|b').not.toBeMatchedBy(match, 'a|b');
		expect('a').toBeMatchedBy(match, 'a|b');
		expect('b').toBeMatchedBy(match, 'a|b');
		expect('').not.toBeMatchedBy(match, 'a|b');
		expect('c').not.toBeMatchedBy(match, 'a|b');
		expect('aa').not.toBeMatchedBy(match, 'a|b');
	});

	it('throws if the pattern is not valid', () => {
		// TODO: clean up errors thrown by the PEG parser?
		expect(() => compile('\\')).toThrow('Error parsing pattern "\\" at offset 0');
		expect(() => compile('a{3,2}')).toThrow(
			'Error parsing pattern "a{3,2}": quantifier range is in the wrong order'
		);
		expect(() => compile('[^]')).toThrow('Error parsing pattern "[^]" at offset 2');
		expect(() => compile('[--z]')).toThrow(
			'Error parsing pattern "[--z]": unescaped hyphen may not be used as a range endpoint'
		);
		expect(() => compile('[z--]')).toThrow(
			'Error parsing pattern "[z--]": unescaped hyphen may not be used as a range endpoint'
		);
		expect(() => compile('\\1')).toThrow('Error parsing pattern "\\1" at offset 0');
		expect(() => compile('[\\p]')).toThrow('Error parsing pattern "[\\p]" at offset 2');
		expect(() => compile('[X-\\D]')).toThrow('Error parsing pattern "[X-\\D]" at offset 4');
		expect(() => compile('[z-a]')).toThrow(
			'Error parsing pattern "[z-a]": character range is in the wrong order'
		);
	});

	it('supports basic branch / piece combinations', () => {
		check('ab|cde|', ['ab', 'cde', ''], ['a', 'abc', 'de', 'abcde']);
	});

	it('supports nested regexps', () => {
		check('a(b|c)d', ['abd', 'acd'], ['abc', 'abcd']);
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
		check(
			'a{10,20}',
			['aaaaaaaaaa', 'aaaaaaaaaaaa', 'aaaaaaaaaaaaaaaaaaaa'],
			['a', 'aaaaaaaaa', 'aaaaaaaaaaaaaaaaaaaaa', 'b']
		);
	});

	it('supports reluctant quantifiers in xpath mode', () => {
		check('^a??$', ['', 'a'], ['aa'], true);
		check('^a*?$', ['', 'a', 'aa', 'aaaaa'], ['aaaaab'], true);
		check('^a+?$', ['a', 'aa', 'aaaaa'], ['', 'aaaaab'], true);
		check('^a{2,3}?$', ['aa', 'aaa'], ['', 'a', 'aaaa'], true);
		check('^a{2,}?$', ['aa', 'aaa', 'aaaaa'], ['', 'a'], true);
		check('^a{2}?$', ['aa'], ['', 'a', 'aaa', 'aaaaa'], true);
		check('^a{0,2}?$', ['', 'a', 'aa'], ['aaa', 'aaaaa'], true);
		check('^a{0,0}?$', [''], ['a', 'aa', 'aaa', 'b'], true);
		check(
			'^a{10,20}?$',
			['aaaaaaaaaa', 'aaaaaaaaaaaa', 'aaaaaaaaaaaaaaaaaaaa'],
			['a', 'aaaaaaaaa', 'aaaaaaaaaaaaaaaaaaaaa', 'b'],
			true
		);
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

		// All should work the same in XPath
		check('^\\n$', ['\n'], ['\r', '\r\n', '\\n'], true);
		check('^\\r$', ['\r'], ['\n', '\r\n', '\\r'], true);
		check('^\\t$', ['\t'], [' ', '    '], true);
		check('^\\\\$', ['\\'], ['\\\\'], true);
		check('^\\|$', ['|'], ['\\'], true);
		check('^\\.$', ['.'], ['\\', 'a'], true);
		check('^\\-$', ['-'], ['\\'], true);
		check('^\\^$', ['^'], ['\\'], true);
		check('^\\?$', ['?'], ['\\', ''], true);
		check('^\\*$', ['*'], ['\\'], true);
		check('^\\+$', ['+'], ['\\'], true);
		check('^\\{$', ['{'], ['\\'], true);
		check('^\\}$', ['}'], ['\\'], true);
		check('^\\($', ['('], ['\\'], true);
		check('^\\)$', [')'], ['\\'], true);
		check('^\\[$', ['['], ['\\'], true);
		check('^\\]$', [']'], ['\\'], true);
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
		check('[\\d-[5]]', [], ['a', 'b']);
		check('[abcd-[cdef]]', ['a', 'b'], ['c', 'd', 'e', 'f', 'g']);
		check('[a-z-[aeoui]]', ['b', 'd', 'z'], ['a', 'u', 'o']);
		check('[a--[a]]', ['-'], ['a', 'b']);
		check('a[^b]', ['a ', 'ax', 'abaxb'], ['a', 'ab', 'abc'], true);
	});

	it('throws the correct error when it sees backreferences', () => {
		// check('([ab])[^ab]*\\1', ['axa', 'bxb'], ['a', 'b', 'axb', 'bxa', 'aba']);
		expect(() => compile('([ab])[^ab]*\\1', { language: 'xpath' })).toThrow(
			/Backreferences in XPath patterns are not yet implemented/
		);
		expect(() => compile('([ab])[^ab]*\\10', { language: 'xpath' })).toThrow(
			/Backreferences in XPath patterns are not yet implemented/
		);
	});

	it('throws the correct error when it sees backreferences in xsd mode', () => {
		// check('([ab])[^ab]*\\1', ['axa', 'bxb'], ['a', 'b', 'axb', 'bxa', 'aba']);
		expect(() => compile('([ab])[^ab]*\\1', { language: 'xsd' })).toThrow(
			/Error parsing pattern /
		);
		expect(() => compile('([ab])[^ab]*\\10', { language: 'xsd' })).toThrow(
			/Error parsing pattern /
		);
	});

	describe('multi-character escapes', () => {
		it('supports \\s', () => {
			check('\\s', [' ', '\n', '\r', '\t'], ['a', '\u{2000}', '  ']);
		});

		it('supports \\S', () => {
			check('\\S', ['a', '\u{2000}'], [' ', '\n', '\r', '\t', '  ']);
		});

		it('supports \\i', () => {
			check('\\i', ['a', '_'], ['0', '-']);
		});

		it('supports \\I', () => {
			check('\\I', ['0', '-'], ['a', '_']);
		});

		it('supports \\c', () => {
			check('\\c', ['a', '_', '0', '-'], ['\r']);
		});

		it('supports \\C', () => {
			check('\\C', ['\r'], ['a', '_', '0', '-']);
		});

		it('supports \\d', () => {
			check('\\d', ['1', '9', '٨', '߈'], ['a', ' ', '①']);
		});

		it('supports \\D', () => {
			check('\\D', ['a', ' ', '①'], ['1', '9', '٨', '߈']);
		});

		it('supports \\w', () => {
			check('\\w', ['a', '①', '😀'], ['.', '-', ' ']);
		});

		it('supports \\W', () => {
			check('\\W', ['.', '-', ' '], ['a', '①', '😀']);
		});

		it('supports the "." wildcard', () => {
			check('.', ['a', 'x'], ['', 'aa', '\n', '\r']);
		});
	});

	describe('unicode character classes', () => {
		it('matches known unicode blocks', () => {
			check('\\p{IsBasicLatin}', ['a', 'Q'], ['好']);
			check('\\p{IsCJKUnifiedIdeographs}', ['好'], ['Z']);
			check('\\p{IsMiscellaneousSymbolsandPictographs}', ['💩'], ['☃']);
		});

		it('throws when passed unknown block in xpath mode', () => {
			expect(() => compile('\\p{IsPigLatin}', { language: 'xpath' })).toThrow(
				/The unicode block identifier "PigLatin" is not known/
			);
		});

		it("matches any character for a unicode block that doesn't exist", () => {
			check('\\p{IsPrrrt}', ['a', '1', '-', '\n', ' ']);
		});

		it('matches known unicode categories', () => {
			check('\\p{Ll}', ['a', 'x', 'z'], ['A', 'X', 'Z', '好', '💩']);
			check('\\p{Lu}', ['A', 'X', 'Z'], ['a', 'x', 'z', '好', '💩']);
			check('\\P{Ll}', ['A', 'X', 'Z', '好', '💩'], ['a', 'x', 'z']);
			check('\\P{Lu}', ['a', 'x', 'z', '好', '💩'], ['A', 'X', 'Z']);
		});

		it('matches combinations of unicode categories using the single-letter shorthand', () => {
			check('\\p{S}', ['💩', '₿', '+'], ['a', 'x', 'z', '好']);
			check('\\P{S}', ['a', 'x', 'z', '好'], ['💩', '₿', '+']);
		});

		it("throws if the pattern contains a unicode category that doesn't exist", () => {
			expect(() => compile('\\p{Bl}')).toThrow('Error parsing pattern "\\p{Bl}" at offset 3');
			expect(() => compile('\\p{Cs}')).toThrow('Error parsing pattern "\\p{Cs}" at offset 4');
		});
	});
});
