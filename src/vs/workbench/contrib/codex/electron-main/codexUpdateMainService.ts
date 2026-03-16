/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Suryanshu Nabheet All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IEnvironmentMainService } from '../../../../platform/environment/electron-main/environmentMainService.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IUpdateService, StateType } from '../../../../platform/update/common/update.js';
import { ICodexUpdateService } from '../common/codexUpdateService.js';
import { CodexCheckUpdateRespose } from '../common/codexUpdateServiceTypes.js';


export class CodexMainUpdateService extends Disposable implements ICodexUpdateService {
	_serviceBrand: undefined;

	constructor(
		@IProductService private readonly _productService: IProductService,
		@IEnvironmentMainService private readonly _envMainService: IEnvironmentMainService,
		@IUpdateService private readonly _updateService: IUpdateService,
	) {
		super()
	}


	async check(explicit: boolean): Promise<CodexCheckUpdateRespose> {

		const isDevMode = !this._envMainService.isBuilt // found in abstractUpdateService.ts

		if (isDevMode) {
			return { message: null } as const
		}

		// if disabled and not explicitly checking, return early before fetching
		if (this._updateService.state.type === StateType.Disabled) {
			if (!explicit) {
				return { message: null } as const
			}
			// For explicitly-disabled (e.g. Linux), fall through to GitHub tag check
			return await this._manualCheckGHTagIfDisabled(explicit)
		}

		// Already in a terminal state where we know the answer — don't re-check
		if (this._updateService.state.type === StateType.AvailableForDownload) {
			return { message: 'A new update is available!', action: 'download' } as const
		}
		if (this._updateService.state.type === StateType.Downloaded) {
			return { message: 'An update has been downloaded and is ready to apply!', action: 'apply' } as const
		}
		if (this._updateService.state.type === StateType.Updating) {
			return { message: explicit ? 'Applying update...' : null } as const
		}
		if (this._updateService.state.type === StateType.Ready) {
			return { message: 'Restart CodeX to apply the update!', action: 'restart' } as const
		}

		// Trigger an async check and await the resulting state change
		const stateAfterCheck = await this._awaitCheckForUpdates(explicit)

		switch (stateAfterCheck.type) {
			case StateType.AvailableForDownload:
				return { message: 'A new update is available!', action: 'download' } as const

			case StateType.Downloaded:
				return { message: 'An update has been downloaded and is ready to apply!', action: 'apply' } as const

			case StateType.Ready:
				return { message: 'Restart CodeX to apply the update!', action: 'restart' } as const

			case StateType.Idle:
				return { message: explicit ? 'CodeX is up to date!' : null } as const

			case StateType.CheckingForUpdates:
				// Timed out waiting for check to complete
				return { message: explicit ? 'Update check in progress — please try again in a moment.' : null } as const

			case StateType.Disabled:
				return await this._manualCheckGHTagIfDisabled(explicit)

			default:
				return { message: explicit ? 'Unable to determine update status.' : null } as const
		}
	}


	/**
	 * Triggers `checkForUpdates` and returns a promise that resolves with the
	 * new state once the state machine leaves `CheckingForUpdates`, or times out
	 * after 15 seconds and returns whatever state we are in.
	 */
	private _awaitCheckForUpdates(explicit: boolean): Promise<typeof this._updateService.state> {
		return new Promise(resolve => {
			const currentState = this._updateService.state

			// If we are currently checking, just wait for the result
			if (currentState.type !== StateType.CheckingForUpdates) {
				// Kick off the check — don't await; we listen for state change below
				this._updateService.checkForUpdates(explicit).catch(() => { /* errors surfaced via state */ })
			}

			// Safety timeout — 15 s
			const timeout = setTimeout(() => {
				listener.dispose()
				resolve(this._updateService.state)
			}, 15_000)

			const listener = this._updateService.onStateChange(newState => {
				// Wait until the machine leaves CheckingForUpdates
				if (newState.type !== StateType.CheckingForUpdates) {
					clearTimeout(timeout)
					listener.dispose()
					resolve(newState)
				}
			})
		})
	}


	/**
	 * Fallback for systems where the built-in update mechanism is disabled
	 * (e.g. Linux without Snap/deb). Checks the GitHub releases API directly.
	 */
	private async _manualCheckGHTagIfDisabled(explicit: boolean): Promise<CodexCheckUpdateRespose> {
		const GITHUB_RELEASES_URL = 'https://github.com/Suryanshu-Nabheet/CodeX/releases/latest';
		try {
			const response = await fetch('https://api.github.com/repos/Suryanshu-Nabheet/codex/releases/latest');

			const data = await response.json();
			const rawTag: string = data.tag_name ?? '';
			// Normalize both sides: strip leading 'v' for comparison
			const latestVersion = rawTag.replace(/^v/, '')
			const myVersion = (this._productService.codexVersion || this._productService.version).replace(/^v/, '')

			const isUpToDate = myVersion === latestVersion && response.ok

			let message: string | null
			let action: 'reinstall' | undefined

			if (explicit) {
				if (response.ok) {
					if (!isUpToDate) {
						message = `A new version of CodeX (${latestVersion}) is available! Download it from [GitHub releases](${GITHUB_RELEASES_URL}) — auto-updates are disabled on this platform.`
						action = 'reinstall'
					} else {
						message = 'CodeX is up to date!'
					}
				} else {
					message = `Could not reach GitHub to check for updates (HTTP ${response.status}). Check [GitHub releases](${GITHUB_RELEASES_URL}) manually.`
					action = 'reinstall'
				}
			} else {
				// Silent background check: only notify if there actually IS an update
				if (response.ok && !isUpToDate) {
					message = `A new version of CodeX (${latestVersion}) is available! Download it from [GitHub releases](${GITHUB_RELEASES_URL}).`
					action = 'reinstall'
				} else {
					message = null
				}
			}

			return { message, action } as const
		} catch (e: any) {
			if (explicit) {
				return {
					message: `Error checking for updates: ${e?.message ?? String(e)}. Check [GitHub releases](${GITHUB_RELEASES_URL}) manually.`,
					action: 'reinstall',
				}
			} else {
				return { message: null } as const
			}
		}
	}
}
