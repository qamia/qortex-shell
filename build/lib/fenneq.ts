/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*
 * Qortex (QAM-493): bundle the FenneQ agent as a BUILT-IN extension.
 *
 * FenneQ is built separately (the qamia/fenneq-agent fork of Cline, an esbuild
 * bundle → .vsix). Rather than recompile it inside this gulp build, we extract a
 * pre-built VSIX's `extension/` payload into `.build/extensions/fenneq/`. The
 * desktop package task (`packageTask` in gulpfile.vscode.ts) globs
 * `.build/extensions/**` into `resources/app/extensions/`, so it ships as a
 * System (built-in) extension.
 *
 * Shipping it built-in (rather than installing from the gallery) is deliberate:
 * Open VSX hosts the upstream Cline under the SAME id (`saoudrizwan.claude-dev`),
 * so a gallery install would silently auto-update FenneQ -> Cline. Built-ins are
 * scanned as ExtensionType.System and skipped by the gallery update check
 * (see extensionsWorkbenchService.ts), which is exactly what we want (QAM-513).
 *
 * The VSIX path is taken from the FENNEQ_VSIX env var, falling back to
 * `.build/fenneq.vsix`. If neither exists the task SKIPS with a warning (so a
 * plain `npm run gulp vscode-*-min` on a dev machine without the VSIX still
 * succeeds, just without FenneQ bundled). Release CI must set FENNEQ_REQUIRED=1
 * so a missing VSIX is a hard error instead — you never ship Qortex without its
 * only agent by accident.
 */

import fs from 'fs';
import path from 'path';
import yauzl from 'yauzl';

const EXTENSION_DIR_NAME = 'fenneq';

function resolveVsixPath(): string | undefined {
	const candidates = [process.env.FENNEQ_VSIX, path.resolve('.build/fenneq.vsix')]
		.filter((p): p is string => !!p);
	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) {
			return candidate;
		}
	}
	const message =
		`[fenneq] FenneQ VSIX not found. Set FENNEQ_VSIX to the .vsix path, or place it at ` +
		`.build/fenneq.vsix. Looked at: ${candidates.join(', ') || '(none)'}`;
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
				return reject(err ?? new Error(`[fenneq] could not open ${zipPath}`));
			}
			zipfile.on('entry', entry => {
				if (/\/$/.test(entry.fileName)) {
					zipfile.readEntry();
					return;
				}
				zipfile.openReadStream(entry, (streamErr, istream) => {
					if (streamErr || !istream) {
						return reject(streamErr ?? new Error(`[fenneq] could not read ${entry.fileName}`));
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

/**
 * Extract the pre-built FenneQ VSIX into `.build/extensions/fenneq/` so the
 * desktop packaging step bundles it as a built-in extension.
 */
export async function extractFenneqVsix(): Promise<void> {
	const vsixPath = resolveVsixPath();
	if (!vsixPath) {
		return; // no VSIX available and not required — skip bundling FenneQ
	}
	const outputDir = path.resolve('.build/extensions', EXTENSION_DIR_NAME);
	const tmpDir = path.resolve('.build/tmp-fenneq');

	fs.rmSync(tmpDir, { recursive: true, force: true });
	fs.mkdirSync(tmpDir, { recursive: true });

	await unzip(vsixPath, tmpDir);

	// A VSIX wraps the real extension under an `extension/` folder.
	const extensionDir = path.join(tmpDir, 'extension');
	if (!fs.existsSync(extensionDir)) {
		throw new Error(`[fenneq] ${path.basename(vsixPath)} does not contain an extension/ directory`);
	}

	fs.rmSync(outputDir, { recursive: true, force: true });
	fs.mkdirSync(outputDir, { recursive: true });
	// Copy verbatim — do NOT inject __metadata/uuid (an extension without a uuid,
	// scanned as System, is excluded from gallery auto-update) and do NOT strip
	// node_modules (the VSIX ships a trimmed runtime, e.g. @vscode/codicons).
	copyDirSync(extensionDir, outputDir);

	fs.rmSync(tmpDir, { recursive: true, force: true });

	console.log(`[fenneq] extracted ${path.basename(vsixPath)} -> .build/extensions/${EXTENSION_DIR_NAME}/`);
}
