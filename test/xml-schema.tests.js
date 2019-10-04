const {
	evaluateXPathToBoolean,
	evaluateXPathToFirstNode,
	evaluateXPathToNodes,
	evaluateXPathToString,
	evaluateXPathToStrings
} = require('fontoxpath');
const { sync } = require('slimdom-sax-parser');
const { compile } = require('..');
const { readFileSync } = require('fs');
const { resolve } = require('path');

const XLINK_HREF = '@Q{http://www.w3.org/1999/xlink}href';
const XML_SCHEMA_NAMESPACE = 'http://www.w3.org/2001/XMLSchema';
const XS_ATTRIBUTE = `Q{${XML_SCHEMA_NAMESPACE}}attribute`;
const XS_ELEMENT = `Q{${XML_SCHEMA_NAMESPACE}}element`;
const XS_PATTERN = `Q{${XML_SCHEMA_NAMESPACE}}pattern`;
const XS_RESTRICTION = `Q{${XML_SCHEMA_NAMESPACE}}restriction`;
const XS_SIMPLE_TYPE = `Q{${XML_SCHEMA_NAMESPACE}}simpleType`;

function readXml(path) {
	return sync(readFileSync(path, { encoding: 'utf8' }));
}

const KNOWN_FAILURES = new Set([
	// Removed unicode blocks
	// TODO: add support for those
	'reM43',
	'reM78',
	'reM99',
	'reN8',
	'reN43',
	'reN98',
	// Category assignment changed: https://github.com/w3c/xsdtests/issues/2
	'reZ003v'
	// Parser bug: https://github.com/lddubeau/saxes/issues/24//
	//'RegexTest_63'
]);

function getSimpleTypes(schemaPath) {
	const schema = readXml(schemaPath);
	return evaluateXPathToNodes(`//${XS_SIMPLE_TYPE}`, schema).map(simpleTypeNode => {
		const name = simpleTypeNode.getAttribute('name');
		const restrictionNode = evaluateXPathToFirstNode(`${XS_RESTRICTION}`, simpleTypeNode);
		if (!restrictionNode) {
			return {
				node: simpleTypeNode,
				name,
				description: `simple type "${name}"`,
				pattern: null,
				hasOtherRestrictions: false,
				base: null
			};
		}

		const patterns = evaluateXPathToStrings(`${XS_PATTERN}/@value`, restrictionNode);
		const pattern = patterns.length > 0 ? patterns.join('|') : null;
		let hasOtherRestrictions = evaluateXPathToBoolean(
			`*[not(self::${XS_PATTERN})]`,
			restrictionNode
		);

		let base = null;
		const baseName = restrictionNode.getAttribute('base');
		if (baseName) {
			base = evaluateXPathToFirstNode(
				`let $base := @base return //${XS_SIMPLE_TYPE}[@name=$base]`,
				restrictionNode
			);
			if (!base && !/xsd?:string/.test(baseName)) {
				hasOtherRestrictions = true;
			}
		}

		return {
			node: simpleTypeNode,
			name,
			description:
				name !== null ? `simple type "${name}"` : `simple type with pattern "${pattern}"`,
			pattern,
			hasOtherRestrictions,
			base
		};
	});
}

function generatePatternCompileTests(simpleTypes, expectedSchemaIsValid) {
	describe('patterns in schema', () => {
		if (expectedSchemaIsValid) {
			simpleTypes.forEach(({ pattern }) => {
				if (pattern === null) {
					return;
				}
				it(`can compile pattern "${pattern}"`, () => {
					expect(() => compile(pattern)).not.toThrow();
				});
			});
		} else {
			it('has some invalid patterns', () => {
				expect(() => {
					simpleTypes.forEach(({ pattern }) => {
						if (pattern !== null) {
							compile(pattern);
						}
					});
				}).toThrow();
			});
		}
	});
}

function createPredicate(simpleType, simpleTypes) {
	if (simpleType.hasOtherRestrictions) {
		return null;
	}
	const basePredicate = simpleType.base
		? createPredicate(simpleTypes.find(type => type.node === simpleType.base))
		: undefined;
	if (basePredicate === null) {
		return null;
	}
	const predicate = simpleType.pattern === null ? undefined : compile(simpleType.pattern);
	return predicate && basePredicate
		? value => predicate(value) && basePredicate(value)
		: predicate || basePredicate;
}

function findValues(simpleType, instance) {
	// simple type assigned to an attribute?
	const attribute = evaluateXPathToFirstNode(`ancestor::${XS_ATTRIBUTE}[1]`, simpleType.node);
	if (attribute !== null) {
		return evaluateXPathToStrings(`//@${attribute.getAttribute('name')}`, instance);
	}

	// simple type assigned to an element?
	const element = evaluateXPathToFirstNode(`ancestor::${XS_ELEMENT}[1]`, simpleType.node);
	if (element !== null) {
		return evaluateXPathToStrings(`//${element.getAttribute('name')}`, instance);
	}

	// simple type referenced by name?
	if (simpleType.name !== null) {
		const attribute = evaluateXPathToFirstNode(
			`//${XS_ATTRIBUTE}[tokenize(@type, ":")[last()] = $type]`,
			simpleType.node,
			null,
			{ type: simpleType.name }
		);
		if (attribute !== null) {
			return evaluateXPathToStrings(`//@${attribute.getAttribute('name')}`, instance);
		}

		const element = evaluateXPathToFirstNode(
			`//${XS_ELEMENT}[tokenize(@type, ":")[last()] = $type]`,
			simpleType.node,
			null,
			{ type: simpleType.name }
		);
		if (element !== null) {
			return evaluateXPathToStrings(`//${element.getAttribute('name')}`, instance);
		}
	}

	// Not used or type of usage not supported?
	return [];
}

function generateTestsForTestGroup(basePath, testGroup) {
	const schemaPath = evaluateXPathToString(`schemaTest/schemaDocument/${XLINK_HREF}`, testGroup);
	if (!schemaPath) {
		// Not a complete test, skip
		return;
	}

	const description = evaluateXPathToString(
		'(@name, ":", annotation/documentation) => string-join(" ")',
		testGroup
	);

	if (KNOWN_FAILURES.has(testGroup.getAttribute('name'))) {
		describe.skip(description, () => {
			it.skip('known failing test', () => {});
		});
		return;
	}

	const expectedSchemaIsValid = evaluateXPathToBoolean(
		'schemaTest/expected[not(@version="1.0" or @version="Unicode_4.0.0")]/@validity = "valid"',
		testGroup
	);

	describe(description, () => {
		const simpleTypes = getSimpleTypes(resolve(basePath, schemaPath));

		generatePatternCompileTests(simpleTypes, expectedSchemaIsValid);

		const instanceTests = evaluateXPathToNodes('instanceTest', testGroup);
		if (instanceTests.length === 0) {
			// No instances to test
			return;
		}

		const predicates = simpleTypes.map(simpleType => {
			const predicate = createPredicate(simpleType, simpleTypes);
			if (predicate === null) {
				it.skip(`${simpleType.description} uses non-pattern restrictions`, () => {});
			}
			return predicate;
		});

		instanceTests.forEach(instanceTest => {
			describe(`instance "${instanceTest.getAttribute('name')}"`, () => {
				const instanceStatusIsQueried = evaluateXPathToBoolean(
					'current/@status = "queried"',
					instanceTest
				);
				if (instanceStatusIsQueried) {
					it.skip('status is "queried" - expected result may not be correct', () => {});
					return;
				}

				const instancePath = evaluateXPathToString(
					`instanceDocument/${XLINK_HREF}`,
					instanceTest
				);
				const expectedInstanceIsValid = evaluateXPathToBoolean(
					'expected[not(@version="1.0" or @version="Unicode_4.0.0")]/@validity = "valid"',
					instanceTest
				);
				const instance = readXml(resolve(basePath, instancePath));

				const unusedSimpleTypes = new Set(simpleTypes);
				const simpleTypesAndValues = simpleTypes.map(simpleType => {
					const values = findValues(simpleType, instance);
					if (values.length > 0) {
						for (
							let baseSimpleType = simpleType;
							baseSimpleType;
							baseSimpleType = simpleTypes.find(
								type => type.node === baseSimpleType.base
							)
						) {
							unusedSimpleTypes.delete(baseSimpleType);
						}
					}
					return [simpleType, values];
				});

				if (expectedInstanceIsValid) {
					simpleTypesAndValues.forEach(([simpleType, values], i) => {
						if (values.length === 0) {
							// Will warn about this below
							return;
						}
						const predicate = predicates[i];
						if (predicate === null) {
							// Already warned about this
							return;
						}
						it(`${simpleType.description} matches values in the instance`, () => {
							values.forEach(value => {
								expect(predicate(value)).toBe(true);
							});
						});
					});
				} else {
					it('some value does not match its type in the schema', () => {
						expect(
							simpleTypesAndValues.some(([simpleType, values], i) => {
								const predicate = predicates[i];
								if (predicate === null) {
									// The extra restrictions are probably what should have failed
									return true;
								}
								if (values.length === 0) {
									return false;
								}
								return values.some(value => {
									return !predicate(value);
								});
							})
						).toBe(true);
					});
				}

				unusedSimpleTypes.forEach(({ pattern }) => {
					if (pattern === null) {
						return;
					}
					it.skip(`pattern "${pattern}" is not used in the instance`, () => {});
				});
			});
		});
	});
}

describe('XML Schema Regex tests', () => {
	const testsPath = process.env.XML_SCHEMA_TESTS_PATH;
	if (!testsPath) {
		it.skip('test suite not found, set XML_SCHEMA_TESTS_PATH environment variable', () => {});
		return;
	}

	const metaPath = resolve(testsPath, 'msMeta');
	const metadata = readXml(resolve(metaPath, 'Regex_w3c.xml'));

	evaluateXPathToNodes('/testSet/testGroup', metadata).forEach(testGroup =>
		generateTestsForTestGroup(metaPath, testGroup)
	);
});
