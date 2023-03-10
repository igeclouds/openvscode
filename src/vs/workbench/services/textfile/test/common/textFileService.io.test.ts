/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { ITextFileService, snapshotToString, TextFileOperationError, TextFileOperationResult, stringToSnapshot } from 'vs/workbench/services/textfile/common/textfiles';
import { URI } from 'vs/base/common/uri';
import { join, basename } from 'vs/base/common/path';
import { UTF16le, UTF8_with_bom, UTF16be, UTF8, UTF16le_BOM, UTF16be_BOM, UTF8_BOM } from 'vs/workbench/services/textfile/common/encoding';
import { VSBuffer } from 'vs/base/common/buffer';
import { createTextModel } from 'vs/editor/test/common/editorTestUtils';
import { ITextSnapshot, DefaultEndOfLine } from 'vs/editor/common/model';
import { isWindows } from 'vs/base/common/platform';

export interface Params {
	setup(): Promise<{
		service: ITextFileService,
		testDir: string
	}>
	teardown(): Promise<void>

	exists(fsPath: string): Promise<boolean>;
	stat(fsPath: string): Promise<{ size: number }>;
	readFile(fsPath: string): Promise<VSBuffer | Buffer>;
	readFile(fsPath: string, encoding: string): Promise<string>;
	readFile(fsPath: string, encoding?: string): Promise<VSBuffer | Buffer | string>;
	detectEncodingByBOM(fsPath: string): Promise<typeof UTF16be | typeof UTF16le | typeof UTF8_with_bom | null>;
}

/**
 * Allows us to reuse test suite across different environments.
 *
 * It introduces a bit of complexity with setup and teardown, however
 * it helps us to ensure that tests are added for all environments at once,
 * hence helps us catch bugs better.
 */
export default function createSuite(params: Params) {
	let service: ITextFileService;
	let testDir = '';
	const { exists, stat, readFile, detectEncodingByBOM } = params;

	setup(async () => {
		const result = await params.setup();
		service = result.service;
		testDir = result.testDir;
	});

	teardown(async () => {
		await params.teardown();
	});

	test('create - no encoding - content empty', async () => {
		const resource = URI.file(join(testDir, 'small_new.txt'));

		await service.create(resource);

		const res = await readFile(resource.fsPath);
		assert.equal(res.byteLength, 0 /* no BOM */);
	});

	test('create - no encoding - content provided (string)', async () => {
		const resource = URI.file(join(testDir, 'small_new.txt'));

		await service.create(resource, 'Hello World');

		const res = await readFile(resource.fsPath);
		assert.equal(res.toString(), 'Hello World');
		assert.equal(res.byteLength, 'Hello World'.length);
	});

	test('create - no encoding - content provided (snapshot)', async () => {
		const resource = URI.file(join(testDir, 'small_new.txt'));

		await service.create(resource, stringToSnapshot('Hello World'));

		const res = await readFile(resource.fsPath);
		assert.equal(res.toString(), 'Hello World');
		assert.equal(res.byteLength, 'Hello World'.length);
	});

	test('create - UTF 16 LE - no content', async () => {
		const resource = URI.file(join(testDir, 'small_new.utf16le'));

		await service.create(resource);

		assert.equal(await exists(resource.fsPath), true);

		const detectedEncoding = await detectEncodingByBOM(resource.fsPath);
		assert.equal(detectedEncoding, UTF16le);

		const res = await readFile(resource.fsPath);
		assert.equal(res.byteLength, UTF16le_BOM.length);
	});

	test('create - UTF 16 LE - content provided', async () => {
		const resource = URI.file(join(testDir, 'small_new.utf16le'));

		await service.create(resource, 'Hello World');

		assert.equal(await exists(resource.fsPath), true);

		const detectedEncoding = await detectEncodingByBOM(resource.fsPath);
		assert.equal(detectedEncoding, UTF16le);

		const res = await readFile(resource.fsPath);
		assert.equal(res.byteLength, 'Hello World'.length * 2 /* UTF16 2bytes per char */ + UTF16le_BOM.length);
	});

	test('create - UTF 16 BE - no content', async () => {
		const resource = URI.file(join(testDir, 'small_new.utf16be'));

		await service.create(resource);

		assert.equal(await exists(resource.fsPath), true);

		const detectedEncoding = await detectEncodingByBOM(resource.fsPath);
		assert.equal(detectedEncoding, UTF16be);

		const res = await readFile(resource.fsPath);
		assert.equal(res.byteLength, UTF16le_BOM.length);
	});

	test('create - UTF 16 BE - content provided', async () => {
		const resource = URI.file(join(testDir, 'small_new.utf16be'));

		await service.create(resource, 'Hello World');

		assert.equal(await exists(resource.fsPath), true);

		const detectedEncoding = await detectEncodingByBOM(resource.fsPath);
		assert.equal(detectedEncoding, UTF16be);

		const res = await readFile(resource.fsPath);
		assert.equal(res.byteLength, 'Hello World'.length * 2 /* UTF16 2bytes per char */ + UTF16be_BOM.length);
	});

	test('create - UTF 8 BOM - no content', async () => {
		const resource = URI.file(join(testDir, 'small_new.utf8bom'));

		await service.create(resource);

		assert.equal(await exists(resource.fsPath), true);

		const detectedEncoding = await detectEncodingByBOM(resource.fsPath);
		assert.equal(detectedEncoding, UTF8_with_bom);

		const res = await readFile(resource.fsPath);
		assert.equal(res.byteLength, UTF8_BOM.length);
	});

	test('create - UTF 8 BOM - content provided', async () => {
		const resource = URI.file(join(testDir, 'small_new.utf8bom'));

		await service.create(resource, 'Hello World');

		assert.equal(await exists(resource.fsPath), true);

		const detectedEncoding = await detectEncodingByBOM(resource.fsPath);
		assert.equal(detectedEncoding, UTF8_with_bom);

		const res = await readFile(resource.fsPath);
		assert.equal(res.byteLength, 'Hello World'.length + UTF8_BOM.length);
	});

	test('create - UTF 8 BOM - empty content - snapshot', async () => {
		const resource = URI.file(join(testDir, 'small_new.utf8bom'));

		await service.create(resource, createTextModel('').createSnapshot());

		assert.equal(await exists(resource.fsPath), true);

		const detectedEncoding = await detectEncodingByBOM(resource.fsPath);
		assert.equal(detectedEncoding, UTF8_with_bom);

		const res = await readFile(resource.fsPath);
		assert.equal(res.byteLength, UTF8_BOM.length);
	});

	test('create - UTF 8 BOM - content provided - snapshot', async () => {
		const resource = URI.file(join(testDir, 'small_new.utf8bom'));

		await service.create(resource, createTextModel('Hello World').createSnapshot());

		assert.equal(await exists(resource.fsPath), true);

		const detectedEncoding = await detectEncodingByBOM(resource.fsPath);
		assert.equal(detectedEncoding, UTF8_with_bom);

		const res = await readFile(resource.fsPath);
		assert.equal(res.byteLength, 'Hello World'.length + UTF8_BOM.length);
	});

	test('write - use encoding (UTF 16 BE) - small content as string', async () => {
		await testEncoding(URI.file(join(testDir, 'small.txt')), UTF16be, 'Hello\nWorld', 'Hello\nWorld');
	});

	test('write - use encoding (UTF 16 BE) - small content as snapshot', async () => {
		await testEncoding(URI.file(join(testDir, 'small.txt')), UTF16be, createTextModel('Hello\nWorld').createSnapshot(), 'Hello\nWorld');
	});

	test('write - use encoding (UTF 16 BE) - large content as string', async () => {
		await testEncoding(URI.file(join(testDir, 'lorem.txt')), UTF16be, 'Hello\nWorld', 'Hello\nWorld');
	});

	test('write - use encoding (UTF 16 BE) - large content as snapshot', async () => {
		await testEncoding(URI.file(join(testDir, 'lorem.txt')), UTF16be, createTextModel('Hello\nWorld').createSnapshot(), 'Hello\nWorld');
	});

	async function testEncoding(resource: URI, encoding: string, content: string | ITextSnapshot, expectedContent: string) {
		await service.write(resource, content, { encoding });

		const detectedEncoding = await detectEncodingByBOM(resource.fsPath);
		assert.equal(detectedEncoding, encoding);

		const resolved = await service.readStream(resource);
		assert.equal(resolved.encoding, encoding);

		assert.equal(snapshotToString(resolved.value.create(isWindows ? DefaultEndOfLine.CRLF : DefaultEndOfLine.LF).createSnapshot(false)), expectedContent);
	}

	test('write - use encoding (cp1252)', async () => {
		const filePath = join(testDir, 'some_cp1252.txt');
		const contents = await readFile(filePath, 'utf8');
		const eol = /\r\n/.test(contents) ? '\r\n' : '\n';
		await testEncodingKeepsData(URI.file(filePath), 'cp1252', ['ObjectCount = LoadObjects("??ffentlicher Ordner");', '', 'Private = "Pers??nliche Information"', ''].join(eol));
	});

	test('write - use encoding (shiftjis)', async () => {
		await testEncodingKeepsData(URI.file(join(testDir, 'some_shiftjis.txt')), 'shiftjis', '??????abc');
	});

	test('write - use encoding (gbk)', async () => {
		await testEncodingKeepsData(URI.file(join(testDir, 'some_gbk.txt')), 'gbk', '??????abc');
	});

	test('write - use encoding (cyrillic)', async () => {
		await testEncodingKeepsData(URI.file(join(testDir, 'some_cyrillic.txt')), 'cp866', '????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????');
	});

	test('write - use encoding (big5)', async () => {
		await testEncodingKeepsData(URI.file(join(testDir, 'some_big5.txt')), 'cp950', '??????abc');
	});

	async function testEncodingKeepsData(resource: URI, encoding: string, expected: string) {
		let resolved = await service.readStream(resource, { encoding });
		const content = snapshotToString(resolved.value.create(isWindows ? DefaultEndOfLine.CRLF : DefaultEndOfLine.LF).createSnapshot(false));
		assert.equal(content, expected);

		await service.write(resource, content, { encoding });

		resolved = await service.readStream(resource, { encoding });
		assert.equal(snapshotToString(resolved.value.create(DefaultEndOfLine.CRLF).createSnapshot(false)), content);

		await service.write(resource, createTextModel(content).createSnapshot(), { encoding });

		resolved = await service.readStream(resource, { encoding });
		assert.equal(snapshotToString(resolved.value.create(DefaultEndOfLine.CRLF).createSnapshot(false)), content);
	}

	test('write - no encoding - content as string', async () => {
		const resource = URI.file(join(testDir, 'small.txt'));

		const content = (await readFile(resource.fsPath)).toString();

		await service.write(resource, content);

		const resolved = await service.readStream(resource);
		assert.equal(resolved.value.getFirstLineText(999999), content);
	});

	test('write - no encoding - content as snapshot', async () => {
		const resource = URI.file(join(testDir, 'small.txt'));

		const content = (await readFile(resource.fsPath)).toString();

		await service.write(resource, createTextModel(content).createSnapshot());

		const resolved = await service.readStream(resource);
		assert.equal(resolved.value.getFirstLineText(999999), content);
	});

	test('write - encoding preserved (UTF 16 LE) - content as string', async () => {
		const resource = URI.file(join(testDir, 'some_utf16le.css'));

		const resolved = await service.readStream(resource);
		assert.equal(resolved.encoding, UTF16le);

		await testEncoding(URI.file(join(testDir, 'some_utf16le.css')), UTF16le, 'Hello\nWorld', 'Hello\nWorld');
	});

	test('write - encoding preserved (UTF 16 LE) - content as snapshot', async () => {
		const resource = URI.file(join(testDir, 'some_utf16le.css'));

		const resolved = await service.readStream(resource);
		assert.equal(resolved.encoding, UTF16le);

		await testEncoding(URI.file(join(testDir, 'some_utf16le.css')), UTF16le, createTextModel('Hello\nWorld').createSnapshot(), 'Hello\nWorld');
	});

	test('write - UTF8 variations - content as string', async () => {
		const resource = URI.file(join(testDir, 'index.html'));

		let detectedEncoding = await detectEncodingByBOM(resource.fsPath);
		assert.equal(detectedEncoding, null);

		const content = (await readFile(resource.fsPath)).toString() + 'updates';
		await service.write(resource, content, { encoding: UTF8_with_bom });

		detectedEncoding = await detectEncodingByBOM(resource.fsPath);
		assert.equal(detectedEncoding, UTF8_with_bom);

		// ensure BOM preserved
		await service.write(resource, content, { encoding: UTF8 });
		detectedEncoding = await detectEncodingByBOM(resource.fsPath);
		assert.equal(detectedEncoding, UTF8_with_bom);

		// allow to remove BOM
		await service.write(resource, content, { encoding: UTF8, overwriteEncoding: true });
		detectedEncoding = await detectEncodingByBOM(resource.fsPath);
		assert.equal(detectedEncoding, null);

		// BOM does not come back
		await service.write(resource, content, { encoding: UTF8 });
		detectedEncoding = await detectEncodingByBOM(resource.fsPath);
		assert.equal(detectedEncoding, null);
	});

	test('write - UTF8 variations - content as snapshot', async () => {
		const resource = URI.file(join(testDir, 'index.html'));

		let detectedEncoding = await detectEncodingByBOM(resource.fsPath);
		assert.equal(detectedEncoding, null);

		const model = createTextModel((await readFile(resource.fsPath)).toString() + 'updates');
		await service.write(resource, model.createSnapshot(), { encoding: UTF8_with_bom });

		detectedEncoding = await detectEncodingByBOM(resource.fsPath);
		assert.equal(detectedEncoding, UTF8_with_bom);

		// ensure BOM preserved
		await service.write(resource, model.createSnapshot(), { encoding: UTF8 });
		detectedEncoding = await detectEncodingByBOM(resource.fsPath);
		assert.equal(detectedEncoding, UTF8_with_bom);

		// allow to remove BOM
		await service.write(resource, model.createSnapshot(), { encoding: UTF8, overwriteEncoding: true });
		detectedEncoding = await detectEncodingByBOM(resource.fsPath);
		assert.equal(detectedEncoding, null);

		// BOM does not come back
		await service.write(resource, model.createSnapshot(), { encoding: UTF8 });
		detectedEncoding = await detectEncodingByBOM(resource.fsPath);
		assert.equal(detectedEncoding, null);
	});

	test('write - preserve UTF8 BOM - content as string', async () => {
		const resource = URI.file(join(testDir, 'some_utf8_bom.txt'));

		let detectedEncoding = await detectEncodingByBOM(resource.fsPath);
		assert.equal(detectedEncoding, UTF8_with_bom);

		await service.write(resource, 'Hello World');
		detectedEncoding = await detectEncodingByBOM(resource.fsPath);
		assert.equal(detectedEncoding, UTF8_with_bom);
	});

	test('write - ensure BOM in empty file - content as string', async () => {
		const resource = URI.file(join(testDir, 'small.txt'));

		await service.write(resource, '', { encoding: UTF8_with_bom });

		let detectedEncoding = await detectEncodingByBOM(resource.fsPath);
		assert.equal(detectedEncoding, UTF8_with_bom);
	});

	test('write - ensure BOM in empty file - content as snapshot', async () => {
		const resource = URI.file(join(testDir, 'small.txt'));

		await service.write(resource, createTextModel('').createSnapshot(), { encoding: UTF8_with_bom });

		let detectedEncoding = await detectEncodingByBOM(resource.fsPath);
		assert.equal(detectedEncoding, UTF8_with_bom);
	});

	test('readStream - small text', async () => {
		const resource = URI.file(join(testDir, 'small.txt'));

		await testReadStream(resource);
	});

	test('readStream - large text', async () => {
		const resource = URI.file(join(testDir, 'lorem.txt'));

		await testReadStream(resource);
	});

	async function testReadStream(resource: URI): Promise<void> {
		const result = await service.readStream(resource);

		assert.equal(result.name, basename(resource.fsPath));
		assert.equal(result.size, (await stat(resource.fsPath)).size);

		const content = (await readFile(resource.fsPath)).toString();
		assert.equal(
			snapshotToString(result.value.create(DefaultEndOfLine.LF).createSnapshot(false)),
			snapshotToString(createTextModel(content).createSnapshot(false)));
	}

	test('read - small text', async () => {
		const resource = URI.file(join(testDir, 'small.txt'));

		await testRead(resource);
	});

	test('read - large text', async () => {
		const resource = URI.file(join(testDir, 'lorem.txt'));

		await testRead(resource);
	});

	async function testRead(resource: URI): Promise<void> {
		const result = await service.read(resource);

		assert.equal(result.name, basename(resource.fsPath));
		assert.equal(result.size, (await stat(resource.fsPath)).size);
		assert.equal(result.value, (await readFile(resource.fsPath)).toString());
	}

	test('readStream - encoding picked up (CP1252)', async () => {
		const resource = URI.file(join(testDir, 'some_small_cp1252.txt'));
		const encoding = 'windows1252';

		const result = await service.readStream(resource, { encoding });
		assert.equal(result.encoding, encoding);
		assert.equal(result.value.getFirstLineText(999999), 'Private = "Pers??nliche?? Information"');
	});

	test('read - encoding picked up (CP1252)', async () => {
		const resource = URI.file(join(testDir, 'some_small_cp1252.txt'));
		const encoding = 'windows1252';

		const result = await service.read(resource, { encoding });
		assert.equal(result.encoding, encoding);
		assert.equal(result.value, 'Private = "Pers??nliche?? Information"');
	});

	test('read - encoding picked up (binary)', async () => {
		const resource = URI.file(join(testDir, 'some_small_cp1252.txt'));
		const encoding = 'binary';

		const result = await service.read(resource, { encoding });
		assert.equal(result.encoding, encoding);
		assert.equal(result.value, 'Private = "Pers??nliche?? Information"');
	});

	test('read - encoding picked up (base64)', async () => {
		const resource = URI.file(join(testDir, 'some_small_cp1252.txt'));
		const encoding = 'base64';

		const result = await service.read(resource, { encoding });
		assert.equal(result.encoding, encoding);
		assert.equal(result.value, btoa('Private = "Pers??nliche?? Information"'));
	});

	test('readStream - user overrides BOM', async () => {
		const resource = URI.file(join(testDir, 'some_utf16le.css'));

		const result = await service.readStream(resource, { encoding: 'windows1252' });
		assert.equal(result.encoding, 'windows1252');
	});

	test('readStream - BOM removed', async () => {
		const resource = URI.file(join(testDir, 'some_utf8_bom.txt'));

		const result = await service.readStream(resource);
		assert.equal(result.value.getFirstLineText(999999), 'This is some UTF 8 with BOM file.');
	});

	test('readStream - invalid encoding', async () => {
		const resource = URI.file(join(testDir, 'index.html'));

		const result = await service.readStream(resource, { encoding: 'superduper' });
		assert.equal(result.encoding, 'utf8');
	});

	test('readStream - encoding override', async () => {
		const resource = URI.file(join(testDir, 'some.utf16le'));

		const result = await service.readStream(resource, { encoding: 'windows1252' });
		assert.equal(result.encoding, 'utf16le');
		assert.equal(result.value.getFirstLineText(999999), 'This is some UTF 16 with BOM file.');
	});

	test('readStream - large Big5', async () => {
		await testLargeEncoding('big5', '??????abc');
	});

	test('readStream - large CP1252', async () => {
		await testLargeEncoding('cp1252', '????????');
	});

	test('readStream - large Cyrillic', async () => {
		await testLargeEncoding('cp866', '????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????');
	});

	test('readStream - large GBK', async () => {
		await testLargeEncoding('gbk', '??????abc');
	});

	test('readStream - large ShiftJIS', async () => {
		await testLargeEncoding('shiftjis', '??????abc');
	});

	test('readStream - large UTF8 BOM', async () => {
		await testLargeEncoding('utf8bom', '????????');
	});

	test('readStream - large UTF16 LE', async () => {
		await testLargeEncoding('utf16le', '????????');
	});

	test('readStream - large UTF16 BE', async () => {
		await testLargeEncoding('utf16be', '????????');
	});

	async function testLargeEncoding(encoding: string, needle: string): Promise<void> {
		const resource = URI.file(join(testDir, `lorem_${encoding}.txt`));

		const result = await service.readStream(resource, { encoding });
		assert.equal(result.encoding, encoding);

		const contents = snapshotToString(result.value.create(DefaultEndOfLine.LF).createSnapshot(false));

		assert.equal(contents.indexOf(needle), 0);
		assert.ok(contents.indexOf(needle, 10) > 0);
	}

	test('readStream - UTF16 LE (no BOM)', async () => {
		const resource = URI.file(join(testDir, 'utf16_le_nobom.txt'));

		const result = await service.readStream(resource);
		assert.equal(result.encoding, 'utf16le');
	});

	test('readStream - UTF16 BE (no BOM)', async () => {
		const resource = URI.file(join(testDir, 'utf16_be_nobom.txt'));

		const result = await service.readStream(resource);
		assert.equal(result.encoding, 'utf16be');
	});

	test('readStream - autoguessEncoding', async () => {
		const resource = URI.file(join(testDir, 'some_cp1252.txt'));

		const result = await service.readStream(resource, { autoGuessEncoding: true });
		assert.equal(result.encoding, 'windows1252');
	});

	test('readStream - FILE_IS_BINARY', async () => {
		const resource = URI.file(join(testDir, 'binary.txt'));

		let error: TextFileOperationError | undefined = undefined;
		try {
			await service.readStream(resource, { acceptTextOnly: true });
		} catch (err) {
			error = err;
		}

		assert.ok(error);
		assert.equal(error!.textFileOperationResult, TextFileOperationResult.FILE_IS_BINARY);

		const result = await service.readStream(URI.file(join(testDir, 'small.txt')), { acceptTextOnly: true });
		assert.equal(result.name, 'small.txt');
	});

	test('read - FILE_IS_BINARY', async () => {
		const resource = URI.file(join(testDir, 'binary.txt'));

		let error: TextFileOperationError | undefined = undefined;
		try {
			await service.read(resource, { acceptTextOnly: true });
		} catch (err) {
			error = err;
		}

		assert.ok(error);
		assert.equal(error!.textFileOperationResult, TextFileOperationResult.FILE_IS_BINARY);

		const result = await service.read(URI.file(join(testDir, 'small.txt')), { acceptTextOnly: true });
		assert.equal(result.name, 'small.txt');
	});
}
