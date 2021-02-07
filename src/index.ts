import { compileVM } from 'whynot';
import { INPUT_END_SENTINEL, INPUT_START_SENTINEL } from './basic-sets';
import { compileRegExp } from './compiler';
import { generateParser } from './parser';

function toCodePoints(str: string): number[] {
	return [...str].map((c) => c.codePointAt(0)!);
}

/**
 * A function used to validate strings against the pattern it represents. Accepts a single string
 * and returns a boolean indicating whether it matches the pattern.
 *
 * @public
 */
export type MatchFn = (str: string) => boolean;

/**
 * Options to control pattern compilation.
 *
 * Currently, only a language option is supported, defaulting to 'xsd'. Set this to 'xpath' to
 * compile the pattern with XPath syntax and semantics. Note that not all XPath-specific features
 * are currently supported. See https://github.com/bwrrp/xspattern.js/issues/9 for details.
 *
 * @public
 */
export type Options = {
	language: 'xsd' | 'xpath';
};

/**
 * Compiles the given pattern into a matching function. The returned function accepts a single
 * string and returns true iff the pattern matches it.
 *
 * @public
 *
 * @param pattern - Pattern to compile
 * @param options - Additional options for the compiler
 *
 * @returns a matcher function for the given pattern
 */
export function compile(pattern: string, options: Options = { language: 'xsd' }): MatchFn {
	const ast = generateParser(options)(pattern);

	const vm = compileVM<number>((assembler) => {
		compileRegExp(assembler, ast, options.language === 'xpath');
		assembler.accept();
	});

	return function match(str: string): boolean {
		const codepoints =
			options.language === 'xpath'
				? [INPUT_START_SENTINEL, ...toCodePoints(str), INPUT_END_SENTINEL]
				: toCodePoints(str);
		return vm.execute(codepoints).success;
	};
}
