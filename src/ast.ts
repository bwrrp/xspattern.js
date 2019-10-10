import { Predicate } from './types';

// TODO: could this be Predicate | RegExp when TypeScript 3.7 is released?
export type Atom = { kind: 'predicate'; value: Predicate } | { kind: 'regexp'; value: RegExp };
export type Quantifier = { min: number; max: number | null };
export type Piece = [Atom, Quantifier];
export type Branch = Piece[];
export type RegExp = Branch[];
