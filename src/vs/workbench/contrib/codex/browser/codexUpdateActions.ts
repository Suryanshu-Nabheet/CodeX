/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Suryanshu Nabheet All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import Severity from '../../../../base/common/severity.js';
import { ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';
import { localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { INotificationActions, INotificationHandle, INotificationService } from '../../../../platform/notification/common/notification.js';
import { IMetricsService } from '../common/metricsService.js';
import { ICodexUpdateService } from '../common/codexUpdateService.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IUpdateService, StateType } from '../../../../platform/update/common/update.js';
import { CodexCheckUpdateRespose } from '../common/codexUpdateServiceTypes.js';
import { IAction } from '../../../../base/common/actions.js';

const GITHUB_RELEASES_URL = 'https://github.com/Suryanshu-Nabheet/CodeX/releases/latest';

// ─── Notification helpers ─────────────────────────────────────────────────────

const notifyUpdate = (
	res: CodexCheckUpdateRespose & { message: string },
	notifService: INotificationService,
	updateService: IUpdateService
): INotificationHandle => {
	const message = res.message;

	let actions: INotificationActions | undefined;
	let notifController: INotificationHandle;

	if (res.action) {
		const primary: IAction[] = [];

		if (res.action === 'download') {
			primary.push({
				label: 'Download Update',
				id: 'codex.updater.download',
				enabled: true,
				tooltip: 'Download the latest update in the background',
				class: undefined,
				run: () => {
					updateService.downloadUpdate();
				},
			});
		}

		if (res.action === 'apply') {
			primary.push({
				label: 'Apply Update',
				id: 'codex.updater.apply',
				enabled: true,
				tooltip: 'Apply the downloaded update',
				class: undefined,
				run: () => { updateService.applyUpdate(); },
			});
		}

		if (res.action === 'restart') {
			primary.push({
				label: 'Restart to Update',
				id: 'codex.updater.restart',
				enabled: true,
				tooltip: 'Restart CodeX to finish installing the update',
				class: undefined,
				run: () => { updateService.quitAndInstall(); },
			});
		}

		// Fallback for platforms that cannot self-update (Windows zip)
		if (res.action === 'reinstall') {
			primary.push({
				label: 'Download Update',
				id: 'codex.updater.reinstall',
				enabled: true,
				tooltip: 'Open the CodeX releases page to download the latest version',
				class: undefined,
				run: () => {
					import('electron').then(({ shell }) => shell.openExternal(GITHUB_RELEASES_URL)).catch(() => {
						const win = window as any;
						if (win.open) { win.open(GITHUB_RELEASES_URL); }
					});
				},
			});
		}

		actions = {
			primary,
			secondary: [{
				id: 'codex.updater.dismiss',
				enabled: true,
				label: 'Later',
				tooltip: 'Dismiss this notification',
				class: undefined,
				run: () => { notifController.close(); },
			}],
		};
	}

	notifController = notifService.notify({
		severity: Severity.Info,
		message,
		sticky: true,
		actions,
	});

	return notifController;
};

const notifyErrChecking = (notifService: INotificationService): INotificationHandle => {
	const message = [
		'**Update check failed.**',
		`If this persists, check [GitHub releases](${GITHUB_RELEASES_URL}) for the latest version.`,
	].join('  \n');

	return notifService.notify({
		severity: Severity.Warning,
		message,
		sticky: false,
	});
};


// ─── Core check logic ─────────────────────────────────────────────────────────

const performCodexCheck = async (
	explicit: boolean,
	notifService: INotificationService,
	codexUpdateService: ICodexUpdateService,
	metricsService: IMetricsService,
	updateService: IUpdateService,
): Promise<INotificationHandle | null> => {

	const tag = explicit ? 'Manual' : 'Auto';

	metricsService.capture(`Codex Update ${tag}: Checking...`, {});
	const res = await codexUpdateService.check(explicit);

	if (!res) {
		const handle = notifyErrChecking(notifService);
		metricsService.capture(`Codex Update ${tag}: Error`, { res });
		return handle;
	}

	if (res.message) {
		const handle = notifyUpdate(res, notifService, updateService);
		metricsService.capture(`Codex Update ${tag}: Available`, { message: res.message, action: res.action });
		return handle;
	}

	metricsService.capture(`Codex Update ${tag}: Up to date`, {});
	return null;
};


// ─── Auto-progress: when UpdateService state becomes Downloading/Ready, update the notification ───

const watchUpdateProgress = (
	updateService: IUpdateService,
	notifService: INotificationService,
	contribution: CodexUpdateWorkbenchContribution,
): void => {
	updateService.onStateChange(async state => {
		// When download completes and we're ready to restart, replace the existing notification
		if (state.type === StateType.Ready) {
			CodexUpdateWorkbenchContribution.lastNotifHandle?.close();
			const msg = 'Update downloaded. Restart to apply.';
			const primary: IAction[] = [{
				label: 'Restart to Update',
				id: 'codex.updater.restart.auto',
				enabled: true,
				tooltip: 'Restart CodeX to apply the update',
				class: undefined,
				run: () => updateService.quitAndInstall(),
			}];
			CodexUpdateWorkbenchContribution.lastNotifHandle = notifService.notify({
				severity: Severity.Info,
				message: msg,
				sticky: true,
				actions: {
					primary,
					secondary: [{
						id: 'codex.updater.dismiss.ready',
						enabled: true,
						label: 'Later',
						tooltip: 'Dismiss',
						class: undefined,
						run: () => { CodexUpdateWorkbenchContribution.lastNotifHandle?.close(); },
					}],
				},
			});
		}

		// When download is in progress, show a transient notification
		if (state.type === StateType.Downloading) {
			CodexUpdateWorkbenchContribution.lastNotifHandle?.close();
			CodexUpdateWorkbenchContribution.lastNotifHandle = notifService.notify({
				severity: Severity.Info,
				message: 'Downloading update...',
				sticky: false,
			});
		}
	});
};


// ─── Command: CodeX: Check for Updates ───────────────────────────────────────

registerAction2(class extends Action2 {
	constructor() {
		super({
			f1: true,
			id: 'codex.codexCheckUpdate',
			title: localize2('codexCheckUpdate', 'CodeX: Check for Updates'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const codexUpdateService = accessor.get(ICodexUpdateService);
		const notifService = accessor.get(INotificationService);
		const metricsService = accessor.get(IMetricsService);
		const updateService = accessor.get(IUpdateService);

		const prevHandle = CodexUpdateWorkbenchContribution.lastNotifHandle;
		const newHandle = await performCodexCheck(true, notifService, codexUpdateService, metricsService, updateService);

		if (newHandle) {
			prevHandle?.close();
			CodexUpdateWorkbenchContribution.lastNotifHandle = newHandle;
		}
	}
});


// ─── Workbench contribution: auto-check on startup & every 3 hours ───────────

export class CodexUpdateWorkbenchContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.codex.codexUpdate';

	/** Shared across the manual command so we can close stale notifications. */
	static lastNotifHandle: INotificationHandle | null = null;

	constructor(
		@ICodexUpdateService private readonly codexUpdateService: ICodexUpdateService,
		@IMetricsService private readonly metricsService: IMetricsService,
		@INotificationService private readonly notifService: INotificationService,
		@IUpdateService private readonly updateService: IUpdateService,
	) {
		super();

		// Watch for background state changes (download progress, ready)
		watchUpdateProgress(this.updateService, this.notifService, this);

		const autoCheck = async () => {
			const handle = await performCodexCheck(
				false,
				this.notifService,
				this.codexUpdateService,
				this.metricsService,
				this.updateService,
			);
			if (handle) {
				CodexUpdateWorkbenchContribution.lastNotifHandle?.close();
				CodexUpdateWorkbenchContribution.lastNotifHandle = handle;
			}
		};

		// First check: 30 s after workbench is ready
		const initTimer = setTimeout(() => autoCheck(), 30 * 1000);
		this._register({ dispose: () => clearTimeout(initTimer) });

		// Recurring check every 3 hours
		const intervalTimer = setInterval(() => autoCheck(), 3 * 60 * 60 * 1000);
		this._register({ dispose: () => clearInterval(intervalTimer) });
	}
}

registerWorkbenchContribution2(
	CodexUpdateWorkbenchContribution.ID,
	CodexUpdateWorkbenchContribution,
	WorkbenchPhase.BlockRestore
);
