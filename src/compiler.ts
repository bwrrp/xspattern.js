import { Assembler } from 'whynot';
import { RegExp, Branch, Piece, Atom } from './ast';
import sets from './sets';

type RegExpAssembler = Assembler<number, void>;

function compileAtom(assembler: RegExpAssembler, atom: Atom): void {
	switch (atom.kind) {
		case 'codepoint':
			// Value is a single code point to test
			assembler.test(sets.singleChar(atom.value));
			return;

		case 'predicate': {
			// Value is a factory that builds the predicate function for some character class
			const predicate = atom.value(sets);
			assembler.test(predicate);
			return;
		}

		case 'regexp':
			// Value is a nested RegExp
			compileRegExp(assembler, atom.value);
			return;
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
