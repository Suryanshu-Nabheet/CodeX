/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Suryanshu Nabheet All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSettingsState, useAccessor } from '../util/services.js';
import { TextAreaFns, CodexInputBox2 } from '../util/inputs.js';
import { ButtonStop, ButtonSubmit, IconX, CodexChatArea } from '../sidebar-tsx/SidebarChat.js';
import { useRefState } from '../util/helpers.js';
import { isFeatureNameDisabled } from '../../../../../../../workbench/contrib/codex/common/codexSettingsTypes.js';
import { ITerminalEditService } from '../../../terminalEditServiceInterface.js';


export const TerminalQuickEditChat = ({
	onClose,
}: {
	onClose: () => void;
}) => {

	const accessor = useAccessor()
	const terminalEditService = accessor.get('ITerminalEditService')

	const sizerRef = useRef<HTMLDivElement | null>(null)
	const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
	const textAreaFnsRef = useRef<TextAreaFns | null>(null)

	const settingsState = useSettingsState()

	// state of current message
	const [instructionsAreEmpty, setInstructionsAreEmpty] = useState(true)
	const isDisabled = instructionsAreEmpty || !!isFeatureNameDisabled('Ctrl+K', settingsState)

	const [isStreaming, setIsStreaming] = useState(terminalEditService.isStreaming)
	useEffect(() => {
		const d = terminalEditService.onDidChangeStreaming((s: boolean) => setIsStreaming(s))
		return () => d.dispose()
	}, [terminalEditService])


	const loadingIcon = <div
		className="@@codicon @@codicon-loading @@codicon-modifier-spin @@codicon-no-default-spin text-codex-fg-3"
	/>

	const onSubmit = useCallback(async () => {
		if (isDisabled) return
		if (isStreaming) return

		const text = textAreaRef.current?.value || ''
		if (!text) return

		textAreaFnsRef.current?.disable()
		await terminalEditService.generateCommand(text)
		onClose()
	}, [isStreaming, isDisabled, terminalEditService, onClose])

	const onInterrupt = useCallback(() => {
		// terminalEditService doesn't have interrupt yet, but we can add it if needed
	}, [])

	const onX = useCallback(() => {
		onClose()
	}, [onClose])

	const chatAreaRef = useRef<HTMLDivElement | null>(null)

	useEffect(() => {
		setTimeout(() => textAreaRef.current?.focus(), 100)
	}, [])

	return <div ref={sizerRef} style={{ width: 450, background: 'none' }} className={``}>
		<CodexChatArea
			featureName='Ctrl+K'
			divRef={chatAreaRef}
			compact={true}

			onSubmit={onSubmit}
			onAbort={onInterrupt}
			onClose={onX}
			isStreaming={isStreaming}
			loadingIcon={loadingIcon}
			isDisabled={isDisabled}
			onClickAnywhere={() => { textAreaRef.current?.focus() }}
		>
			<CodexInputBox2
				className='px-1'
				ref={useCallback((r: HTMLTextAreaElement | null) => {
					textAreaRef.current = r
					r?.addEventListener('keydown', (e) => {
						if (e.key === 'Escape')
							onX()
					})
				}, [onX])}
				fnsRef={textAreaFnsRef}
				placeholder="Enter instructions for terminal command..."
				onChangeText={useCallback((newStr: string) => {
					setInstructionsAreEmpty(!newStr)
				}, [])}
				onKeyDown={(e) => {
					if (e.key === 'Enter' && !e.shiftKey) {
						onSubmit()
						return
					}
				}}
				multiline={true}
			/>
		</CodexChatArea>
	</div>
}
