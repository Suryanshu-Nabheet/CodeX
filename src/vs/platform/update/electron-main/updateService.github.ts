/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CancellationToken } from '../../../base/common/cancellation.js';
import { IConfigurationService } from '../../configuration/common/configuration.js';
import { IEnvironmentMainService } from '../../environment/electron-main/environmentMainService.js';
import { ILifecycleMainService } from '../../lifecycle/electron-main/lifecycleMainService.js';
import { ILogService } from '../../log/common/log.js';
import { IProductService } from '../../product/common/productService.js';
import { asText } from '../../request/common/request.js';
import { IRequestService } from '../../request/common/request.js';
import { IUpdate, State, StateType, UpdateType, DisablementReason } from '../common/update.js';
import { AbstractUpdateService } from './abstractUpdateService.js';
import { shell } from 'electron';

/** GitHub releases API endpoint for CodeX binaries. */
const GITHUB_RELEASES_API = 'https://api.github.com/repos/Suryanshu-Nabheet/CodeX/releases/latest';

/** GitHub releases page — shown to user when an update is found. */
const GITHUB_RELEASES_URL = 'https://github.com/Suryanshu-Nabheet/CodeX/releases/latest';

export class GitHubUpdateService extends AbstractUpdateService {

	constructor(
		@ILifecycleMainService lifecycleMainService: ILifecycleMainService,
		@IConfigurationService configurationService: IConfigurationService,
		@IEnvironmentMainService environmentMainService: IEnvironmentMainService,
		@IRequestService requestService: IRequestService,
		@ILogService logService: ILogService,
		@IProductService productService: IProductService
	) {
		super(lifecycleMainService, configurationService, environmentMainService, requestService, logService, productService);
	}

	protected override async initialize(): Promise<void> {
		// We bypass the standard checks for updateUrl and commit because we use the
		// GitHub API directly, and we want updates to work even in dev/unofficial builds.

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

		// Set a placeholder URL (satisfies internal checks in AbstractUpdateService)
		this.url = this.buildUpdateFeedUrl(quality);

		this.setState(State.Idle(this.getUpdateType()));

		if (updateMode === 'manual') {
			this.logService.info('update#ctor - manual checks only; automatic updates are disabled by user preference');
			return;
		}

		if (updateMode === 'start') {
			this.logService.info('update#ctor - startup checks only; automatic updates are disabled by user preference');
			// Single check 30 seconds after startup
			setTimeout(() => this.checkForUpdates(false), 30 * 1000);
		} else {
			// Recurring checks every 3 hours
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
			const url = GITHUB_RELEASES_API;

			const result = await this.requestService.request({ url }, CancellationToken.None);
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
				// Point users to the GitHub releases page to download the new version
				const downloadUrl = GITHUB_RELEASES_URL;
				const update: IUpdate = {
					version: latestVersion,
					productVersion: latestVersion,
					url: downloadUrl,
					timestamp: new Date(release.published_at).getTime()
				};
				this.logService.info(`GitHubUpdateService: update available (${currentVersion} → ${latestVersion})`);
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
			const result = await this.requestService.request({ url: GITHUB_RELEASES_API }, CancellationToken.None);
			if (result.res.statusCode !== 200) {
				return undefined;
			}
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

	protected override async doDownloadUpdate(state: State): Promise<void> {
		if (state.type !== StateType.AvailableForDownload) {
			return;
		}

		// Open the GitHub releases page — CodeX uses GitHub releases so we can't auto-install
		const url = state.update.url || GITHUB_RELEASES_URL;
		this.logService.info(`GitHubUpdateService: opening download page: ${url}`);
		shell.openExternal(url);

		// Return to Idle — user will reinstall manually
		this.setState(State.Idle(UpdateType.Archive));
	}

	protected override async doApplyUpdate(): Promise<void> {
		// Not applicable for archive-style updates (no in-place apply)
	}

	protected override async doQuitAndInstall(): Promise<void> {
		// Not applicable for archive-style updates
	}
}
