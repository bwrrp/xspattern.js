import { RegExp, Branch, Piece, Atom } from './ast';
import sets from './sets';

function isAtomSupported(atom: Atom): boolean {
	switch (atom.kind) {
		case 'codepoint':
			return true;

		case 'predicate': {
			const predicate = atom.value(sets);
			return predicate !== undefined;
		}

		case 'regexp':
			return isRegExpSupported(atom.value);
	}
}

function isPieceSupported(piece: Piece): boolean {
	const [atom, _quantifier] = piece;
	// All quantifiers are supported
	return isAtomSupported(atom);
}

function isBranchSupported(branch: Branch): boolean {
	return branch.every(isPieceSupported);
}

export function isRegExpSupported(regExp: RegExp): boolean {
	return regExp.every(isBranchSupported);
}
