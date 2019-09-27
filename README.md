# xspattern.js

[![NPM version](https://badge.fury.io/js/xspattern.svg)](https://badge.fury.io/js/xspattern)
[![Build Status](https://travis-ci.org/bwrrp/xspattern.js.svg?branch=master)](https://travis-ci.org/bwrrp/xspattern.js)
[![Greenkeeper badge](https://badges.greenkeeper.io/bwrrp/xspattern.js.svg)](https://greenkeeper.io/)

XML Schema Regular Expression engine

This library implements a regular expression engine for the regular
expression language defined in XML Schema 1.0 and 1.1. It follows the XML
Schema 1.1 specification, which corrects some errors in earlier versions but
is otherwise fully compatible.

## Installation

The xspattern library can be installed using npm or yarn:

```bat
npm install --save xspattern
```

or

```bat
yarn add xspattern
```

The package includes both a CommonJS bundle (`dist/xspattern.js`) and an ES6
module (`dist/xspattern.mjs`).

## Usage

The library currently exports a single function `compile`, which expects a
string containing a single pattern and returns a function. This function
accepts a single string representing a value to test and returns a boolean
indicating whether the value matches the pattern.

```javascript
// for ES6 / Typescript:
import { compile } from 'xspattern';
// or for CommonJS / Node.js:
const { compile } = require('xspattern');

// This pattern matches sequences of one or more lower case consonants
const matchesPattern = compile('[a-z-[aeoui]]+');
console.log(matchesPattern('asdfgh')); // false
console.log(matchesPattern('zxcvbn')); // true
```
