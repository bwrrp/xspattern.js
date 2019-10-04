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
	/ codePointOrFactory:charClass {
		if (typeof codePointOrFactory === 'number') {
			return { kind: 'codepoint', value: codePointOrFactory };
		}
		return { kind: 'predicate', value: codePointOrFactory };
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
	= "[" factory:charGroup "]" { return factory; }

charGroup
	= factory:posOrNegCharGroup except:( "-" except:charClassExpr { return except; } )? {
		return sets => sets.difference(factory(sets), except && except(sets));
	}

posOrNegCharGroup
	= (! "^") factory:posCharGroup { return factory; }
	/ (& "^") factory:negCharGroup { return factory; }

posCharGroup
	= only:charGroupPart (& "-[") { return only; }
	/ first:charGroupPart next:posCharGroup? {
		return sets => sets.union(first(sets), next && next(sets));
	}

negCharGroup
	= "^" factory:posCharGroup {
		return sets => sets.complement(factory(sets));
	}

charGroupPart
	= charRange
	/ charClassEsc
	/ codepoint:singleChar {
		return sets => sets.singleChar(codepoint); }

singleChar
	= SingleCharEsc
	/ (! "\\") codepoint:SingleCharNoEsc {
		return codepoint;
	}

charRange
	= first:singleCharWithHyphenAsNull "-" last:singleCharWithHyphenAsNull {
		return sets => sets.charRange(first, last);
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
	= "\\p{" factory:charProp "}" {
		return factory;
	}

complEsc
	= "\\P{" factory:charProp "}" {
		return sets => sets.complement(factory(sets));
	}

charProp
	= identifier:IsCategory {
		return sets => sets.category(identifier);
	}
	/ IsBlock

IsCategory
	= cat:CategoryIdentifier {
		return text();
	}

CategoryIdentifier
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
	= "Is" identifier:BlockIdentifier {
		return sets => sets.block(identifier);
	}

BlockIdentifier
	= [a-zA-Z0-9\-]+ {
		return text();
	}

MultiCharEsc
	= "\\" identifier:[sSiIcCdDwW] {
		return sets => sets.multiChar[identifier];
	}

WildcardEsc
	= "." {
		return sets => sets.wildcard;
	}
