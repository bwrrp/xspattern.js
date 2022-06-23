import { charRange, nothing, singleChar, union } from './basic-sets';
import { Codepoint, Predicate } from './types';
import { CATEGORIES, PackedBlocks } from '../scripts/pack';

export function unpackBlocks(
	names: PackedBlocks['names'],
	lengths: PackedBlocks['lengths']
): Map<string, Predicate> {
	const predicateByNormalizedBlockId: Map<string, Predicate> = new Map();
	let first: Codepoint = 0;
	names.forEach((name: string | null, index: number) => {
		const length = lengths[index];
		if (name !== null) {
			name.split('|').forEach((name) => {
				const existing = predicateByNormalizedBlockId.get(name);
				const predicate = charRange(first, first + length - 1);
				predicateByNormalizedBlockId.set(
					name,
					existing ? union(existing, predicate) : predicate
				);
			});
		}
		first += length;
	});
	return predicateByNormalizedBlockId;
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
			case -2: {
				let actualCatIndex = 0;
				for (let codepoint = first; codepoint < first + length; ++codepoint) {
					const parts = partsByCatIndex[actualCatIndex];
					parts.push(singleChar(codepoint));
					actualCatIndex = (actualCatIndex + 1) % 2;
				}
				break;
			}

			case -1:
				// Gap, ignore
				break;

			default: {
				const parts = partsByCatIndex[catIndex];
				if (length === 1) {
					parts.push(singleChar(first));
				} else {
					parts.push(charRange(first, first + length - 1));
				}
				break;
			}
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
