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
import * as dom from '../../../../base/browser/dom.js';
import { IUpdateService } from '../../../../platform/update/common/update.js';
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

	if (res.action) {
		const primary: IAction[] = [];

		/** Open the GitHub releases page in the default browser */
		const openDownloadPage = () => {
			const { window } = dom.getActiveWindow();
			window.open(GITHUB_RELEASES_URL);
		};

		if (res.action === 'reinstall') {
			primary.push({
				label: 'Download Update',
				id: 'codex.updater.reinstall',
				enabled: true,
				tooltip: 'Open the CodeX download page',
				class: undefined,
				run: openDownloadPage,
			});
		}

		if (res.action === 'download') {
			primary.push({
				label: 'Download Update',
				id: 'codex.updater.download',
				enabled: true,
				tooltip: 'Download the latest update',
				class: undefined,
				run: () => {
					// doDownloadUpdate opens the browser and transitions state
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

		// Always include a GitHub repo link
		primary.push({
			id: 'codex.updater.site',
			enabled: true,
			label: 'GitHub Releases',
			tooltip: 'Open the CodeX GitHub releases page',
			class: undefined,
			run: () => {
				const { window } = dom.getActiveWindow();
				window.open(GITHUB_RELEASES_URL);
			},
		});

		actions = {
			primary,
			secondary: [{
				id: 'codex.updater.dismiss',
				enabled: true,
				label: 'Dismiss',
				tooltip: 'Dismiss this notification',
				class: undefined,
				run: () => { notifController.close(); },
			}],
		};
	}

	const notifController = notifService.notify({
		severity: Severity.Info,
		message,
		sticky: true,
		actions,
	});

	return notifController;
};

const notifyErrChecking = (notifService: INotificationService): INotificationHandle => {
	const message = [
		'**CodeX Update Check Failed**',
		`There was an error checking for updates.`,
		`If this persists, please check [GitHub releases](${GITHUB_RELEASES_URL}) for the latest version.`,
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


// ─── Command: Codex: Check for Updates ───────────────────────────────────────

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

		// Close any stale update notification if we are opening a new one
		const prevHandle = CodexUpdateWorkbenchContribution.lastNotifHandle;
		const newHandle = await performCodexCheck(true, notifService, codexUpdateService, metricsService, updateService);

		if (newHandle) {
			prevHandle?.close();
			CodexUpdateWorkbenchContribution.lastNotifHandle = newHandle;
		}
	}
});


// ─── Workbench contribution: auto-check on startup & every 3 hours ───────────

class CodexUpdateWorkbenchContribution extends Disposable implements IWorkbenchContribution {
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

		const { window } = dom.getActiveWindow();

		// First check: 10 s after workbench is ready (enough time for services to settle)
		const initId = window.setTimeout(() => autoCheck(), 10 * 1000);
		this._register({ dispose: () => window.clearTimeout(initId) });

		// Recurring check every 3 hours
		const intervalId = window.setInterval(() => autoCheck(), 3 * 60 * 60 * 1000);
		this._register({ dispose: () => window.clearInterval(intervalId) });
	}
}

registerWorkbenchContribution2(
	CodexUpdateWorkbenchContribution.ID,
	CodexUpdateWorkbenchContribution,
	WorkbenchPhase.BlockRestore
);
