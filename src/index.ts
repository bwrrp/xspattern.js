import { compileVM, Assembler, VM } from 'whynot';
import * as parser from '../lib/parser';

type RegExpAssembler = Assembler<number, void>;
// TODO: better typing for AST nodes
type ASTNode = any;

function compileAtom(assembler: RegExpAssembler, ast: ASTNode): void {
	if (Array.isArray(ast)) {
		throw new Error('Not implemented');
	}

	// NormalChar returns its code point
	const codepoint = ast as number;
	assembler.test(num => num === codepoint);
}

function compilePiece(assembler: RegExpAssembler, ast: ASTNode[]): void {
	// Atom and quantifier
	const [atomAst, { min, max }] = ast as [ASTNode, { min: number; max: number }];
	if (max === null) {
		// Unbounded repetition
		if (min > 0) {
			for (let i = 0; i < min - 1; ++i) {
				compileAtom(assembler, atomAst);
			}
			// Efficient "1 or more" loop
			const start = assembler.program.length;
			compileAtom(assembler, atomAst);
			const fork = assembler.jump([start]);
			fork.data.push(assembler.program.length);
		} else {
			// Optional unbounded loop
			const start = assembler.program.length;
			const fork = assembler.jump([]);
			// Match and loop...
			fork.data.push(assembler.program.length);
			compileAtom(assembler, atomAst);
			assembler.jump([start]);
			// ...or skip
			fork.data.push(assembler.program.length);
		}
		return;
	}

	// Bounded repetition
	if (max < min) {
		throw new Error('Invalid pattern: quantifier range is in the wrong order');
	}
	for (let i = 0; i < min; ++i) {
		compileAtom(assembler, atomAst);
	}
	for (let i = min; i < max; ++i) {
		const fork = assembler.jump([]);
		// Match...
		fork.data.push(assembler.program.length);
		compileAtom(assembler, atomAst);
		// ...or skip
		fork.data.push(assembler.program.length);
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
