/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Suryanshu Nabheet All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { KeyCode, KeyMod } from '../../../../base/common/keyCodes.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { KeybindingWeight } from '../../../../platform/keybinding/common/keybindingsRegistry.js';
import { ITerminalEditService } from './terminalEditServiceInterface.js';
import { localize2 } from '../../../../nls.js';
import { IMetricsService } from '../common/metricsService.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';

export const TERMINAL_CTRL_K_ACTION_ID = 'codex.terminal.quickEdit';

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: TERMINAL_CTRL_K_ACTION_ID,
			f1: true,
			title: localize2('codexTerminalQuickEditAction', 'Codex: Terminal Quick Edit'),
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyCode.KeyK,
				weight: KeybindingWeight.CodexExtension + 10,
				when: ContextKeyExpr.deserialize('terminalFocus'),
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const metricsService = accessor.get(IMetricsService);
		metricsService.capture('Terminal Ctrl+K', {});

		const terminalEditService = accessor.get(ITerminalEditService);
		terminalEditService.showTerminalCtrlK();
	}
});
