import { compile } from '../src/index';

describe('xspattern', () => {
	it('can compile a pattern', () => {
		expect(() => compile('a|b')).not.toThrow();
	});

	it('throws if the pattern is not valid', () => {
		expect(() => compile('\\')).toThrow();
	});
});
