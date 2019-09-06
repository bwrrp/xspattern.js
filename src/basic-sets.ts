import { Codepoint, Predicate } from './types';

export function singleChar(expected: Codepoint): Predicate {
	return codepoint => codepoint === expected;
}

export function charRange(first: Codepoint, last: Codepoint): Predicate {
	// It is an error if either of the two singleChars in a charRange is a
	// SingleCharNoEsc comprising an unescaped hyphen
	if (first === null || last === null) {
		throw new Error('Invalid pattern: unescaped hyphen may not be used as a range endpoint');
	}
	// Inverted range is allowed by the spec, it's just an empty set
	return codepoint => first <= codepoint && codepoint <= last;
}

export function everything(_codepoint: Codepoint): boolean {
	return true;
}

export function nothing(): boolean {
	return false;
}

export function union(first: Predicate, next: Predicate): Predicate {
	return codepoint => first(codepoint) || next(codepoint);
}
