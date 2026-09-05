/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*
 * Qortex: bundle FenneQ Studio as a BUILT-IN extension.
 *
 * FenneQ Studio (qamia/fenneq-studio, id `qamia.fenneq-studio`) is the sidebar
 * that drives the FenneQ harness live. It has its own build (esbuild for the
 * extension host, Vite for the webview, vitest, protocol check), so the shell
 * does not compile it: this task materializes a ready-made copy into
 * `.build/extensions/fenneq-studio/`, and `packageTask` (gulpfile.vscode.ts)
 * globs `.build/extensions/**` into `resources/app/extensions/`, where it is
 * scanned as a System (built-in) extension: present on first launch, not
 * uninstallable, never touched by the gallery update check.
 *
 * Sources, first one found wins:
 *   1. FENNEQ_STUDIO_VSIX          a .vsix made by `vsce package` in the studio repo
 *   2. .build/fenneq-studio.vsix   same, at the path the CI workflow uses
 *   3. FENNEQ_STUDIO_DIR           a built checkout (dist/extension.js present): the
 *                                  files vsce would package are copied (.vscodeignore honoured)
 *   4. ../fenneq-studio            the sibling checkout, same rule as 3
 *
 * Without any of them the task SKIPS with a warning, so a plain
 * `npm run gulp vscode-*-min` on a dev machine still succeeds, just without the
 * studio. Release CI sets FENNEQ_REQUIRED=1 to make that a hard error: Qortex
 * never ships without its only agent by accident. Whatever the source, the
 * manifest must be qamia.fenneq-studio, so a stray VSIX of another extension
 * can never end up in the product.
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import yauzl from 'yauzl';

const require = createRequire(import.meta.url);

const EXTENSION_DIR_NAME = 'fenneq-studio';
const EXPECTED_ID = { publisher: 'qamia', name: 'fenneq-studio' };
const TAG = '[fenneq-studio]';

const root = path.dirname(path.dirname(import.meta.dirname));

type Source = { kind: 'vsix'; file: string } | { kind: 'dir'; dir: string };

function resolveSource(): Source | undefined {
	const vsixCandidates = [process.env.FENNEQ_STUDIO_VSIX, path.join(root, '.build', 'fenneq-studio.vsix')]
		.filter((p): p is string => !!p);
	for (const candidate of vsixCandidates) {
		if (fs.existsSync(candidate)) {
			return { kind: 'vsix', file: candidate };
		}
	}
	const dirCandidates = [process.env.FENNEQ_STUDIO_DIR, path.join(path.dirname(root), 'fenneq-studio')]
		.filter((p): p is string => !!p);
	for (const candidate of dirCandidates) {
		if (fs.existsSync(path.join(candidate, 'package.json')) && fs.existsSync(path.join(candidate, 'dist', 'extension.js'))) {
			return { kind: 'dir', dir: candidate };
		}
	}
	const message =
		`${TAG} FenneQ Studio not found. Set FENNEQ_STUDIO_VSIX to a .vsix (or place it at .build/fenneq-studio.vsix), ` +
		`or FENNEQ_STUDIO_DIR to a built checkout (dist/extension.js present). ` +
		`Looked at: ${[...vsixCandidates, ...dirCandidates].join(', ')}`;
	if (process.env.FENNEQ_REQUIRED) {
		throw new Error(message);
	}
	console.warn(`${message} — skipping (set FENNEQ_REQUIRED=1 to make this fatal).`);
	return undefined;
}

function unzip(zipPath: string, outputPath: string): Promise<void> {
	return new Promise((resolve, reject) => {
		yauzl.open(zipPath, { lazyEntries: true, autoClose: true }, (err, zipfile) => {
			if (err || !zipfile) {
				return reject(err ?? new Error(`${TAG} could not open ${zipPath}`));
			}
			zipfile.on('entry', entry => {
				if (/\/$/.test(entry.fileName)) {
					zipfile.readEntry();
					return;
				}
				zipfile.openReadStream(entry, (streamErr, istream) => {
					if (streamErr || !istream) {
						return reject(streamErr ?? new Error(`${TAG} could not read ${entry.fileName}`));
					}
					const filePath = path.join(outputPath, entry.fileName);
					fs.mkdirSync(path.dirname(filePath), { recursive: true });
					const ostream = fs.createWriteStream(filePath);
					ostream.on('finish', () => zipfile.readEntry());
					istream.on('error', reject);
					istream.pipe(ostream);
				});
			});
			zipfile.on('close', () => resolve());
			zipfile.readEntry();
		});
	});
}

function copyDirSync(src: string, dest: string): void {
	fs.mkdirSync(dest, { recursive: true });
	for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
		const srcPath = path.join(src, entry.name);
		const destPath = path.join(dest, entry.name);
		if (entry.isDirectory()) {
			copyDirSync(srcPath, destPath);
		} else {
			fs.copyFileSync(srcPath, destPath);
		}
	}
}

/** The VSIX wraps the extension under `extension/`; copy that verbatim. */
async function fromVsix(file: string, outputDir: string): Promise<void> {
	const tmpDir = path.join(root, '.build', 'tmp-fenneq-studio');
	fs.rmSync(tmpDir, { recursive: true, force: true });
	fs.mkdirSync(tmpDir, { recursive: true });
	await unzip(file, tmpDir);
	const extensionDir = path.join(tmpDir, 'extension');
	if (!fs.existsSync(extensionDir)) {
		throw new Error(`${TAG} ${path.basename(file)} does not contain an extension/ directory`);
	}
	// Verbatim: no __metadata/uuid (an extension without a uuid, scanned as
	// System, is excluded from gallery auto-update), no node_modules pruning
	// (the studio bundles everything; its VSIX ships no runtime dependencies).
	copyDirSync(extensionDir, outputDir);
	fs.rmSync(tmpDir, { recursive: true, force: true });
}

/** A built checkout: copy exactly the files `vsce package` would ship. */
async function fromCheckout(dir: string, outputDir: string): Promise<void> {
	const vsce = require('@vscode/vsce') as typeof import('@vscode/vsce');
	// `dependencies: false` skips the `npm list` walk (vsce honours it at runtime;
	// the 3.6 typings do not declare it yet). The studio bundles everything and
	// its manifest has no runtime dependencies, so nothing is lost.
	const options: import('@vscode/vsce').IListFilesOptions & { dependencies?: boolean } = { cwd: dir, dependencies: false };
	const files = await vsce.listFiles(options);
	for (const rel of files) {
		const src = path.join(dir, rel);
		const dest = path.join(outputDir, rel);
		fs.mkdirSync(path.dirname(dest), { recursive: true });
		fs.copyFileSync(src, dest);
	}
}

function checkManifest(outputDir: string, from: string): { name: string; version: string } {
	const manifestPath = path.join(outputDir, 'package.json');
	if (!fs.existsSync(manifestPath)) {
		throw new Error(`${TAG} ${from} has no package.json`);
	}
	const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { publisher?: string; name?: string; version?: string; main?: string };
	if (manifest.publisher !== EXPECTED_ID.publisher || manifest.name !== EXPECTED_ID.name) {
		throw new Error(`${TAG} ${from} is ${manifest.publisher}.${manifest.name}, not ${EXPECTED_ID.publisher}.${EXPECTED_ID.name}`);
	}
	const main = manifest.main ?? './dist/extension.js';
	if (!fs.existsSync(path.join(outputDir, main))) {
		throw new Error(`${TAG} ${from} is not built: ${main} is missing (run \`npm run build\` in the studio repo)`);
	}
	return { name: `${manifest.publisher}.${manifest.name}`, version: manifest.version ?? '?' };
}

/**
 * Materialize FenneQ Studio into `.build/extensions/fenneq-studio/` so the
 * desktop packaging step bundles it as a built-in extension.
 */
export async function materializeFenneqStudio(): Promise<void> {
	const source = resolveSource();
	if (!source) {
		return; // nothing available and not required: skip bundling the studio
	}
	const outputDir = path.join(root, '.build', 'extensions', EXTENSION_DIR_NAME);
	fs.rmSync(outputDir, { recursive: true, force: true });
	fs.mkdirSync(outputDir, { recursive: true });

	const from = source.kind === 'vsix' ? path.basename(source.file) : source.dir;
	try {
		if (source.kind === 'vsix') {
			await fromVsix(source.file, outputDir);
		} else {
			await fromCheckout(source.dir, outputDir);
		}
		const { name, version } = checkManifest(outputDir, from);
		console.log(`${TAG} ${name}@${version} from ${from} -> .build/extensions/${EXTENSION_DIR_NAME}/`);
	} catch (err) {
		// never leave a rejected or half-copied extension where packaging would pick it up
		fs.rmSync(outputDir, { recursive: true, force: true });
		throw err;
	}
}
