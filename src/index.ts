import { compileVM } from 'whynot';
import { compileRegExp } from './compiler';
import { generateParser } from './parser';

function toCodePoints(str: string): number[] {
	return [...str].map(c => c.codePointAt(0)!);
}

export type MatchFn = (str: string) => boolean;

export type Options = {
	language: 'xsd' | 'xpath';
};

/**
 * @param pattern Pattern to compile
 * @param options Additional options for the compiler
 *
 * @return a matcher function, or null if the pattern uses unsupported features
 */
export function compile(pattern: string, options: Options = { language: 'xsd' }): MatchFn {
	let ast = generateParser(options)(pattern);

	const vm = compileVM<number>(assembler => {
		compileRegExp(assembler, ast);
		assembler.accept();
	});

	return function match(str: string): boolean {
		const codepoints =
			options.language === 'xpath' ? [-1, ...toCodePoints(str), -2] : toCodePoints(str);
		return vm.execute(codepoints).success;
	};
}
