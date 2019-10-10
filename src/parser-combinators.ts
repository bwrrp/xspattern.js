export type ParseResult<T> =
	| { success: true; offset: number; value: T }
	| { success: false; offset: number; expected: string[]; fatal: boolean };
export type Parser<T> = (input: string, offset: number) => ParseResult<T>;

export function okWithValue<T>(offset: number, value: T): ParseResult<T> {
	return { success: true, offset, value };
}

export function ok(offset: number): ParseResult<undefined> {
	return okWithValue(offset, undefined);
}

export function error<T>(
	offset: number,
	expected: string[],
	fatal: boolean = false
): ParseResult<T> {
	return { success: false, offset, expected, fatal };
}

export function token(token: string): Parser<string> {
	return (input, offset) => {
		const offsetAfter = offset + token.length;
		if (input.slice(offset, offsetAfter) === token) {
			return okWithValue(offsetAfter, token);
		}
		return error(offset, [token]);
	};
}

export function map<T, U>(parser: Parser<T>, map: (v: T) => U): Parser<U> {
	return (input, offset) => {
		const res = parser(input, offset);
		if (!res.success) {
			return res;
		}
		return okWithValue(res.offset, map(res.value));
	};
}

export function filter<T>(
	parser: Parser<T>,
	filter: (v: T) => boolean,
	expected: string[]
): Parser<T> {
	return (input, offset) => {
		const res = parser(input, offset);
		if (!res.success) {
			if (res.offset === offset) {
				return error(offset, expected);
			}
			return res;
		}
		if (!filter(res.value)) {
			return error(offset, expected);
		}
		return res;
	};
}

export function or<T>(parsers: Parser<T>[]): Parser<T> {
	return (input, offset) => {
		let lastError: ParseResult<T> | null = null;
		for (const parser of parsers) {
			const res = parser(input, offset);
			if (res.success) {
				return res;
			}

			if (lastError === null || res.offset > lastError.offset) {
				lastError = res;
			} else if (res.offset === lastError.offset) {
				lastError.expected = lastError.expected.concat(res.expected);
			}
			if (res.fatal) {
				break;
			}
		}
		return lastError || error(offset, []);
	};
}

export function optional<T>(parser: Parser<T>): Parser<T | null> {
	return (input, offset) => {
		const res = parser(input, offset);
		if (!res.success && !res.fatal) {
			return okWithValue(offset, null);
		}

		return res;
	};
}

export function star<T>(parser: Parser<T>): Parser<T[]> {
	return (input, offset) => {
		let ts: T[] = [];
		let nextOffset = offset;
		while (true) {
			const res = parser(input, nextOffset);
			if (!res.success) {
				if (res.fatal) {
					return res;
				}
				break;
			}
			ts.push(res.value);
			nextOffset = res.offset;
		}

		return okWithValue(nextOffset, ts);
	};
}

export function then<T1, T2, T>(
	parser1: Parser<T1>,
	parser2: Parser<T2>,
	join: (value1: T1, value2: T2) => T
): Parser<T> {
	return (input, offset) => {
		const r1 = parser1(input, offset);
		if (!r1.success) {
			return r1;
		}
		const r2 = parser2(input, r1.offset);
		if (!r2.success) {
			return r2;
		}
		return okWithValue(r2.offset, join(r1.value, r2.value));
	};
}

export function plus<T>(parser: Parser<T>): Parser<T[]> {
	return then(parser, star(parser), (v, vs) => [v].concat(vs));
}

export function first<T1, T2>(x: T1, y: T2): T1 {
	return x;
}

export function second<T1, T2>(x: T1, y: T2): T2 {
	return y;
}

export function preceded<TBefore, T>(before: Parser<TBefore>, parser: Parser<T>): Parser<T> {
	return then(before, parser, second);
}

export function followed<T, TAfter>(parser: Parser<T>, after: Parser<TAfter>): Parser<T> {
	return then(parser, after, first);
}

export function delimited<TOpen, T, TClose>(
	open: Parser<TOpen>,
	inner: Parser<T>,
	close: Parser<TClose>,
	cutAfterOpen: boolean = false
): Parser<T> {
	const rest = cutAfterOpen ? cut(followed(inner, close)) : followed(inner, close);
	return preceded(open, rest);
}

export function recognize<T>(parser: Parser<T>): Parser<string> {
	return (input, offset) => {
		const res = parser(input, offset);
		if (!res.success) {
			return res;
		}
		return okWithValue(res.offset, input.slice(offset, res.offset));
	};
}

export function peek<T>(parser: Parser<T>): Parser<void> {
	return (input, offset) => {
		const res = parser(input, offset);
		if (!res.success) {
			return res;
		}
		return ok(offset);
	};
}

export function not<T>(parser: Parser<T>, expected: string[]): Parser<void> {
	return (input, offset) => {
		const res = parser(input, offset);
		if (!res.success) {
			return ok(offset);
		}
		return error(offset, expected);
	};
}

export function cut<T>(parser: Parser<T>): Parser<T> {
	return (input, offset) => {
		const res = parser(input, offset);
		if (!res.success) {
			return error(res.offset, res.expected, true);
		}
		return res;
	};
}

export const end: Parser<void> = (input, offset) =>
	input.length === offset ? ok(offset) : error(offset, ['end of input']);

export function complete<T>(parser: Parser<T>): Parser<T> {
	return then(parser, end, first);
}
