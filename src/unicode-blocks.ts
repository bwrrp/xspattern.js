import { charRange, union } from './basic-sets';
import { Codepoint, Predicate } from './types';

export type PackedBlocks = { names: (string | null)[]; lengths: number[] };

// For Unicode 3.1 compatibility
const COMPATIBILITY_ALIASES: { [key: string]: string | undefined } = {
	GreekandCoptic: 'Greek',
	CombiningDiacriticalMarksforSymbols: 'CombiningMarksforSymbols',
	PrivateUseArea: 'PrivateUse',
	'SupplementaryPrivateUseArea-A': 'PrivateUse',
	'SupplementaryPrivateUseArea-B': 'PrivateUse',
};

export function packBlocks(data: string): PackedBlocks {
	let last = -1;
	const names: (string | null)[] = [];
	const lengths: number[] = [];
	data.split('\n').forEach((line) => {
		const trimmed = line.trim();
		if (trimmed === '' || trimmed.startsWith('#')) {
			return;
		}

		const [range, name] = trimmed.split(';');
		const [startHex, endHex] = range.split('..');
		const firstCodepoint = parseInt(startHex, 16);
		const lastCodepoint = parseInt(endHex, 16);
		const normalizedName = name.replace(/\s/g, '');
		const alias = COMPATIBILITY_ALIASES[normalizedName];

		if (firstCodepoint !== last + 1) {
			// Gap between blocks
			names.push(null);
			lengths.push(firstCodepoint - last - 1);
		}
		names.push(alias ? normalizedName + '|' + alias : normalizedName);
		lengths.push(lastCodepoint - firstCodepoint + 1);
		last = lastCodepoint;
	});

	return { names, lengths };
}

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
