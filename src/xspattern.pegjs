regExp
	= lhs:branch rhs:( "|" b:branch { return b } )* { return [lhs, ...rhs] }

branch
	= piece*

piece
	= a:atom q:quantifier? { return [a, q || { min: 1, max: 1 }] }

quantifier
	= "?" { return { min: 0, max: 1 } }
	/ "*" { return { min: 0, max: null } }
	/ "+" { return { min: 1, max: null } }
	/ ( "{" q:quantity "}"  { return q } )

quantity
	= quantRange
	/ quantMin
	/ q:QuantExact { return { min: q, max: q } }

quantRange
	= min:QuantExact "," max:QuantExact { return { min, max } }

quantMin
	= min:QuantExact "," { return { min, max: null } }

QuantExact
	= [0-9]+ { return parseInt(text(), 10) }

atom
	= NormalChar
	/ charClass
	/ ( "(" regExp ")" )

// Originally this is [^.\\?*+{}()|\[\]] but PEG.js does not handle surrogate pairs for us, so we'll match those ourselves
NormalChar
	= [\uD800-\uDBFF][\uDC00-\uDFFF] { return text().codePointAt(0) }
	/ [^.\\?*+{}()|\[\]] { return text().codePointAt(0) }

charClass
	= SingleCharEsc
	/ charClassEsc
	/ charClassExpr
	/ WildcardEsc

charClassExpr
	= "[" charGroup "]"

charGroup
	= ( posCharGroup / negCharGroup ) ( "-" charClassExpr )?

posCharGroup
	= ( charGroupPart )+

negCharGroup
	= "^" posCharGroup

charGroupPart
	= singleChar
	/ charRange
	/ charClassEsc

singleChar
	= SingleCharEsc
	/ SingleCharNoEsc

charRange
	= singleChar "-" singleChar

SingleCharNoEsc
	= [^\[\]]

charClassEsc
	= MultiCharEsc
	/ catEsc
	/ complEsc

SingleCharEsc
	= "\\n" { return 0xA }
	/ "\\r" { return 0xD }
	/ "\\t" { return 0x9 }
	/ "\\" char:[\\|.?*+(){}\-\[\]^] { return char.codePointAt(0) }

catEsc
	= "\\p{" charProp "}"

complEsc
	= "\\P{" charProp "}"

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
	= "\\" [sSiIcCdDwW]

WildcardEsc
	= "."
