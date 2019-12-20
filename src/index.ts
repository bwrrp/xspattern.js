import { compileVM } from 'whynot';
import { INPUT_END_SENTINAL, INPUT_START_SENTINAL } from './basic-sets';
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
	const ast = generateParser(options)(pattern);

	const vm = compileVM<number>(assembler => {
		compileRegExp(assembler, ast, options.language === 'xpath');
		assembler.accept();
	});

	return function match(str: string): boolean {
		const codepoints =
			options.language === 'xpath'
				? [INPUT_START_SENTINAL, ...toCodePoints(str), INPUT_END_SENTINAL]
				: toCodePoints(str);
		return vm.execute(codepoints).success;
	};
}
