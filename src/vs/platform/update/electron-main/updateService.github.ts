/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';
import { CancellationToken } from '../../../base/common/cancellation.js';
import { IConfigurationService } from '../../configuration/common/configuration.js';
import { IEnvironmentMainService } from '../../environment/electron-main/environmentMainService.js';
import { ILifecycleMainService } from '../../lifecycle/electron-main/lifecycleMainService.js';
import { ILogService } from '../../log/common/log.js';
import { IProductService } from '../../product/common/productService.js';
import { asText, IRequestService } from '../../request/common/request.js';
import { IUpdate, State, StateType, UpdateType, DisablementReason } from '../common/update.js';
import { AbstractUpdateService } from './abstractUpdateService.js';
import { app, shell } from 'electron';

const execAsync = promisify(exec);

/** GitHub releases API endpoint for CodeX binaries. */
const GITHUB_RELEASES_API = 'https://api.github.com/repos/Suryanshu-Nabheet/CodeX/releases/latest';

/** GitHub releases page — shown to user as fallback. */
const GITHUB_RELEASES_URL = 'https://github.com/Suryanshu-Nabheet/CodeX/releases/latest';

/** Map of platform+arch to the asset filename suffix in GitHub releases. */
function getPlatformAssetSuffix(): string | undefined {
	const p = process.platform;
	const a = process.arch;
	if (p === 'darwin') { return a === 'arm64' ? 'darwin-arm64.dmg' : 'darwin-x64.dmg'; }
	if (p === 'linux') { return 'linux-x64.tar.gz'; }
	if (p === 'win32') { return 'win32-x64.zip'; }
	return undefined;
}

export class GitHubUpdateService extends AbstractUpdateService {

	/** Path to the downloaded update package, set after download completes. */
	private _downloadedPackagePath: string | undefined;

	constructor(
		@ILifecycleMainService lifecycleMainService: ILifecycleMainService,
		@IConfigurationService configurationService: IConfigurationService,
		@IEnvironmentMainService environmentMainService: IEnvironmentMainService,
		@IRequestService private readonly _requestService: IRequestService,
		@ILogService logService: ILogService,
		@IProductService productService: IProductService
	) {
		super(lifecycleMainService, configurationService, environmentMainService, _requestService, logService, productService);
	}

	protected override async initialize(): Promise<void> {
		if (this.environmentMainService.disableUpdates) {
			this.setState(State.Disabled(DisablementReason.DisabledByEnvironment));
			this.logService.info('update#ctor - updates are disabled by the environment');
			return;
		}

		const updateMode = this.configurationService.getValue<'none' | 'manual' | 'start' | 'default'>('update.mode');
		const quality = this.getProductQuality(updateMode);

		if (!quality) {
			this.setState(State.Disabled(DisablementReason.ManuallyDisabled));
			this.logService.info('update#ctor - updates are disabled by user preference');
			return;
		}

		this.url = this.buildUpdateFeedUrl(quality);
		this.setState(State.Idle(this.getUpdateType()));

		if (updateMode === 'manual') {
			this.logService.info('update#ctor - manual checks only');
			return;
		}

		if (updateMode === 'start') {
			this.logService.info('update#ctor - startup check only');
			setTimeout(() => this.checkForUpdates(false), 30 * 1000);
		} else {
			// Recurring check every 3 hours
			this.scheduleCheckForUpdates(30 * 1000).then(undefined, err => this.logService.error(err));
		}
	}

	protected buildUpdateFeedUrl(_quality: string): string | undefined {
		return GITHUB_RELEASES_API;
	}

	/** Normalize a version string: strip leading 'v', trim whitespace. */
	private _normalizeVersion(v: string): string {
		return (v ?? '').replace(/^v/, '').trim();
	}

	/** The current CodeX version from product.json, normalized. */
	private get _currentVersion(): string {
		return this._normalizeVersion(
			this.productService.codexVersion || this.productService.version
		);
	}

	protected override async doCheckForUpdates(context: any): Promise<void> {
		this.setState(State.CheckingForUpdates(context));
		try {
			const result = await this._requestService.request({ url: GITHUB_RELEASES_API, timeout: 10000 }, CancellationToken.None);
			if (result.res.statusCode !== 200) {
				this.logService.warn(`GitHubUpdateService: GitHub API returned HTTP ${result.res.statusCode}`);
				this.setState(State.Idle(UpdateType.Archive));
				return;
			}

			const text = await asText(result);
			if (!text) {
				this.logService.warn('GitHubUpdateService: empty response body');
				this.setState(State.Idle(UpdateType.Archive));
				return;
			}
			const release = JSON.parse(text);

			if (!release?.tag_name) {
				this.logService.warn('GitHubUpdateService: release has no tag_name');
				this.setState(State.Idle(UpdateType.Archive));
				return;
			}

			const latestVersion = this._normalizeVersion(release.tag_name);
			const currentVersion = this._currentVersion;

			this.logService.info(`GitHubUpdateService: current=${currentVersion}, latest=${latestVersion}`);

			if (latestVersion !== currentVersion) {
				// Find the correct asset URL for this platform
				const suffix = getPlatformAssetSuffix();
				const asset = suffix && release.assets?.find((a: any) => (a.name as string).endsWith(suffix));
				const downloadUrl = asset?.browser_download_url || GITHUB_RELEASES_URL;

				const update: IUpdate = {
					version: latestVersion,
					productVersion: latestVersion,
					url: downloadUrl,
					timestamp: new Date(release.published_at).getTime()
				};
				this.logService.info(`GitHubUpdateService: update available (${currentVersion} → ${latestVersion}), asset: ${downloadUrl}`);
				this.setState(State.AvailableForDownload(update));
			} else {
				this.logService.info('GitHubUpdateService: already up to date');
				this.setState(State.Idle(UpdateType.Archive));
			}
		} catch (err) {
			this.logService.error('GitHubUpdateService: error checking for updates:', err);
			this.setState(State.Idle(UpdateType.Archive));
		}
	}

	override async isLatestVersion(): Promise<boolean | undefined> {
		try {
			const result = await this._requestService.request({ url: GITHUB_RELEASES_API }, CancellationToken.None);
			if (result.res.statusCode !== 200) { return undefined; }
			const text = await asText(result);
			if (!text) { return undefined; }
			const release = JSON.parse(text);
			const latestVersion = this._normalizeVersion(release.tag_name);
			return latestVersion === this._currentVersion;
		} catch (err) {
			this.logService.error('GitHubUpdateService: isLatestVersion error:', err);
			return undefined;
		}
	}

	/**
	 * Downloads the update package for the current platform in the background.
	 * On macOS: downloads the DMG, mounts it, copies the .app, then sets state to Ready.
	 * On Linux: downloads tar.gz, extracts it to a staging dir, sets state to Ready.
	 * On Windows: opens the browser (Squirrel not available; NSIS/zip reinstall required).
	 */
	protected override async doDownloadUpdate(state: State): Promise<void> {
		if (state.type !== StateType.AvailableForDownload) { return; }

		const update = state.update;
		const assetUrl = update.url;

		// Windows: no in-process self-update possible without an installer.
		// Fall back to opening the releases page so the user can download the zip.
		if (process.platform === 'win32' || !assetUrl || assetUrl === GITHUB_RELEASES_URL) {
			this.logService.info('GitHubUpdateService: opening download page for manual reinstall');
			shell.openExternal(GITHUB_RELEASES_URL);
			this.setState(State.Idle(UpdateType.Archive));
			return;
		}

		this.setState(State.Downloading);

		try {
			const downloadPath = await this._downloadAsset(assetUrl, update.version);
			this._downloadedPackagePath = downloadPath;
			this.logService.info(`GitHubUpdateService: download complete → ${downloadPath}`);

			if (process.platform === 'darwin') {
				await this._prepareMacOSUpdate(downloadPath, update);
			} else if (process.platform === 'linux') {
				await this._prepareLinuxUpdate(downloadPath, update);
			}
		} catch (err) {
			this.logService.error('GitHubUpdateService: download/prepare failed:', err);
			// Clean up and fall back
			if (this._downloadedPackagePath) {
				fs.rm(this._downloadedPackagePath, { force: true, recursive: true }, () => { });
				this._downloadedPackagePath = undefined;
			}
			shell.openExternal(GITHUB_RELEASES_URL);
			this.setState(State.Idle(UpdateType.Archive));
		}
	}

	/** Downloads a URL to a temp file, returns the local path. */
	private async _downloadAsset(url: string, version: string): Promise<string> {
		const tmpDir = os.tmpdir();
		const suffix = getPlatformAssetSuffix() ?? 'update';
		const destPath = path.join(tmpDir, `codex-update-${version}.${suffix}`);

		this.logService.info(`GitHubUpdateService: downloading ${url} → ${destPath}`);

		// Use the Electron/Node https module to stream the file
		await new Promise<void>((resolve, reject) => {
			// We redirect manually because GitHub redirects to S3
			const followRedirect = (u: string) => {
				const mod = u.startsWith('https:') ? require('https') : require('http');
				mod.get(u, { headers: { 'User-Agent': 'CodeX-Updater/1.0' } }, (res: any) => {
					if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
						followRedirect(res.headers.location);
						return;
					}
					if (res.statusCode !== 200) {
						reject(new Error(`HTTP ${res.statusCode} downloading ${u}`));
						return;
					}
					const file = fs.createWriteStream(destPath);
					res.pipe(file);
					file.on('finish', () => file.close(() => resolve()));
					file.on('error', (e: any) => { fs.unlink(destPath, () => { }); reject(e); });
				}).on('error', reject);
			};
			followRedirect(url);
		});

		return destPath;
	}

	/**
	 * macOS: Mount DMG, copy CodeX.app over the existing installation, unmount.
	 * Then set state to Ready so the user can click "Restart to Update".
	 */
	private async _prepareMacOSUpdate(dmgPath: string, update: IUpdate): Promise<void> {
		const mountPoint = path.join(os.tmpdir(), `codex-mount-${update.version}`);
		fs.mkdirSync(mountPoint, { recursive: true });

		try {
			// Mount the DMG silently
			await execAsync(`hdiutil attach "${dmgPath}" -mountpoint "${mountPoint}" -nobrowse -quiet`);

			// Find CodeX.app inside the mounted DMG
			const entries = fs.readdirSync(mountPoint);
			const appName = entries.find(e => e.endsWith('.app'));
			if (!appName) { throw new Error('No .app found inside DMG'); }

			const appSrc = path.join(mountPoint, appName);

			// Destination is the running app's location
			const appDest = app.getPath('exe').split('.app/')[0] + '.app';

			this.logService.info(`GitHubUpdateService: replacing ${appDest} with ${appSrc}`);

			// Replace the app bundle — requires the user has write access to Applications.
			// Use ditto to preserve extended attrs/symlinks, then unmount.
			await execAsync(`ditto "${appSrc}" "${appDest}"`);

			this.setState(State.Ready(update));
		} finally {
			// Always unmount
			execAsync(`hdiutil detach "${mountPoint}" -quiet`).catch(() => { });
			// Clean up downloaded DMG
			fs.rm(dmgPath, { force: true }, () => { });
		}
	}

	/**
	 * Linux: Extract the tar.gz to a staging dir.
	 * Then set state to Ready. On restart we exec the new binary.
	 */
	private async _prepareLinuxUpdate(tarPath: string, update: IUpdate): Promise<void> {
		const stagingDir = path.join(os.tmpdir(), `codex-update-${update.version}`);
		fs.mkdirSync(stagingDir, { recursive: true });

		await execAsync(`tar -xzf "${tarPath}" -C "${stagingDir}"`);

		this._downloadedPackagePath = stagingDir;
		this.setState(State.Ready(update));

		// Clean up the archive
		fs.rm(tarPath, { force: true }, () => { });
	}

	protected override async doApplyUpdate(): Promise<void> {
		// For archive-style: the "apply" step is done at download time (macOS/Linux).
		// Nothing extra needed here.
	}

	protected override doQuitAndInstall(): void {
		if (process.platform === 'linux' && this._downloadedPackagePath) {
			// On Linux, relaunch from the new extracted binary
			const stagingDir = this._downloadedPackagePath;
			const newBinaries = fs.readdirSync(stagingDir);
			const exeName = newBinaries.find(f => {
				const full = path.join(stagingDir, f);
				try {
					const stat = fs.statSync(full);
					return stat.isFile() && (stat.mode & 0o111) !== 0 && !f.includes('.');
				} catch { return false; }
			});

			if (exeName) {
				const newExe = path.join(stagingDir, exeName);
				this.logService.info(`GitHubUpdateService: relaunching from ${newExe}`);
				app.relaunch({ execPath: newExe, args: process.argv.slice(1) });
				app.exit(0);
				return;
			}
		}

		// macOS: the app bundle was already replaced in-place — just relaunch
		this.logService.info('GitHubUpdateService: relaunching after in-place update');
		app.relaunch();
		app.exit(0);
	}
}
