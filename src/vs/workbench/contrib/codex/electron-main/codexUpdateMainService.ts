/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Suryanshu Nabheet All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { IEnvironmentMainService } from '../../../../platform/environment/electron-main/environmentMainService.js';
import { IUpdateService, StateType } from '../../../../platform/update/common/update.js';
import { ICodexUpdateService } from '../common/codexUpdateService.js';
import { CodexCheckUpdateRespose } from '../common/codexUpdateServiceTypes.js';

export class CodexMainUpdateService extends Disposable implements ICodexUpdateService {
	_serviceBrand: undefined;

	constructor(
		@IEnvironmentMainService private readonly _envMainService: IEnvironmentMainService,
		@IUpdateService private readonly _updateService: IUpdateService,
	) {
		super();
	}

	async check(explicit: boolean): Promise<CodexCheckUpdateRespose> {
		// Disable update checks in development mode
		if (!this._envMainService.isBuilt) {
			return { message: null };
		}

		const state = this._updateService.state;

		// Map the internal update service state to our response format
		switch (state.type) {
			case StateType.AvailableForDownload:
				return { message: 'A new update is available.', action: 'download' };

			case StateType.Downloading:
				return { message: 'Downloading update...' };

			case StateType.Downloaded:
				return { message: 'Update downloaded and ready to apply.', action: 'apply' };

			case StateType.Ready:
				return { message: 'Update ready. Restart CodeX to apply.', action: 'restart' };

			case StateType.Disabled:
				// If fully disabled, we don't show any message unless explicitly asked
				return { message: explicit ? 'Updates are disabled.' : null };

			case StateType.CheckingForUpdates:
				return { message: explicit ? 'Checking for updates...' : null };

			case StateType.Idle:
				// If we are idle, it means we've already checked and found nothing, or haven't checked yet.
				// If checking was explicit, we trigger a real check.
				if (explicit) {
					const newState = await this._awaitCheckForUpdates(true);
					return this._mapStateToResponse(newState, true);
				}
				return { message: null };

			default:
				return { message: null };
		}
	}

	private _mapStateToResponse(state: any, explicit: boolean): CodexCheckUpdateRespose {
		switch (state.type) {
			case StateType.AvailableForDownload: return { message: 'A new update is available.', action: 'download' };
			case StateType.Downloaded: return { message: 'Update downloaded.', action: 'apply' };
			case StateType.Ready: return { message: 'Restart CodeX to apply updates.', action: 'restart' };
			case StateType.Idle: return { message: explicit ? 'CodeX is up to date.' : null };
			default: return { message: null };
		}
	}

	private _awaitCheckForUpdates(explicit: boolean): Promise<any> {
		return new Promise(resolve => {
			if (this._updateService.state.type !== StateType.CheckingForUpdates) {
				this._updateService.checkForUpdates(explicit).catch(() => { });
			}

			const timeout = setTimeout(() => {
				listener.dispose();
				resolve(this._updateService.state);
			}, 10000);

			const listener = this._updateService.onStateChange(newState => {
				if (newState.type !== StateType.CheckingForUpdates) {
					clearTimeout(timeout);
					listener.dispose();
					resolve(newState);
				}
			});
		});
	}
}
