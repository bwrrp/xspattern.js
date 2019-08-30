import commonjs from 'rollup-plugin-commonjs';
import sourcemaps from 'rollup-plugin-sourcemaps';
import { terser } from 'rollup-plugin-terser';

const { main: MAIN_DEST_FILE, module: MODULE_DEST_FILE } = require('./package.json');

export default {
	input: 'lib/src/index.js',
	output: [
		{
			name: 'xspattern',
			file: MAIN_DEST_FILE,
			format: 'umd',
			exports: 'named',
			sourcemap: true,
			globals: {
				whynot: 'whynot'
			}
		},
		{ file: MODULE_DEST_FILE, format: 'es', sourcemap: true }
	],
	external: ['whynot'],
	plugins: [commonjs(), sourcemaps(), terser()]
};
