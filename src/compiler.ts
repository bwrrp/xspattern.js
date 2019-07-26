import { Assembler } from 'whynot';
import { RegExp, Branch, Piece, Atom } from './ast';

type RegExpAssembler = Assembler<number, void>;

function compileAtom(assembler: RegExpAssembler, atom: Atom): void {
	switch (atom.kind) {
		case 'codepoint':
			// Single code point to test
			assembler.test(num => num === atom.value);
			return;

		case 'predicate':
			// Predicate function for some character class
			assembler.test(atom.value);
			return;

		case 'regexp':
			// Nested RegExp
			compileRegExp(assembler, atom.value);
			return;

		case 'unsupported':
			// Not supported, should not have reached this point
			throw new Error('Not implemented');
	}
}

function compilePiece(assembler: RegExpAssembler, piece: Piece): void {
	// Atom and quantifier
	const [atomAst, { min, max }] = piece;
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

function compileBranch(assembler: RegExpAssembler, branch: Branch): void {
	// Sequence of pieces
	branch.forEach(piece => {
		compilePiece(assembler, piece);
	});
}

export function compileRegExp(assembler: RegExpAssembler, regExp: RegExp): void {
	// Disjunction of branches
	const fork = assembler.jump([]);
	// TODO: I should really export Instruction from whynot...
	const joins: (typeof fork)[] = [];
	regExp.forEach(branch => {
		fork.data.push(assembler.program.length);
		compileBranch(assembler, branch);
		joins.push(assembler.jump([]));
	});
	joins.forEach(join => {
		join.data.push(assembler.program.length);
	});
}
