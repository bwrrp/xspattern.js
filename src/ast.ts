export type Codepoint = number;
export type Predicate = (cp: Codepoint) => boolean;
export type Atom =
	| { kind: 'unsupported'; value: undefined }
	| { kind: 'codepoint'; value: Codepoint }
	| { kind: 'predicate'; value: Predicate }
	| { kind: 'regexp'; value: RegExp };
export type Quantifier = { min: number; max: number | null };
export type Piece = [Atom, Quantifier];
export type Branch = Piece[];
export type RegExp = Branch[];
