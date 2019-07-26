export type Codepoint = number;
export type Predicate = (cp: Codepoint) => boolean;
export type PredicateFactory = (sets: Sets) => Predicate | undefined;

function asCodepoint(char: string): number {
	return char.codePointAt(0)!;
}

function complement(predicate: Predicate | undefined): Predicate | undefined {
	if (predicate === undefined) {
		return undefined;
	}
	return codepoint => !predicate(codepoint);
}

function union(first: Predicate, next: Predicate): Predicate {
	return codepoint => first(codepoint) || next(codepoint);
}

function maybeUnion(
	first: Predicate | undefined,
	next: Predicate | undefined | null
): Predicate | undefined {
	if (first === undefined || next === undefined) {
		return undefined;
	}
	if (next === null) {
		return first;
	}
	return union(first, next);
}

function difference(
	predicate: Predicate | undefined,
	except: Predicate | undefined | null
): Predicate | undefined {
	if (predicate === undefined || except === undefined) {
		return undefined;
	}
	if (except === null) {
		return predicate;
	}
	return codepoint => predicate(codepoint) && !except(codepoint);
}

function singleChar(expected: Codepoint): Predicate {
	return codepoint => codepoint === expected;
}

function charRange(first: Codepoint, last: Codepoint): Predicate {
	// It is an error if either of the two singleChars in a charRange is a
	// SingleCharNoEsc comprising an unescaped hyphen
	if (first === null || last === null) {
		throw new Error('Invalid pattern: unescaped hyphen may not be used as a range endpoint');
	}
	// Inverted range is allowed by the spec, it's just an empty set
	return codepoint => first <= codepoint && codepoint <= last;
}

const unicodeCategories = {
	// TODO
};

function everything(_codepoint: Codepoint): boolean {
	return true;
}

function unicodeBlock(_identifier: string): Predicate {
	// Unknown blocks should match every character
	return everything;
}

function whitespace(codepoint: Codepoint): boolean {
	// space, tab, newline, carriage return
	return codepoint === 0x20 || codepoint === 0x9 || codepoint === 0xa || codepoint === 0xd;
}

// From XML 1.1
const nameStartChar = [
	singleChar(asCodepoint(':')),
	charRange(asCodepoint('A'), asCodepoint('Z')),
	singleChar(asCodepoint('_')),
	charRange(asCodepoint('a'), asCodepoint('z')),
	charRange(0xc0, 0xd6),
	charRange(0xd8, 0xf6),
	charRange(0xc0, 0xd6),
	charRange(0xd8, 0xf6),
	charRange(0xf8, 0x2ff),
	charRange(0x370, 0x37d),
	charRange(0x37f, 0x1fff),
	charRange(0x200c, 0x200d),
	charRange(0x2070, 0x218f),
	charRange(0x2c00, 0x2fef),
	charRange(0x3001, 0xd7ff),
	charRange(0xf900, 0xfdcf),
	charRange(0xfdf0, 0xfffd),
	charRange(0x10000, 0xeffff)
].reduce(union);

const nameChar = [
	nameStartChar,
	singleChar(asCodepoint('-')),
	singleChar(asCodepoint('.')),
	charRange(asCodepoint('0'), asCodepoint('9')),
	singleChar(0xb7),
	charRange(0x300, 0x36f),
	charRange(0x203f, 0x2040)
].reduce(union);

function wildcard(codepoint: Codepoint): boolean {
	// Anything except newline and carriage return
	return codepoint !== 0xa && codepoint !== 0xd;
}

const sets = {
	complement,
	union: maybeUnion,
	difference,

	singleChar,

	charRange,

	// Unicode properties
	block: unicodeBlock,
	category: unicodeCategories,

	// Common multi-character sets
	multiChar: {
		s: whitespace,
		S: complement(whitespace),
		i: nameStartChar,
		I: complement(nameStartChar),
		c: nameChar,
		C: complement(nameChar),
		// TODO: these require a unicode database
		d: undefined,
		D: undefined,
		w: undefined,
		W: undefined
	},
	wildcard
};

export default sets;

export type Sets = typeof sets;
