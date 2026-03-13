/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Suryanshu Nabheet All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useEffect, useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp, X } from 'lucide-react';
import { useSettingsState } from '../util/services.js';
import { errorDetails } from '../../../../common/sendLLMMessageTypes.js';


export const ErrorDisplay = ({
	message: message_,
	fullError,
	onDismiss,
	showDismiss,
}: {
	message: string,
	fullError: Error | null,
	onDismiss: (() => void) | null,
	showDismiss?: boolean,
}) => {
	const [isExpanded, setIsExpanded] = useState(false);

	const details = errorDetails(fullError)
	const isExpandable = !!details

	const message = message_ + ''

	return (
		<div className='border border-codex-border-3 rounded overflow-hidden bg-codex-bg-3 my-1'>
			{/* Header */}
			<div className="select-none flex justify-between items-center py-1 px-2 border-b border-codex-border-3 cursor-default bg-red-500/5">
				<div className="flex items-center gap-2">
					<AlertCircle className='h-3.5 w-3.5 text-red-500' />
					<span className="text-[12px] font-semibold text-red-500 uppercase tracking-wider">
						Error
					</span>
				</div>
				<div className='flex items-center gap-1'>
					{isExpandable && (
						<button className='text-codex-fg-3 hover:text-codex-fg-1 p-1 transition-colors'
							onClick={() => setIsExpanded(!isExpanded)}
						>
							{isExpanded ? (
								<ChevronUp className='h-3.5 w-3.5' />
							) : (
								<ChevronDown className='h-3.5 w-3.5' />
							)}
						</button>
					)}
					{showDismiss && onDismiss && (
						<button className='text-codex-fg-3 hover:text-red-500 p-1 transition-colors'
							onClick={onDismiss}
						>
							<X className='h-3.5 w-3.5' />
						</button>
					)}
				</div>
			</div>

			{/* Main Content */}
			<div className='p-3 text-sm leading-relaxed text-codex-fg-1'>
				{message}
			</div>

			{/* Decomposed Details */}
			{isExpanded && details && (
				<div className='border-t border-codex-border-3 bg-black/10 p-3'>
					<div className='flex items-center gap-2 mb-2'>
						<span className='text-[10px] font-bold uppercase text-codex-fg-4'>Details</span>
					</div>
					<pre className='text-xs font-mono text-codex-fg-2 whitespace-pre-wrap break-all leading-tight opacity-80'>
						{details}
					</pre>
				</div>
			)}
		</div>
	);
};
