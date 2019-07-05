import { compileVM, Assembler, VM } from 'whynot';
import * as parser from '../lib/parser';

type RegExpAssembler = Assembler<number, void>;
type ASTNode = any;

function compileAtom(assembler: RegExpAssembler, ast: ASTNode): void {
	if (Array.isArray(ast)) {
		throw new Error('Not implemented');
	}

	// NormalChar
	const codepoint = ast.codePointAt(0);
	assembler.test(num => num === codepoint);
}

function compilePiece(assembler: RegExpAssembler, ast: ASTNode[]): void {
	// Atom and quantifier
	const [atomAst, quantifier] = ast;
	switch (quantifier) {
		case null:
			compileAtom(assembler, atomAst);
			return;

		default:
			// TODO: implement other options
			throw new Error('Not implemented');
	}
}

function compileBranch(assembler: RegExpAssembler, ast: ASTNode[]): void {
	// Sequence of pieces
	ast.forEach(ast => {
		compilePiece(assembler, ast);
	});
}

function compileRegExp(assembler: RegExpAssembler, ast: ASTNode[]): void {
	// Disjunction of branches
	const fork = assembler.jump([]);
	// TODO: I should really export Instruction from whynot...
	const joins: (typeof fork)[] = [];
	ast.forEach(ast => {
		fork.data.push(assembler.program.length);
		compileBranch(assembler, ast);
		joins.push(assembler.jump([]));
	});
	joins.forEach(join => {
		join.data.push(assembler.program.length);
	});
}

function toCodePoints(str: string): number[] {
	return [...str].map(c => c.codePointAt(0)!);
}

export function compile(pattern: string): (str: string) => boolean {
	const ast = parser.parse(pattern);

	const vm = compileVM<number>(assembler => {
		compileRegExp(assembler, ast);
		assembler.accept();
	});

	return function match(str: string): boolean {
		return vm.execute(toCodePoints(str)).success;
	};
}
