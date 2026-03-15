/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Suryanshu Nabheet All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { mountFnGenerator } from '../util/mountFnGenerator.js'
import { CodexCommandBarMain } from './CodexCommandBar.js'
import { CodexSelectionHelperMain } from './CodexSelectionHelper.js'

export const mountCodexCommandBar = mountFnGenerator(CodexCommandBarMain)

export const mountCodexSelectionHelper = mountFnGenerator(CodexSelectionHelperMain)

