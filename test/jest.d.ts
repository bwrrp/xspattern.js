declare namespace jest {
	interface Matchers<R> {
		toBeMatchedBy(matcher: (str: string) => boolean, pattern: string): void;
	}
}
