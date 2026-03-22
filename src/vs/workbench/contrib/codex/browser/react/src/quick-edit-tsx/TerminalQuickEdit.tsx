/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Suryanshu Nabheet All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React from 'react'
import { useIsDark } from '../util/services.js'
import ErrorBoundary from '../sidebar-tsx/ErrorBoundary.js'
import { TerminalQuickEditChat } from './TerminalQuickEditChat.js'

export const TerminalQuickEdit = (props: { onClose: () => void }) => {

	const isDark = useIsDark()

	return <div
		className={`@@codex-scope ${isDark ? 'dark' : ''}`}
		style={{
			pointerEvents: 'auto', // Ensure child box remains interactive
			boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)',
			borderRadius: '8px',
			background: 'transparent'
		}}
	>
		<ErrorBoundary>
			<TerminalQuickEditChat {...props} />
		</ErrorBoundary>
	</div>

}
