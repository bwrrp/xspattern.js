import { Atom, Branch, Piece, Quantifier, RegExp } from './ast';
import {
	complete,
	cut,
	delimited,
	error,
	filter,
	followed,
	map,
	not,
	okWithValue,
	optional,
	or,
	Parser,
	ParseResult,
	peek,
	plus,
	preceded,
	recognize,
	star,
	then,
	token
} from './parser-combinators';
import sets, { asCodepoint } from './sets';
import { Codepoint, Predicate } from './types';

// Tokens

const ASTERISK = token('*');
const BACKSLASH = token('\\');
const BRACE_OPEN = token('{');
const BRACE_CLOSE = token('}');
const BRACKET_OPEN = token('[');
const BRACKET_CLOSE = token(']');
const CARET = token('^');
const COMMA = token(',');
const HYPHEN = token('-');
const PARENTHESIS_OPEN = token('(');
const PARENTHESIS_CLOSE = token(')');
const PERIOD = token('.');
const PIPE = token('|');
const PLUS = token('+');
const QUESTION_MARK = token('?');
const SUBTRACT_MARKER = token('-[');

function asSetOfCodepoints(chars: string): Set<Codepoint> {
	return new Set(chars.split('').map(c => asCodepoint(c)));
}

function codepoint(input: string, offset: number): ParseResult<Codepoint> {
	const codepoint = input.codePointAt(offset);
	if (codepoint === undefined) {
		return error(offset, ['any character']);
	}
	return okWithValue(offset + String.fromCodePoint(codepoint).length, codepoint);
}

// Single Character Escape

const SingleCharEsc: Parser<Codepoint> = preceded(
	BACKSLASH,
	or([
		map(token('n'), () => 0xa),
		map(token('r'), () => 0xd),
		map(token('t'), () => 0x9),
		map(
			or([
				BACKSLASH,
				PIPE,
				PERIOD,
				HYPHEN,
				CARET,
				QUESTION_MARK,
				ASTERISK,
				PLUS,
				BRACE_OPEN,
				BRACE_CLOSE,
				PARENTHESIS_OPEN,
				PARENTHESIS_CLOSE,
				BRACKET_OPEN,
				BRACKET_CLOSE
			]),
			c => asCodepoint(c)
		)
	])
);

// Categories

function categoryIdentifier(primary: string, secondaries: string): Parser<Predicate> {
	const secondaryChars = asSetOfCodepoints(secondaries);
	return then(
		token(primary),
		optional(
			filter(codepoint, codepoint => secondaryChars.has(codepoint), secondaries.split(''))
		),
		(p, s) => sets.category(s === null ? p : p + String.fromCodePoint(s))
	);
}

const Letters = categoryIdentifier('L', 'ultmo');
const Marks = categoryIdentifier('M', 'nce');
const Numbers = categoryIdentifier('N', 'dlo');
const Punctuation = categoryIdentifier('P', 'cdseifo');
const Separators = categoryIdentifier('Z', 'slp');
const Symbols = categoryIdentifier('S', 'mcko');
const Others = categoryIdentifier('C', 'cfon');

const IsCategory: Parser<Predicate> = or([
	Letters,
	Marks,
	Numbers,
	Punctuation,
	Separators,
	Symbols,
	Others
]);

// Block Escape

const isBlockIdentifierChar: Predicate = [
	sets.charRange(asCodepoint('a'), asCodepoint('z')),
	sets.charRange(asCodepoint('A'), asCodepoint('Z')),
	sets.charRange(asCodepoint('0'), asCodepoint('9')),
	sets.singleChar(0x2d)
].reduce(sets.union);

const IsBlock: Parser<Predicate> = map(
	preceded(
		token('Is'),
		recognize(plus(filter(codepoint, isBlockIdentifierChar, ['block identifier'])))
	),
	sets.block
);

// Category Escape

const charProp: Parser<Predicate> = or([IsCategory, IsBlock]);

const catEsc: Parser<Predicate> = delimited(token('\\p{'), charProp, BRACE_CLOSE, true);

const complEsc: Parser<Predicate> = map(
	delimited(token('\\P{'), charProp, BRACE_CLOSE, true),
	sets.complement
);

// Multi-Character Escape

const MultiCharEsc: Parser<Predicate> = preceded(
	BACKSLASH,
	map(
		or('sSiIcCdDwW'.split('').map(c => token(c))) as Parser<keyof typeof sets.multiChar>,
		c => sets.multiChar[c]
	)
);

const WildcardEsc: Parser<Predicate> = map(PERIOD, () => sets.wildcard);

// Character Class Escape

const charClassEsc: Parser<Predicate> = or([MultiCharEsc, catEsc, complEsc]);

// Single Unescaped Character

const notSingleCharNoEsc = asSetOfCodepoints('\\[]');

const SingleCharNoEsc: Parser<Codepoint> = filter(
	codepoint,
	codepoint => !notSingleCharNoEsc.has(codepoint),
	['unescaped character']
);

const singleChar: Parser<Codepoint> = or([SingleCharEsc, SingleCharNoEsc]);

// Character Range

const singleCharHyphenAsNull: Parser<Codepoint | null> = or([map(HYPHEN, () => null), singleChar]);

const charRange: Parser<Predicate> = then(
	singleCharHyphenAsNull,
	preceded(HYPHEN, singleCharHyphenAsNull),
	sets.charRange
);

// Character Group Part

function cons<T>(first: T, rest: T[] | null) {
	return [first].concat(rest || []);
}

const assertEndOfCharGroup: Parser<null> = map(
	peek(or([BRACKET_CLOSE, SUBTRACT_MARKER])),
	() => null
);

const hyphenCodepoint = asCodepoint('-');
const singleCharHyphenWithHyphenRules: Parser<Codepoint> = map(
	followed(followed(HYPHEN, not(BRACKET_OPEN, ['not ['])), assertEndOfCharGroup),
	() => hyphenCodepoint
);

const singleCharWithHyphenRules: Parser<Codepoint> = or([
	singleCharHyphenWithHyphenRules,
	preceded(not(HYPHEN, ['not -']), singleChar)
]);

const charGroupPartsWithHyphenRules: Parser<Predicate[]> = or([
	then(
		map(singleCharWithHyphenRules, sets.singleChar),
		or([charGroupPartsWithHyphenRulesIndirect, assertEndOfCharGroup]),
		cons
	),
	then(or([charRange, charClassEsc]), or([charGroupPartsIndirect, assertEndOfCharGroup]), cons)
]);

function charGroupPartsWithHyphenRulesIndirect(
	input: string,
	offset: number
): ParseResult<Predicate[]> {
	return charGroupPartsWithHyphenRules(input, offset);
}

const charGroupParts: Parser<Predicate[]> = or([
	then(
		map(singleChar, sets.singleChar),
		or([charGroupPartsWithHyphenRules, assertEndOfCharGroup]),
		cons
	),
	then(or([charRange, charClassEsc]), or([charGroupPartsIndirect, assertEndOfCharGroup]), cons)
]);

function charGroupPartsIndirect(input: string, offset: number): ParseResult<Predicate[]> {
	return charGroupParts(input, offset);
}

// Positive Character Group

const posCharGroup: Parser<Predicate> = map(charGroupParts, parts => parts.reduce(sets.union));

// Negative Character Group

const negCharGroup: Parser<Predicate> = map(preceded(CARET, posCharGroup), sets.complement);

// Character Group

const charGroup: Parser<Predicate> = then(
	or([preceded(not(CARET, ['not ^']), posCharGroup), negCharGroup]),
	optional(preceded(HYPHEN, charClassExprIndirect)),
	sets.difference
);

// Character Class Expression

const charClassExpr: Parser<Predicate> = delimited(BRACKET_OPEN, charGroup, BRACKET_CLOSE, true);

function charClassExprIndirect(input: string, offset: number): ParseResult<Predicate> {
	return charClassExpr(input, offset);
}

// Character Class

const charClass: Parser<Predicate> = or([
	map(SingleCharEsc, sets.singleChar),
	charClassEsc,
	charClassExpr,
	WildcardEsc
]);

// Normal Character

const metachars = asSetOfCodepoints('.\\?*+{}()|[]');
const NormalChar: Parser<Codepoint> = filter(codepoint, codepoint => !metachars.has(codepoint), [
	'NormalChar'
]);

// Atom

const atom: Parser<Atom> = or<Atom>([
	map(NormalChar, codepoint => ({ kind: 'predicate', value: sets.singleChar(codepoint) })),
	map(charClass, predicate => ({ kind: 'predicate', value: predicate })),
	map(delimited(PARENTHESIS_OPEN, regexpIndirect, PARENTHESIS_CLOSE, true), regexp => ({
		kind: 'regexp',
		value: regexp
	}))
]);

// Quantifier

const zeroCodepoint = asCodepoint('0');
const isDigit = sets.charRange(zeroCodepoint, asCodepoint('9'));
const QuantExact: Parser<number> = map(
	plus(map(filter(codepoint, isDigit, ['digit']), codepoint => codepoint - zeroCodepoint)),
	digits => digits.reduce((num, digit) => num * 10 + digit)
);

const quantRange: Parser<Quantifier> = then(
	QuantExact,
	preceded(COMMA, QuantExact),
	(min, max) => ({ min, max })
);

const quantMin: Parser<Quantifier> = then(QuantExact, COMMA, min => ({ min, max: null }));

const quantity: Parser<Quantifier> = or([
	quantRange,
	quantMin,
	map(QuantExact, q => ({ min: q, max: q }))
]);

const quantifier: Parser<Quantifier> = or<Quantifier>([
	map(QUESTION_MARK, () => ({ min: 0, max: 1 })),
	map(ASTERISK, () => ({ min: 0, max: null })),
	map(PLUS, () => ({ min: 1, max: null })),
	delimited(BRACE_OPEN, quantity, BRACE_CLOSE, true)
]);

// Piece

const piece: Parser<Piece> = then(
	atom,
	map(optional(quantifier), q => (q === null ? { min: 1, max: 1 } : q)),
	(a, q) => [a, q]
);

// Branch

const branch: Parser<Branch> = star(piece);

// Regular Expression - with wrapper because of recursion

const regexp: Parser<RegExp> = then(branch, star(preceded(PIPE, cut(branch))), (b, bs) =>
	[b].concat(bs)
);

function regexpIndirect(input: string, offset: number): ParseResult<RegExp> {
	return regexp(input, offset);
}

function throwParseError(offset: number, expected: string[]): never {
	throw new Error(
		`Parse error at offset ${offset}, expected ${
			expected.length > 1 ? 'one of ' + expected.join(', ') : expected[0]
		}`
	);
}

const completeRegexp: Parser<RegExp> = complete(regexp);

export function parse(input: string): RegExp {
	const res = completeRegexp(input, 0);
	if (!res.success) {
		return throwParseError(res.offset, res.expected);
	}
	return res.value;
}
