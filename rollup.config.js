import commonjs from 'rollup-plugin-commonjs';
import json from 'rollup-plugin-json';
import resolve from 'rollup-plugin-node-resolve';
import sourcemaps from 'rollup-plugin-sourcemaps';
import { terser } from 'rollup-plugin-terser';

const {
	exports: {
		'.': { require: CJS_DEST_FILE, import: ESM_DEST_FILE },
	},
} = require('./package.json');

export default {
	input: 'lib/src/index.js',
	output: [
		{
			name: 'xspattern',
			file: CJS_DEST_FILE,
			format: 'umd',
			exports: 'named',
			sourcemap: true,
			globals: {
				whynot: 'whynot',
			},
		},
		{ file: ESM_DEST_FILE, format: 'es', sourcemap: true },
	],
	external: ['whynot'],
	plugins: [
		resolve(),
		commonjs(),
		json({
			preferConst: true,
			compact: true,
		}),
		sourcemaps(),
		terser(),
	],
};
