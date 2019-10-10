import { names as blockNames, lengths as blockLengths } from './generated/blocks.json';
import categories from './generated/categories.json';

import { singleChar, charRange, everything, union } from './basic-sets';
import { Codepoint, Predicate } from './types';
import { unpackBlocks } from './unicode-blocks';
import { unpackCategories } from './unicode-categories';

export function asCodepoint(char: string): Codepoint {
	return char.codePointAt(0)!;
}

function complement(predicate: Predicate): Predicate {
	return codepoint => !predicate(codepoint);
}

function difference(predicate: Predicate, except: Predicate | null): Predicate {
	if (except === null) {
		return predicate;
	}
	return codepoint => predicate(codepoint) && !except(codepoint);
}

const predicateByNormalizedBlockId: Map<string, Predicate> = unpackBlocks(blockNames, blockLengths);
const predicateByCategory: Map<string, Predicate> = unpackCategories(categories);

function unicodeBlock(identifier: string): Predicate {
	// The matching engine is not required to normalize the block identifier in the regexp
	const predicate = predicateByNormalizedBlockId.get(identifier);
	if (predicate === undefined) {
		// Unknown blocks should match every character
		return everything;
	}
	return predicate;
}

function unicodeCategory(identifier: string): Predicate {
	const predicate = predicateByCategory.get(identifier);
	// If is unreachable, as the parser will never match unsupported identifiers
	/* istanbul ignore if */
	if (predicate == undefined) {
		throw new Error(`Invalid pattern: ${identifier} is not a valid unicode category`);
	}
	return predicate;
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

const digit = predicateByCategory.get('Nd')!;
const notDigit = complement(digit);
const wordChar = difference(
	charRange(0x0000, 0x10ffff),
	[
		predicateByCategory.get('P')!,
		predicateByCategory.get('Z')!,
		predicateByCategory.get('C')!
	].reduce(union)
);
const notWordChar = complement(wordChar);

function wildcard(codepoint: Codepoint): boolean {
	// Anything except newline and carriage return
	return codepoint !== 0xa && codepoint !== 0xd;
}

const sets = {
	complement,
	union,
	difference,

	singleChar,

	charRange,

	// Unicode properties
	block: unicodeBlock,
	category: unicodeCategory,

	// Common multi-character sets
	multiChar: {
		s: whitespace,
		S: complement(whitespace),
		i: nameStartChar,
		I: complement(nameStartChar),
		c: nameChar,
		C: complement(nameChar),
		d: digit,
		D: notDigit,
		w: wordChar,
		W: notWordChar
	},
	wildcard
};

export default sets;

export type Sets = typeof sets;
