import { compileVM } from 'whynot';
import * as parser from '../lib/parser';

export function compile(pattern: string) {
	const ast = parser.parse(pattern);
	return ast;
}
