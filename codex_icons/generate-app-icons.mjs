#!/usr/bin/env node
/**
 * Rebuilds platform app icons from the full-bleed CodeX master art.
 *
 * - Flattens onto an opaque black square so macOS's squircle is the only
 *   rounding (avoids the nested gray-frame look from transparent padding).
 * - Crops the CODEX wordmark and scales it to ~82% canvas width so it reads
 *   clearly in the dock instead of sitting as a tiny mark in empty black.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MASTER = path.join(__dirname, 'CodeX-Curve.png');

// macOS dock squircles clip the outer ~10%. Keep the wordmark inside that
// safe area, but much larger than the original ~57%×12% mark.
const WORDMARK_WIDTH_RATIO = 0.82;
const WORDMARK_PAD_PX = 8; // extra crop pad around detected glyphs (at master res)

const retina = '@' + '2x.png';
const ICONSET_SIZES = [
	{ name: 'icon_16x16.png', size: 16 },
	{ name: 'icon_16x16' + retina, size: 32 },
	{ name: 'icon_32x32.png', size: 32 },
	{ name: 'icon_32x32' + retina, size: 64 },
	{ name: 'icon_128x128.png', size: 128 },
	{ name: 'icon_128x128' + retina, size: 256 },
	{ name: 'icon_256x256.png', size: 256 },
	{ name: 'icon_256x256' + retina, size: 512 },
	{ name: 'icon_512x512.png', size: 512 },
	{ name: 'icon_512x512' + retina, size: 1024 },
];

/** @type {{ left: number, top: number, width: number, height: number } | null} */
let cachedWordmarkBox = null;

async function detectWordmarkBox() {
	if (cachedWordmarkBox) return cachedWordmarkBox;
	const { data, info } = await sharp(MASTER).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
	const w = info.width;
	const h = info.height;
	const ch = info.channels;
	let minX = w;
	let minY = h;
	let maxX = 0;
	let maxY = 0;
	for (let y = 0; y < h; y++) {
		for (let x = 0; x < w; x++) {
			const i = (y * w + x) * ch;
			// bright opaque glyph pixels
			if (data[i + 3] > 200 && data[i] > 180 && data[i + 1] > 180 && data[i + 2] > 180) {
				if (x < minX) minX = x;
				if (y < minY) minY = y;
				if (x > maxX) maxX = x;
				if (y > maxY) maxY = y;
			}
		}
	}
	if (maxX < minX) {
		throw new Error('Could not detect CODEX wordmark in master art');
	}
	cachedWordmarkBox = {
		left: Math.max(0, minX - WORDMARK_PAD_PX),
		top: Math.max(0, minY - WORDMARK_PAD_PX),
		width: Math.min(w - Math.max(0, minX - WORDMARK_PAD_PX), maxX - minX + 1 + WORDMARK_PAD_PX * 2),
		height: Math.min(h - Math.max(0, minY - WORDMARK_PAD_PX), maxY - minY + 1 + WORDMARK_PAD_PX * 2),
	};
	return cachedWordmarkBox;
}

async function masterOpaqueSquare(size) {
	const box = await detectWordmarkBox();
	const targetWordW = Math.max(1, Math.round(size * WORDMARK_WIDTH_RATIO));
	const scale = targetWordW / box.width;
	const targetWordH = Math.max(1, Math.round(box.height * scale));
	const left = Math.round((size - targetWordW) / 2);
	const top = Math.round((size - targetWordH) / 2);

	const wordmark = await sharp(MASTER)
		.extract(box)
		.ensureAlpha()
		.resize(targetWordW, targetWordH, { fit: 'fill', kernel: sharp.kernel.lanczos3 })
		.png()
		.toBuffer();

	// Solid black plate + centered, enlarged wordmark. No transparent corners —
	// macOS supplies the only rounding via its squircle mask.
	return sharp({
		create: {
			width: size,
			height: size,
			channels: 3,
			background: { r: 0, g: 0, b: 0 },
		},
	})
		.composite([{ input: wordmark, left, top }])
		.png()
		.toBuffer();
}

async function writePng(file, size) {
	const buf = await masterOpaqueSquare(size);
	await fs.promises.writeFile(file, buf);
}

async function buildDarwinIcns() {
	// iconutil is picky: use a non-hidden *.iconset directory in /tmp.
	const iconsetDir = path.join('/tmp', `codex-code-${process.pid}.iconset`);
	fs.rmSync(iconsetDir, { recursive: true, force: true });
	fs.mkdirSync(iconsetDir);

	for (const { name, size } of ICONSET_SIZES) {
		const file = path.join(iconsetDir, name);
		await writePng(file, size);
		const meta = await sharp(file).metadata();
		if (meta.width !== size || meta.height !== size) {
			throw new Error(`${name} is ${meta.width}x${meta.height}, expected ${size}x${size}`);
		}
	}

	const listed = fs.readdirSync(iconsetDir).sort();
	if (listed.length !== ICONSET_SIZES.length) {
		throw new Error(`iconset incomplete before pack: ${listed.join(', ')}`);
	}

	const outIcns = path.join(ROOT, 'resources/darwin/code.icns');
	const result = spawnSync('iconutil', ['-c', 'icns', iconsetDir, '-o', outIcns], {
		encoding: 'utf8',
	});
	if (result.status !== 0) {
		throw new Error(`iconutil failed: ${result.stderr || result.stdout}`);
	}
	if (result.stderr && result.stderr.trim()) {
		console.warn('iconutil warnings:', result.stderr.trim());
	}

	// Verify the packed icns round-trips every representation.
	const verifyDir = path.join('/tmp', `codex-verify-${process.pid}.iconset`);
	fs.rmSync(verifyDir, { recursive: true, force: true });
	const extract = spawnSync('iconutil', ['-c', 'iconset', outIcns, '-o', verifyDir], {
		encoding: 'utf8',
	});
	if (extract.status !== 0) {
		throw new Error(`iconutil extract failed: ${extract.stderr || extract.stdout}`);
	}
	const packed = fs.readdirSync(verifyDir).sort();
	const missing = ICONSET_SIZES.map((s) => s.name).filter((n) => !packed.includes(n));
	if (missing.length) {
		throw new Error(`icns missing representations: ${missing.join(', ')} (got: ${packed.join(', ')})`);
	}
	const packedCount = packed.length;
	fs.rmSync(verifyDir, { recursive: true, force: true });

	const builtAppIcns = path.join(ROOT, '.build/electron/CodeX.app/Contents/Resources/CodeX.icns');
	if (fs.existsSync(path.dirname(builtAppIcns))) {
		fs.copyFileSync(outIcns, builtAppIcns);
		// Bump bundle mtime so Launch Services / Dock re-read the icon.
		const appPath = path.join(ROOT, '.build/electron/CodeX.app');
		const now = new Date();
		fs.utimesSync(appPath, now, now);
		console.log(`updated ${path.relative(ROOT, builtAppIcns)}`);
	}

	fs.rmSync(iconsetDir, { recursive: true, force: true });
	console.log(`wrote ${path.relative(ROOT, outIcns)} (${packedCount} sizes)`);
}

async function buildWinIco() {
	const icoPath = path.join(ROOT, 'resources/win32/code.ico');
	const sizes = [16, 24, 32, 48, 64, 128, 256];
	const tmpDir = path.join('/tmp', `codex-ico-${process.pid}`);
	fs.rmSync(tmpDir, { recursive: true, force: true });
	fs.mkdirSync(tmpDir);
	const inputs = [];
	for (const size of sizes) {
		const file = path.join(tmpDir, `${size}.png`);
		await writePng(file, size);
		inputs.push(file);
	}
	const result = spawnSync('magick', ['convert', ...inputs, icoPath], { encoding: 'utf8' });
	fs.rmSync(tmpDir, { recursive: true, force: true });
	if (result.status !== 0) {
		throw new Error(`magick ico failed: ${result.stderr || result.stdout}`);
	}
	console.log(`wrote ${path.relative(ROOT, icoPath)}`);
}

async function buildRasterCopies() {
	const targets = [
		{ rel: 'resources/linux/code.png', size: 1024 },
		{ rel: 'resources/server/code-512.png', size: 512 },
		{ rel: 'resources/server/codex-192.png', size: 192 },
		{ rel: 'scripts/appimage/CodeX.png', size: 1024 },
		{ rel: 'src/vs/workbench/browser/media/codex-icon.png', size: 1024 },
		{ rel: 'resources/win32/code_70x70.png', size: 70 },
		{ rel: 'resources/win32/code_150x150.png', size: 150 },
	];
	for (const { rel, size } of targets) {
		await writePng(path.join(ROOT, rel), size);
		console.log(`wrote ${rel} (${size}x${size})`);
	}
}

async function main() {
	if (!fs.existsSync(MASTER)) {
		throw new Error(`Missing master art: ${MASTER}`);
	}
	await buildDarwinIcns();
	await buildRasterCopies();
	await buildWinIco();
	console.log('done');
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
