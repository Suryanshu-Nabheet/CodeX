/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Suryanshu Nabheet All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useEffect, useState } from 'react'
import { useIsDark } from '../util/services.js'
import ErrorBoundary from '../sidebar-tsx/ErrorBoundary.js'
import { QuickEditChat } from './QuickEditChat.js'
import { QuickEditPropsType } from '../../../quickEditActions.js'

export const QuickEdit = (props: QuickEditPropsType) => {

	const isDark = useIsDark()

	return <div className={`@@codex-scope ${isDark ? 'dark' : ''}`}>
		<ErrorBoundary>
			<QuickEditChat {...props} />
		</ErrorBoundary>
	</div>


}
