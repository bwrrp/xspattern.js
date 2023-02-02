const UNICODE_DATA_URL = 'https://www.unicode.org/Public/15.0.0/ucd/UnicodeData.txt';
const UNICODE_BLOCKS_URL = 'https://www.unicode.org/Public/15.0.0/ucd/Blocks.txt';

import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import { get } from 'node:https';

import { packBlocks, packCategories } from './pack';

function download(url: string, cb: (err: unknown, data: string) => void) {
	get(url, (res) => {
		let data: string[] = [];
		res.on('data', (chunk) => {
			data.push(chunk);
		});
		res.on('end', () => {
			cb(null, data.join(''));
		});
	}).on('error', cb);
}
function writeJsonSync(filename: string, data: any) {
	writeFileSync(resolve(__dirname, '..', 'src', 'generated', filename), JSON.stringify(data));
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
