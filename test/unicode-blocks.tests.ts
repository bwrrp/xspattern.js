import { packBlocks, unpackBlocks } from '../src/unicode-blocks';

const blocks = `
# Empty lines and comments are ignored

0000..007F; Meep
0080..0091; Maap Maap
00AA..00BB; Muup Muup-Muup 123
`;

const blocksWithAlias = `
0000..00FF; Greek and Coptic
`;

describe('unicode blocks packing', () => {
	it('can pack correctly', () => {
		const packed = packBlocks(blocks);
		expect(packed.names).toEqual(['Meep', 'MaapMaap', null, 'MuupMuup-Muup123']);
		expect(packed.lengths).toEqual([128, 18, 24, 18]);
	});

	it('can add aliases', () => {
		const packed = packBlocks(blocksWithAlias);
		expect(packed.names).toEqual(['GreekandCoptic|Greek']);
		expect(packed.lengths).toEqual([256]);
	});

	it('can unpack to the correct predicates', () => {
		const packed = packBlocks(blocks);
		const unpacked = unpackBlocks(packed.names, packed.lengths);
		expect(unpacked.get('Meep')).not.toBeUndefined();
		expect(unpacked.get('MaapMaap')).not.toBeUndefined();
		expect(unpacked.get('MuupMuup-Muup123')).not.toBeUndefined();
		expect(unpacked.get('Maap Maap')).toBeUndefined();
		for (let codepoint = 0; codepoint <= 0x7f; ++codepoint) {
			expect(unpacked.get('Meep')!(codepoint)).toBe(true);
			expect(unpacked.get('MaapMaap')!(codepoint)).toBe(false);
			expect(unpacked.get('MuupMuup-Muup123')!(codepoint)).toBe(false);
		}
		for (let codepoint = 0x80; codepoint <= 0x91; ++codepoint) {
			expect(unpacked.get('Meep')!(codepoint)).toBe(false);
			expect(unpacked.get('MaapMaap')!(codepoint)).toBe(true);
			expect(unpacked.get('MuupMuup-Muup123')!(codepoint)).toBe(false);
		}
		for (let codepoint = 0x92; codepoint < 0xaa; ++codepoint) {
			expect(unpacked.get('Meep')!(codepoint)).toBe(false);
			expect(unpacked.get('MaapMaap')!(codepoint)).toBe(false);
			expect(unpacked.get('MuupMuup-Muup123')!(codepoint)).toBe(false);
		}
		for (let codepoint = 0xaa; codepoint <= 0xbb; ++codepoint) {
			expect(unpacked.get('Meep')!(codepoint)).toBe(false);
			expect(unpacked.get('MaapMaap')!(codepoint)).toBe(false);
			expect(unpacked.get('MuupMuup-Muup123')!(codepoint)).toBe(true);
		}
		for (let codepoint = 0xbc; codepoint <= 0xff; ++codepoint) {
			expect(unpacked.get('Meep')!(codepoint)).toBe(false);
			expect(unpacked.get('MaapMaap')!(codepoint)).toBe(false);
			expect(unpacked.get('MuupMuup-Muup123')!(codepoint)).toBe(false);
		}
	});

	it('can unpack aliases', () => {
		const packed = packBlocks(blocksWithAlias);
		const unpacked = unpackBlocks(packed.names, packed.lengths);
		expect(unpacked.get('GreekandCoptic')).not.toBe(undefined);
		expect(unpacked.get('Greek')).not.toBe(undefined);
	});
});
