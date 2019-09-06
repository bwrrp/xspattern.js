import { charRange, nothing, singleChar, union } from './basic-sets';
import { Codepoint, Predicate } from './types';

export const CATEGORIES = [
	'Lu',
	'Ll',
	'Lt',
	'Lm',
	'Lo',
	'Mn',
	'Mc',
	'Me',
	'Nd',
	'Nl',
	'No',
	'Pc',
	'Pd',
	'Ps',
	'Pe',
	'Pi',
	'Pf',
	'Po',
	'Zs',
	'Zl',
	'Zp',
	'Sm',
	'Sc',
	'Sk',
	'So',
	'Cc',
	'Cf',
	'Co',
	'Cn'
];

type UnicodeDataEntry = {
	codepoint: Codepoint;
	name: string | null;
	category: string | null;
	catIndex: number;
};

function* parseUnicodeData(data: string): Iterable<UnicodeDataEntry> {
	for (const line of data.split('\n')) {
		const trimmed = line.trim();
		if (trimmed === '') {
			continue;
		}
		const [codepointHex, name, category] = trimmed.split(';');
		const codepoint = parseInt(codepointHex, 16);

		const catIndex = CATEGORIES.indexOf(category);
		if (catIndex === -1) {
			// Category is not supported by the parser, so we can ignore it. Currently, this is only
			// Cs (surrogates), which will never match as we consider input as full codepoints only.
			continue;
		}

		yield { codepoint, name, category, catIndex };
	}
}

function* withExpandedRanges(entries: Iterable<UnicodeDataEntry>): Iterable<UnicodeDataEntry> {
	let previousCodepoint = -1;
	for (const entry of entries) {
		const isRangeStart = entry.name !== null && entry.name.endsWith(', First>');
		const isRangeEnd = entry.name !== null && entry.name.endsWith(', Last>');
		if (isRangeStart) {
			previousCodepoint = entry.codepoint;
			continue;
		}
		if (isRangeEnd) {
			for (let codepoint = previousCodepoint; codepoint < entry.codepoint; ++codepoint) {
				yield { ...entry, codepoint };
			}
		}
		yield entry;
	}
}

function* withExpandedGaps(entries: Iterable<UnicodeDataEntry>): Iterable<UnicodeDataEntry> {
	let previousCodepoint = -1;
	for (const entry of entries) {
		for (let codepoint = previousCodepoint + 1; codepoint < entry.codepoint; ++codepoint) {
			yield { codepoint, name: null, category: null, catIndex: -1 };
		}
		yield entry;
		previousCodepoint = entry.codepoint;
	}
}

type AlternationState = 'out' | 'lower' | 'upper';

function* withAlternationCategory(entries: Iterable<UnicodeDataEntry>): Iterable<UnicodeDataEntry> {
	let first: UnicodeDataEntry | null = null;
	let second: UnicodeDataEntry | null = null;
	let state: AlternationState = 'out';
	for (let entry of entries) {
		switch (state) {
			case 'out':
				// Start a new sequence?
				if (
					first !== null &&
					second !== null &&
					first.category === 'Lu' &&
					second.category === 'Ll' &&
					entry.category === 'Lu'
				) {
					state = 'lower';
					first = { ...first, category: 'LuLl', catIndex: -2 };
					second = { ...second, category: 'LuLl', catIndex: -2 };
					entry = { ...entry, category: 'LuLl', catIndex: -2 };
				}
				break;

			case 'lower':
				if (entry.category === 'Ll') {
					entry = { ...entry, category: 'LuLl', catIndex: -2 };
					state = 'upper';
				} else {
					// If the alternation is broken by a double upper case, reset second to avoid
					// creating adjacent alternations
					if (entry.category === 'Lu' && second !== null) {
						second = { ...second, category: 'Lu', catIndex: 0 };
					}
					state = 'out';
				}
				break;

			case 'upper':
				if (entry.category === 'Lu') {
					entry = { ...entry, category: 'LuLl', catIndex: -2 };
					state = 'lower';
				} else {
					state = 'out';
				}
				break;
		}
		if (first !== null) {
			yield first;
		}
		first = second;
		second = entry;
	}
	if (first !== null) {
		yield first;
	}
	if (second !== null) {
		yield second;
	}
}

export type UnicodeDataRange = { start: number; end: number; catIndex: number };

function* asRanges(entries: Iterable<UnicodeDataEntry>): Iterable<UnicodeDataRange> {
	let previousEntry = null;
	let rangeStart = 0;
	for (const entry of entries) {
		if (previousEntry !== null && entry.catIndex !== previousEntry.catIndex) {
			yield {
				start: rangeStart,
				end: previousEntry.codepoint,
				catIndex: previousEntry.catIndex
			};
			rangeStart = entry.codepoint;
		}
		previousEntry = entry;
	}

	if (previousEntry !== null) {
		yield { start: rangeStart, end: previousEntry.codepoint, catIndex: previousEntry.catIndex };
	}
}

const base64ByNumber = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function* encodeRange(range: UnicodeDataRange): Iterable<string> {
	// Length 0 never happens, so let's not waste the A and subtract one in advance
	const length = range.end - range.start;
	let catIndex = range.catIndex + 2;
	let encodedLength: string;
	if (length < base64ByNumber.length) {
		encodedLength = base64ByNumber.charAt(length);
	} else {
		catIndex |= 0b100000;
		const mask = 0b111111;
		encodedLength = [
			length & mask,
			(length >> 6) & mask,
			(length >> 12) & mask,
			(length >> 18) & mask
		]
			.map(n => base64ByNumber.charAt(n))
			.join('');
	}
	// category
	yield base64ByNumber.charAt(catIndex);
	// length
	yield encodedLength;
}

export function* encode(ranges: Iterable<UnicodeDataRange>): Iterable<string> {
	for (const range of ranges) {
		yield* encodeRange(range);
	}
}

export function packCategories(data: string): string {
	const codepoints = withAlternationCategory(
		withExpandedGaps(withExpandedRanges(parseUnicodeData(data)))
	);
	const ranges = asRanges(codepoints);
	const mapping = [...encode(ranges)].join('');

	return mapping;
}

const numberByBase64: { [key: string]: number } = {};
'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.split('').forEach((c, i) => {
	numberByBase64[c] = i;
});

export function unpackCategories(packed: string): Map<string, Predicate> {
	const predicateByCategory: Map<string, Predicate> = new Map();
	const encodedMapping = packed.split('');
	const partsByCatIndex: Predicate[][] = CATEGORIES.map(() => []);
	let first = 0;
	let i = 0;
	while (i < encodedMapping.length) {
		const encodedCatIndex = numberByBase64[encodedMapping[i]];
		const catIndex = (encodedCatIndex & 0b11111) - 2;
		let length = 1 + numberByBase64[encodedMapping[i + 1]];
		if (encodedCatIndex & 0b100000) {
			length += numberByBase64[encodedMapping[i + 2]] << 6;
			length += numberByBase64[encodedMapping[i + 3]] << 12;
			length += numberByBase64[encodedMapping[i + 4]] << 18;
			i += 5;
		} else {
			i += 2;
		}
		switch (catIndex) {
			case -2:
				let actualCatIndex = 0;
				for (let codepoint = first; codepoint < first + length; ++codepoint) {
					const parts = partsByCatIndex[actualCatIndex];
					parts.push(singleChar(codepoint));
					actualCatIndex = (actualCatIndex + 1) % 2;
				}
				break;

			case -1:
				// Gap, ignore
				break;

			default:
				const parts = partsByCatIndex[catIndex];
				if (length === 1) {
					parts.push(singleChar(first));
				} else {
					parts.push(charRange(first, first + length - 1));
				}
				break;
		}
		first += length;
	}
	const partsByPrefix: Map<string, Predicate[]> = new Map();
	CATEGORIES.forEach((category, i) => {
		const predicate = partsByCatIndex[i].reduce(union, nothing);
		predicateByCategory.set(category, predicate);
		const prefix = category.charAt(0);
		const parts = partsByPrefix.get(prefix) || [];
		partsByPrefix.set(prefix, parts);
		parts.push(predicate);
	});
	partsByPrefix.forEach((parts, prefix) => {
		predicateByCategory.set(prefix, parts.reduce(union, nothing));
	});
	return predicateByCategory;
}
