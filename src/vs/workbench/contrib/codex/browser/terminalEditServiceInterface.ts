/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Suryanshu Nabheet All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

export const ITerminalEditService = createDecorator<ITerminalEditService>('terminalEditService');

export interface ITerminalEditService {
	readonly _serviceBrand: undefined;

	showTerminalCtrlK(): void;
	hideTerminalCtrlK(): void;
	generateCommand(instructions: string): Promise<void>;

	isStreaming: boolean;
	onDidChangeStreaming: Event<boolean>;
}
