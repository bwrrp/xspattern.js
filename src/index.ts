import { compileVM } from 'whynot';
import * as parser from '../lib/parser';
import { compileRegExp } from './compiler';
import { isRegExpSupported } from './checker';
import { RegExp } from './ast';

function toCodePoints(str: string): number[] {
	return [...str].map(c => c.codePointAt(0)!);
}

export type MatchFn = (str: string) => boolean;

/**
 * @param pattern Pattern to compile
 *
 * @return a matcher function, or null if the pattern uses unsupported features
 */
export function compile(pattern: string): MatchFn | null {
	const ast = parser.parse(pattern) as RegExp;

	if (!isRegExpSupported(ast)) {
		return null;
	}

	const vm = compileVM<number>(assembler => {
		compileRegExp(assembler, ast);
		assembler.accept();
	});

	return function match(str: string): boolean {
		return vm.execute(toCodePoints(str)).success;
	};
}
