import { compileVM } from 'whynot';
import { compileRegExp } from './compiler';
import { parse } from './parser';

function toCodePoints(str: string): number[] {
	return [...str].map(c => c.codePointAt(0)!);
}

export type MatchFn = (str: string) => boolean;

/**
 * @param pattern Pattern to compile
 *
 * @return a matcher function, or null if the pattern uses unsupported features
 */
export function compile(pattern: string): MatchFn {
	const ast = parse(pattern);

	const vm = compileVM<number>(assembler => {
		compileRegExp(assembler, ast);
		assembler.accept();
	});

	return function match(str: string): boolean {
		return vm.execute(toCodePoints(str)).success;
	};
}
