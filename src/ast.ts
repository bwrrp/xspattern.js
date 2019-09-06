import { PredicateFactory } from './sets';
import { Codepoint } from './types';

export type Atom =
	| { kind: 'codepoint'; value: Codepoint }
	| { kind: 'predicate'; value: PredicateFactory }
	| { kind: 'regexp'; value: RegExp };
export type Quantifier = { min: number; max: number | null };
export type Piece = [Atom, Quantifier];
export type Branch = Piece[];
export type RegExp = Branch[];
