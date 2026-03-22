/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Suryanshu Nabheet All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { ITerminalEditService } from './terminalEditServiceInterface.js';
import { ITerminalService } from '../../terminal/browser/terminal.js';
import { ILLMMessageService } from '../common/sendLLMMessageService.js';
import { Emitter } from '../../../../base/common/event.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { mountTerminalCtrlK } from './react/out/quick-edit-tsx/index.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { terminalCommand_systemMessage, terminalCommand_userMessage } from '../common/prompt/prompts.js';
import { ICodexSettingsService } from '../common/codexSettingsService.js';
import { removeAnsiEscapeCodes } from '../../../../base/common/strings.js';
import { extractCommandFromLLM } from '../common/helpers/extractCodeFromResult.js';
import { IDirectoryStrService } from '../common/directoryStrService.js';



export class TerminalEditService extends Disposable implements ITerminalEditService {
	_serviceBrand: undefined;

	private _isStreaming = false;
	private readonly _onDidChangeStreaming = this._register(new Emitter<boolean>());
	readonly onDidChangeStreaming = this._onDidChangeStreaming.event;

	private _currentMount: { dispose: () => void } | null = null;
	private _overlayDiv: HTMLDivElement | null = null;

	constructor(
		@ITerminalService private readonly _terminalService: ITerminalService,
		@ILLMMessageService private readonly _llmMessageService: ILLMMessageService,
		@IInstantiationService private readonly _instantiationService: IInstantiationService,
		@ICodexSettingsService private readonly _settingsService: ICodexSettingsService,
	) {
		super();
	}


	get isStreaming() { return this._isStreaming; }

	showTerminalCtrlK() {
		if (this._currentMount) {
			this.hideTerminalCtrlK();
		}

		const instance = this._terminalService.activeInstance;
		if (!instance) return;

		// Hide the footer hint and expand its height to push terminal content up
		// This prevents the popup from obscuring the terminal prompt/command
		instance.setFooterVisible(false, 100);

		const container = instance.domElement;
		if (!container) return;

		// Create an invisible full-height overlay to anchor things to the bottom
		this._overlayDiv = document.createElement('div');
		this._overlayDiv.className = 'codex-terminal-quick-edit-container';
		this._overlayDiv.style.position = 'absolute';
		this._overlayDiv.style.top = '0';
		this._overlayDiv.style.left = '0';
		this._overlayDiv.style.right = '0';
		this._overlayDiv.style.bottom = '0'; // Align to bottom of container
		this._overlayDiv.style.display = 'flex';
		this._overlayDiv.style.flexDirection = 'column';
		this._overlayDiv.style.justifyContent = 'flex-end'; // Push content to the bottom
		this._overlayDiv.style.alignItems = 'center';
		this._overlayDiv.style.paddingBottom = '8px'; // Slightly more gap from bottom
		this._overlayDiv.style.pointerEvents = 'none'; // Don't block terminal interactions outside the box
		this._overlayDiv.style.zIndex = '10000'; // Higher z-index to stay on top of other terminal elements


		container.appendChild(this._overlayDiv);

		this._instantiationService.invokeFunction(accessor => {
			try {
				const mount = mountTerminalCtrlK(this._overlayDiv!, accessor, {
					onClose: () => this.hideTerminalCtrlK()
				});
				if (mount) {
					this._currentMount = mount;
				}
			} catch (e) {
				// Failed to mount Terminal Ctrl+K UI
			}
		});
	}


	hideTerminalCtrlK() {
		if (this._currentMount) {
			this._currentMount.dispose();
			this._currentMount = null;
		}
		if (this._overlayDiv) {
			this._overlayDiv.remove();
			this._overlayDiv = null;
		}
		const instance = this._terminalService.activeInstance;
		if (instance) {
			// Restore the footer hint
			instance.setFooterVisible(true);
			instance.focus();
		}
	}


	async generateCommand(instructions: string): Promise<void> {
		const instance = this._terminalService.activeInstance;
		if (!instance) return;

		this._isStreaming = true;
		this._onDidChangeStreaming.fire(this._isStreaming);

		try {
			// Get terminal history
			let terminalHistory = '';
			if (instance.xterm) {
				const lines: string[] = [];
				// getBufferReverseIterator is not available on ITerminalInstance, but it is on XtermTerminal.
				// We can try to access it if we know the structure or use public APIs.
				// Actually terminalToolService used terminal.xterm.getBufferReverseIterator()
				// where terminal is ITerminalInstance.
				// Let's check terminalInstance.ts again to be sure what xterm is there.
				const xterm = (instance as any).xterm;
				if (xterm && typeof xterm.getBufferReverseIterator === 'function') {
					for (const line of xterm.getBufferReverseIterator()) {
						lines.unshift(line);
						if (lines.length > 50) break; // Last 50 lines should be enough context
					}
					terminalHistory = removeAnsiEscapeCodes(lines.join('\n'));
				}
			}

			const directoryStr = await this._instantiationService.invokeFunction(accessor => 
				accessor.get(IDirectoryStrService).getAllDirectoriesStr({ cutOffMessage: '... (structure truncated) ...' })
			);

			const systemMessage = terminalCommand_systemMessage;
			const userMessage = terminalCommand_userMessage({ instructions, terminalHistory, directoryStr });


			await new Promise<void>((resolve, reject) => {
				this._llmMessageService.sendLLMMessage({
					messagesType: 'chatMessages',
					messages: [
						{ role: 'user', content: userMessage }
					],
					separateSystemMessage: systemMessage,
					chatMode: 'agent',
					onText: () => { },
					onFinalMessage: (res) => {
						if (res.fullText) {
							const command = extractCommandFromLLM(res.fullText);
							instance.sendText(command, false);
						}
						resolve();
					},
					onError: (err) => {
						reject(new Error(err.message));
					},
					onAbort: () => {
						resolve();
					},
					logging: { loggingName: 'TerminalCtrlK' },
					modelSelection: this._settingsService.state.modelSelectionOfFeature['Ctrl+K'],
					modelSelectionOptions: undefined,
					overridesOfModel: undefined,
				});
			});
		} catch (e) {
			console.error('Terminal Ctrl+K generation failed', e);
		} finally {
			this._isStreaming = false;
			this._onDidChangeStreaming.fire(this._isStreaming);
		}
	}

}

registerSingleton(ITerminalEditService, TerminalEditService, InstantiationType.Delayed);
