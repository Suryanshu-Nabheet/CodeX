/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Suryanshu Nabheet All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { mountFnGenerator } from '../util/mountFnGenerator.js'
import { QuickEdit } from './QuickEdit.js'


import { TerminalQuickEdit } from './TerminalQuickEdit.js'


export const mountCtrlK = mountFnGenerator(QuickEdit)
export const mountTerminalCtrlK = mountFnGenerator(TerminalQuickEdit)



