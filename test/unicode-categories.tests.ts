import { Codepoint, Predicate } from '../src/types';
import {
	packCategories,
	encode,
	UnicodeDataRange,
	unpackCategories,
	CATEGORIES
} from '../src/unicode-categories';

import unicodeData from './unicode-data';

function encodeRanges(ranges: UnicodeDataRange[]) {
	return [...encode(ranges)].join('');
}

describe('unicode category packing', () => {
	it('can pack correctly - basic categories and gaps', () => {
		const packed = packCategories(`
0000;;Cc;dontcare
0001;;Cc;
0002;;Cc;
0003;;Cc;
00A0;;Cc;test a gap
00A1;;Cc;
00A2;;Sm;
00A4;;So;gap and category change
00B0;;Ll;again`);
		expect(packed).toBe(
			encodeRanges([
				{ start: 0, end: 3, catIndex: 25 },
				{ start: 4, end: 0x9f, catIndex: -1 },
				{ start: 0xa0, end: 0xa1, catIndex: 25 },
				{ start: 0xa2, end: 0xa2, catIndex: 21 },
				{ start: 0xa3, end: 0xa3, catIndex: -1 },
				{ start: 0xa4, end: 0xa4, catIndex: 24 },
				{ start: 0xa5, end: 0xaf, catIndex: -1 },
				{ start: 0xb0, end: 0xb0, catIndex: 1 }
			])
		);
	});

	it('can pack correctly - ranges', () => {
		const packed = packCategories(`
0000;;Cc;dontcare
0001;<range, First>;So;
0100;<range, Last>;So;
0101;<range, First>;Ll;
0200;<range, Last>;Ll;
0201;;Ll;one more`);
		expect(packed).toBe(
			encodeRanges([
				{ start: 0, end: 0, catIndex: 25 },
				{ start: 1, end: 0x100, catIndex: 24 },
				{ start: 0x101, end: 0x201, catIndex: 1 }
			])
		);
	});

	it('can pack correctly - alternations + double lower', () => {
		const packed = packCategories(`
0011;;Lu;
0012;;Ll;
0013;;Lu;
0014;;Ll;
0015;;Ll;double lower
0016;;Lu;
0017;;Ll;
0018;;Lu;
0019;;Ll;
001A;;Lu;`);
		expect(packed).toBe(
			encodeRanges([
				{ start: 0, end: 0x10, catIndex: -1 },
				{ start: 0x11, end: 0x14, catIndex: -2 },
				{ start: 0x15, end: 0x15, catIndex: 1 },
				{ start: 0x16, end: 0x1a, catIndex: -2 }
			])
		);
	});

	it('can pack correctly - alternations + double upper', () => {
		const packed = packCategories(`
0011;;Lu;
0012;;Ll;
0013;;Lu;
0014;;Ll;
0015;;Lu;
0016;;Lu;double upper
0017;;Ll;
0018;;Lu;
0019;;Ll;
001A;;Lu;`);
		expect(packed).toBe(
			encodeRanges([
				{ start: 0, end: 0x10, catIndex: -1 },
				{ start: 0x11, end: 0x14, catIndex: -2 },
				{ start: 0x15, end: 0x15, catIndex: 0 },
				{ start: 0x16, end: 0x1a, catIndex: -2 }
			])
		);
	});

	it('can pack correctly - alternations + other', () => {
		const packed = packCategories(`
0011;;Lu;
0012;;Ll;
0013;;Lu;
0014;;Ll;
0015;;Lu;
0016;;So;interrupted
0017;;Ll;
0018;;Lu;
0019;;Ll;
001A;;Lu;`);
		expect(packed).toBe(
			encodeRanges([
				{ start: 0, end: 0x10, catIndex: -1 },
				{ start: 0x11, end: 0x15, catIndex: -2 },
				{ start: 0x16, end: 0x16, catIndex: 24 },
				{ start: 0x17, end: 0x17, catIndex: 1 },
				{ start: 0x18, end: 0x1a, catIndex: -2 }
			])
		);
	});

	it('can pack correctly - unrealistic short input data', () => {
		expect(packCategories('')).toBe('');
		expect(packCategories('0000;;Cc;')).toBe(
			encodeRanges([{ start: 0, end: 0, catIndex: 25 }])
		);
		expect(packCategories('0000;;Cc;\n0001;;Cc;')).toBe(
			encodeRanges([{ start: 0, end: 1, catIndex: 25 }])
		);
	});

	it('ignores the Cs category when packing', () => {
		const packed = packCategories(`
0000;;Cc;
0001;;Cs;single, followed by gap
0005;;Cc;
0010;<range, First>;Cs;range start
0020;<range, Last>;Cs;range end
0030;;Cc;`);
		expect(packed).toBe(
			encodeRanges([
				{ start: 0, end: 0, catIndex: 25 },
				{ start: 1, end: 4, catIndex: -1 },
				{ start: 5, end: 5, catIndex: 25 },
				{ start: 6, end: 0x2f, catIndex: -1 },
				{ start: 0x30, end: 0x30, catIndex: 25 }
			])
		);
	});

	function readable(codepoint: Codepoint, isMatch: boolean, category: string): string {
		return `${codepoint.toString(16)} ${isMatch ? 'matches' : 'does not match'} ${category}`;
	}

	function checkCategories(
		codepoint: Codepoint,
		predicateByCategory: Map<string, Predicate>,
		expectedCatIndex: number
	) {
		CATEGORIES.forEach((category, catIndex) => {
			const predicate = predicateByCategory.get(category)!;
			expect(readable(codepoint, predicate(codepoint), category)).toBe(
				readable(codepoint, catIndex === expectedCatIndex, category)
			);
		});
	}

	function checkUnpack(ranges: UnicodeDataRange[]) {
		const packed = encodeRanges(ranges);
		const unpacked = unpackCategories(packed);
		ranges.forEach(range => {
			for (let codepoint = range.start; codepoint <= range.end; ++codepoint) {
				const expectedCatIndex =
					range.catIndex === -2 ? (codepoint - range.start) % 2 : range.catIndex;
				checkCategories(codepoint, unpacked, expectedCatIndex);
			}
		});
	}

	it('can unpack correctly - basic categories and gaps', () => {
		checkUnpack([
			{ start: 0, end: 3, catIndex: 25 },
			{ start: 4, end: 0x9f, catIndex: -1 },
			{ start: 0xa0, end: 0xa1, catIndex: 25 },
			{ start: 0xa2, end: 0xa2, catIndex: 21 },
			{ start: 0xa3, end: 0xa3, catIndex: -1 },
			{ start: 0xa4, end: 0xa4, catIndex: 24 },
			{ start: 0xa5, end: 0xaf, catIndex: -1 },
			{ start: 0xb0, end: 0xb0, catIndex: 1 }
		]);
	});

	it('can unpack correctly - ranges', () => {
		checkUnpack([
			{ start: 0, end: 0, catIndex: 25 },
			{ start: 1, end: 0x100, catIndex: 24 },
			{ start: 0x101, end: 0x201, catIndex: 1 }
		]);
	});

	it('can unpack correctly - alternations + double lower', () => {
		checkUnpack([
			{ start: 0, end: 0x10, catIndex: -1 },
			{ start: 0x11, end: 0x14, catIndex: -2 },
			{ start: 0x15, end: 0x15, catIndex: 1 },
			{ start: 0x16, end: 0x1a, catIndex: -2 }
		]);
	});

	it('can unpack correctly - alternations + double upper', () => {
		checkUnpack([
			{ start: 0, end: 0x10, catIndex: -1 },
			{ start: 0x11, end: 0x14, catIndex: -2 },
			{ start: 0x15, end: 0x15, catIndex: 0 },
			{ start: 0x16, end: 0x1a, catIndex: -2 }
		]);
	});

	it('can unpack correctly - alternations + other', () => {
		checkUnpack([
			{ start: 0, end: 0x10, catIndex: -1 },
			{ start: 0x11, end: 0x15, catIndex: -2 },
			{ start: 0x16, end: 0x16, catIndex: 24 },
			{ start: 0x17, end: 0x17, catIndex: 1 },
			{ start: 0x18, end: 0x1a, catIndex: -2 }
		]);
	});

	it('can round-trip the entire unicode database', () => {
		const packed = packCategories(unicodeData);
		const unpacked = unpackCategories(packed);
		let rangeStart = -1;
		unicodeData.split('\n').forEach(line => {
			const trimmed = line.trim();
			if (trimmed === '') {
				return;
			}
			const [codepointHex, name, category] = trimmed.split(';');
			const codepoint = parseInt(codepointHex, 16);
			const catIndex = CATEGORIES.indexOf(category);
			if (name.endsWith(', First>')) {
				rangeStart = codepoint;
				return;
			}
			if (name.endsWith(', Last>')) {
				// To save time, let's just take a few samples here
				const step = Math.ceil((codepoint - rangeStart) / 100);
				for (let cp = rangeStart; cp < codepoint; cp += step) {
					checkCategories(codepoint, unpacked, catIndex);
				}
			}
			checkCategories(codepoint, unpacked, catIndex);
		});
	});
});
