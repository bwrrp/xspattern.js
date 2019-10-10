import { filter, map, optional, or, plus, star, then, token, not } from '../src/parser-combinators';

describe('parser combinators', () => {
	describe('token', () => {
		it('accepts the given token', () => {
			expect(token('a')('zzazz', 2).success).toBe(true);
			expect(token('a')('zzazz', 2).offset).toBe(3);
			expect(token('zaz')('zzazz', 1).success).toBe(true);
			expect(token('zaz')('zzazz', 1).offset).toBe(4);
			expect(token('zaz')('zzazz', 0).success).toBe(false);
			expect(token('zaz')('zzazz', 0).offset).toBe(0);
			expect(token('zaz')('zzazz', 7).success).toBe(false);
			expect(token('zaz')('zzazz', 7).offset).toBe(7);
		});
	});

	describe('map', () => {
		it("maps the inner parser's value", () => {
			const res = map(token('a'), () => 'b')('zzazz', 2);
			expect(res.success).toBe(true);
			expect((res as any).value).toBe('b');
			expect(res.offset).toBe(3);
		});

		it('propagates failure', () => {
			const mapped = map(token('a'), () => 'b');
			expect(mapped('zzazz', 0).success).toBe(false);
			expect(mapped('zzazz', 0).offset).toBe(0);
			expect(mapped('zzazz', 7).success).toBe(false);
			expect(mapped('zzazz', 7).offset).toBe(7);
		});
	});

	describe('filter', () => {
		it("checks against the inner parser's value", () => {
			const res1 = filter(token('a'), () => false, ['a'])('zzazz', 2);
			expect(res1.success).toBe(false);
			expect(res1.offset).toBe(2);

			const res2 = filter(token('a'), () => true, ['a'])('zzazz', 2);
			expect(res2.success).toBe(true);
			expect((res2 as any).value).toBe('a');
			expect(res2.offset).toBe(3);
		});
	});

	describe('or', () => {
		it('runs parsers until a match', () => {
			const parser = or([token('a'), token('b')]);
			expect(parser('a', 0).success).toBe(true);
			expect(parser('b', 0).success).toBe(true);
			expect(parser('c', 0).success).toBe(false);
		});
	});

	describe('optional', () => {
		it('accepts both a value or its absence', () => {
			const parser = optional(token('a'));
			expect(parser('a', 0).success).toBe(true);
			expect(parser('a', 0).offset).toBe(1);
			expect((parser('a', 0) as any).value).toBe('a');
			expect(parser('b', 0).success).toBe(true);
			expect(parser('b', 0).offset).toBe(0);
			expect((parser('b', 0) as any).value).toBe(null);
		});
	});

	describe('star', () => {
		it('consumes input by running the parser 0 or more times', () => {
			const parser = star(token('a'));
			expect(parser('b', 0).success).toBe(true);
			expect(parser('b', 0).offset).toBe(0);
			expect((parser('b', 0) as any).value).toEqual([]);
			expect(parser('a', 0).success).toBe(true);
			expect(parser('a', 0).offset).toBe(1);
			expect((parser('a', 0) as any).value).toEqual(['a']);
			expect(parser('aaa', 0).success).toBe(true);
			expect(parser('aaa', 0).offset).toBe(3);
			expect((parser('aaa', 0) as any).value).toEqual(['a', 'a', 'a']);
		});
	});

	describe('then', () => {
		it('runs two parsers in sequence and combines the values', () => {
			const parser = then(token('a'), token('b'), (a, b) => b + a);
			expect(parser('a', 0).success).toBe(false);
			expect(parser('a', 0).offset).toBe(1);
			expect((parser('a', 0) as any).expected).toEqual(['b']);
			expect(parser('aa', 0).success).toBe(false);
			expect(parser('aa', 0).offset).toBe(1);
			expect((parser('aa', 0) as any).expected).toEqual(['b']);
			expect(parser('b', 0).success).toBe(false);
			expect(parser('b', 0).offset).toBe(0);
			expect((parser('b', 0) as any).expected).toEqual(['a']);
			expect(parser('ab', 0).success).toBe(true);
			expect(parser('ab', 0).offset).toBe(2);
			expect((parser('ab', 0) as any).value).toBe('ba');
		});
	});

	describe('plus', () => {
		it('consumes input by running the parser 1 or more times', () => {
			const parser = plus(token('a'));
			expect(parser('b', 0).success).toBe(false);
			expect(parser('b', 0).offset).toBe(0);
			expect((parser('b', 0) as any).expected).toEqual(['a']);
			expect(parser('a', 0).success).toBe(true);
			expect(parser('a', 0).offset).toBe(1);
			expect((parser('a', 0) as any).value).toEqual(['a']);
			expect(parser('aaa', 0).success).toBe(true);
			expect(parser('aaa', 0).offset).toBe(3);
			expect((parser('aaa', 0) as any).value).toEqual(['a', 'a', 'a']);
		});
	});

	describe('not', () => {
		it('fails if the inner parser matches', () => {
			const parser = not(token('a'), ['not a']);
			expect(parser('a', 0).success).toBe(false);
			expect(parser('a', 0).offset).toBe(0);
			expect((parser('a', 0) as any).expected).toEqual(['not a']);
		});

		it('succeeds without consuming input if the inner parser does not match', () => {
			const parser = not(token('a'), ['not a']);
			expect(parser('b', 0).success).toBe(true);
			expect(parser('b', 0).offset).toBe(0);
		});
	});
});
