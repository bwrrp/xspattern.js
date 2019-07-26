regExp
	= lhs:branch rhs:( "|" b:branch { return b; } )* { return [lhs, ...rhs]; }

branch
	= piece*

piece
	= a:atom q:quantifier? { return [a, q || { min: 1, max: 1 }]; }

quantifier
	= "?" { return { min: 0, max: 1 }; }
	/ "*" { return { min: 0, max: null }; }
	/ "+" { return { min: 1, max: null }; }
	/ ( "{" q:quantity "}"  { return q; } )

quantity
	= quantRange
	/ quantMin
	/ q:QuantExact { return { min: q, max: q }; }

quantRange
	= min:QuantExact "," max:QuantExact { return { min, max }; }

quantMin
	= min:QuantExact "," { return { min, max: null }; }

QuantExact
	= [0-9]+ { return parseInt(text(), 10); }

atom
	= codePoint:NormalChar {
		return { kind: 'codepoint', value: codePoint };
	}
	/ predicate:charClass {
		if (predicate === undefined) {
			return { kind: 'unsupported', value: undefined };
		}
		if (typeof predicate === 'number') {
			return { kind: 'codepoint', value: predicate };
		}
		return { kind: 'predicate', value: predicate };
	}
	/ "(" expression:regExp ")" {
		return { kind: 'regexp', value: expression };
	}

// Originally this is [^.\\?*+{}()|\[\]] but PEG.js does not handle surrogate pairs for us, so we'll match those ourselves
NormalChar
	= [\uD800-\uDBFF][\uDC00-\uDFFF] { return text().codePointAt(0); }
	/ [^.\\?*+{}()|\[\]] { return text().codePointAt(0); }

charClass
	= SingleCharEsc
	/ charClassEsc
	/ charClassExpr
	/ WildcardEsc

charClassExpr
	= "[" predicate:charGroup "]" { return predicate; }

charGroup
	= predicate:posOrNegCharGroup except:( "-" except:charClassExpr { return except; } )? {
		if (predicate === undefined || except === undefined) {
			return undefined;
		}
		if (except === null) {
			return predicate;
		}
		return codepoint => predicate(codepoint) && !except(codepoint);
	}

posOrNegCharGroup
	= (! "^") predicate:posCharGroup { return predicate; }
	/ (& "^") predicate:negCharGroup { return predicate; }

posCharGroup
	= only:charGroupPart (& "-[") { return only; }
	/ first:charGroupPart next:posCharGroup? {
		if (first === undefined || next === undefined) {
			return undefined;
		}
		if (next === null) {
			return first;
		}
		return codepoint => first(codepoint) || next(codepoint);
	}

negCharGroup
	= "^" predicate:posCharGroup {
		if (predicate === undefined) {
			return undefined;
		}
		return codepoint => !predicate(codepoint);
	}

charGroupPart
	= charRange
	/ charClassEsc
	/ c:singleChar { return codepoint => codepoint === c; }

singleChar
	= SingleCharEsc
	/ SingleCharNoEsc

charRange
	= first:singleCharWithHyphenAsNull "-" last:singleCharWithHyphenAsNull {
		// It is an error if either of the two singleChars in a charRange is a
		// SingleCharNoEsc comprising an unescaped hyphen
		if (first === null || last === null) {
			throw new Error(
				'Invalid pattern: unescaped hyphen may not be used as a range endpoint'
			);
		}
		// Inverted range is allowed by the spec, it's just an empty set
		return codepoint => first <= codepoint && codepoint <= last;
	}

singleCharWithHyphenAsNull
	= SingleCharEsc
	/ SingleCharNoEscWithHyphenAsNull

SingleCharNoEsc
	= [\uD800-\uDBFF][\uDC00-\uDFFF] { return text().codePointAt(0); }
	/ [^\[\]] { return text().codePointAt(0); }

SingleCharNoEscWithHyphenAsNull
	= [\uD800-\uDBFF][\uDC00-\uDFFF] { return text().codePointAt(0); }
	/ [^\[\]\-] { return text().codePointAt(0); }
	// A hyphen followed by [ is not a singleChar at all
	/ "-" (! "[") { return null; }

charClassEsc
	= MultiCharEsc
	/ catEsc
	/ complEsc

SingleCharEsc
	= "\\n" { return 0xA; }
	/ "\\r" { return 0xD; }
	/ "\\t" { return 0x9; }
	/ "\\" char:[\\|.?*+(){}\-\[\]^] { return char.codePointAt(0); }

catEsc
	= "\\p{" charProp "}" {
		// Not supported
		return undefined;
	}

complEsc
	= "\\P{" charProp "}" {
		// Not supported
		return undefined;
	}

charProp
	= IsCategory
	/ IsBlock

IsCategory
	= Letters
	/ Marks
	/ Numbers
	/ Punctuation
	/ Separators
	/ Symbols
	/ Others

Letters = "L" [ultmo]?
Marks = "M" [nce]?
Numbers = "N" [dlo]?
Punctuation = "P" [cdseifo]?
Separators = "Z" [slp]?
Symbols = "S" [mcko]?
Others = "C" [cfon]?

IsBlock
	= "Is" [a-zA-Z0-9\-]+

MultiCharEsc
	= "\\" [sSiIcCdDwW] { return undefined; }

WildcardEsc
	= "." { return codepoint => codepoint !== 0xA && codepoint !== 0xD; }
