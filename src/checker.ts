import { RegExp, Branch, Piece, Atom } from './ast';

function isAtomSupported(atom: Atom): boolean {
	switch (atom.kind) {
		case 'codepoint':
		case 'predicate':
			return true;

		case 'regexp':
			return isRegExpSupported(atom.value);

		case 'unsupported':
			return false;
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
