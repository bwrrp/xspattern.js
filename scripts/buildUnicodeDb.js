const UNICODE_DATA_URL = 'https://www.unicode.org/Public/12.1.0/ucd/UnicodeData.txt';
const UNICODE_BLOCKS_URL = 'https://www.unicode.org/Public/12.1.0/ucd/Blocks.txt';

const path = require('path');
const fs = require('fs');
const https = require('https');

require('ts-node').register();

const { packBlocks } = require('../src/unicode-blocks.ts');
const { packCategories } = require('../src/unicode-categories.ts');

function download(url, cb) {
	https
		.get(url, res => {
			let data = [];
			res.on('data', chunk => {
				data.push(chunk);
			});
			res.on('end', () => {
				cb(null, data.join(''));
			});
		})
		.on('error', cb);
}

function writeJsonSync(filename, data) {
	fs.writeFileSync(
		path.resolve(__dirname, '..', 'src', 'generated', filename),
		JSON.stringify(data)
	);
}

download(UNICODE_DATA_URL, (err, data) => {
	if (err) {
		console.error(err);
		return;
	}

	const packedCategories = packCategories(data);
	writeJsonSync('categories.json', packedCategories);
});

download(UNICODE_BLOCKS_URL, (err, data) => {
	if (err) {
		console.error(err);
		return;
	}

	const packedBlocks = packBlocks(data);
	writeJsonSync('blocks.json', packedBlocks);
});
