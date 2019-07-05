regExp
	= lhs:branch rhs:( "|" b:branch { return b } )* { return [lhs, ...rhs] }

branch
	= piece*

piece
	= atom quantifier?

quantifier
	= [?*+]
	/ ( "{" quantity "}" )

quantity
	= quantRange
	/ quantMin
	/ QuantExact

quantRange
	= QuantExact "," QuantExact

quantMin
	= QuantExact ","

QuantExact
	= [0-9]+

atom
	= NormalChar
	/ charClass
	/ ( "(" regExp ")" )

NormalChar
	= [^.\\?*+{}()|\[\]]

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
	= "\\" [nrt\\|.?*+(){}\-\[\]^]

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
