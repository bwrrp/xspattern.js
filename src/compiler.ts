import { Assembler } from 'whynot';
import { RegExp, Branch, Piece, Atom } from './ast';

type RegExpAssembler = Assembler<number, void>;

function compileAtom(assembler: RegExpAssembler, atom: Atom): void {
	switch (atom.kind) {
		case 'predicate': {
			// Value is a predicate function for some character class
			assembler.test(atom.value);
			return;
		}

		case 'regexp':
			// Value is a nested RegExp
			compileRegExp(assembler, atom.value, false);
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
	branch.forEach((piece) => {
		compilePiece(assembler, piece);
	});
}

export function compileRegExp(
	assembler: RegExpAssembler,
	regExp: RegExp,
	matchSubstring: boolean
): void {
	const start = assembler.program.length;

	// Disjunction of branches
	const fork = assembler.jump([]);

	// If we are compiling an XPath-style pattern, add a set of jumps and accepts to add the 'match
	// anywhere' behavior at the start.
	if (matchSubstring) {
		fork.data.push(assembler.program.length);
		assembler.test(() => true);
		assembler.jump([start]);
	}

	// TODO: I should really export Instruction from whynot...
	const joins: typeof fork[] = [];
	regExp.forEach((branch) => {
		fork.data.push(assembler.program.length);
		compileBranch(assembler, branch);
		joins.push(assembler.jump([]));
	});
	joins.forEach((join) => {
		join.data.push(assembler.program.length);
	});

	// Add a jump and all-accepting test for the 'end' of the program to add the 'match anything'
	// behavior at the end.
	if (matchSubstring) {
		const beforeFork = assembler.program.length;
		const forkForEnd = assembler.jump([]);
		forkForEnd.data.push(assembler.program.length);
		// Allow everything
		assembler.test(() => true);
		// And allow it multiple times
		assembler.jump([beforeFork]);
		// Or skip it completely
		forkForEnd.data.push(assembler.program.length);
	}
}
