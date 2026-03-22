/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Suryanshu Nabheet All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react'; // Added useRef import just in case it was missed, though likely already present
import { ProviderName, SettingName, displayInfoOfSettingName, providerNames, CodexStatefulModelInfo, customSettingNamesOfProvider, RefreshableProviderName, refreshableProviderNames, displayInfoOfProviderName, nonlocalProviderNames, localProviderNames, GlobalSettingName, displayInfoOfFeatureName, isProviderNameDisabled, FeatureName, hasDownloadButtonsOnModelsProviderNames, subTextMdOfProviderName } from '../../../../common/codexSettingsTypes.js'
import ErrorBoundary from '../sidebar-tsx/ErrorBoundary.js'
import { CodexButtonBgDarken, CodexCustomDropdownBox, CodexInputBox2, CodexSimpleInputBox, CodexSwitch } from '../util/inputs.js'
import { useAccessor, useIsDark, useIsOptedOut, useRefreshModelListener, useRefreshModelState, useSettingsState } from '../util/services.js'
import { X, RefreshCw, Loader2, Check, Plus, Package, Cloud, HardDrive, Zap, Settings as SettingsIcon, CircuitBoard, List } from 'lucide-react'
import { ModelDropdown } from './ModelDropdown.js'
import { ChatMarkdownRender } from '../markdown/ChatMarkdownRender.js'
import { WarningBox } from './WarningBox.js'
import { os } from '../../../../common/helpers/systemInfo.js'
import { IconLoading } from '../sidebar-tsx/SidebarChat.js'
import { ToolApprovalType, toolApprovalTypes } from '../../../../common/toolsServiceTypes.js'
import Severity from '../../../../../../../base/common/severity.js'
import { getModelCapabilities, modelOverrideKeys, ModelOverrides } from '../../../../common/modelCapabilities.js';
import { TransferEditorType, TransferFilesInfo } from '../../../extensionTransferTypes.js';
import { MCPServer } from '../../../../common/mcpServiceTypes.js';
import { useMCPServiceState } from '../util/services.js';
import { OPT_OUT_KEY } from '../../../../common/storageKeys.js';
import { StorageScope, StorageTarget } from '../../../../../../../platform/storage/common/storage.js';


type Tab =
	| 'models'
	| 'localProviders'
	| 'providers'
	| 'featureOptions'
	| 'mcp'
	| 'general'
	| 'all';


const ButtonLeftTextRightOption = ({ text, leftButton }: { text: string, leftButton?: React.ReactNode }) => {

	return <div className='flex items-center text-codex-fg-3 px-3 py-0.5 rounded-sm overflow-hidden gap-2'>
		{leftButton ? leftButton : null}
		<span>
			{text}
		</span>
	</div>
}

// models
const RefreshModelButton = ({ providerName }: { providerName: RefreshableProviderName }) => {

	const refreshModelState = useRefreshModelState()

	const accessor = useAccessor()
	const refreshModelService = accessor.get('IRefreshModelService')
	const metricsService = accessor.get('IMetricsService')

	const [justFinished, setJustFinished] = useState<null | 'finished' | 'error'>(null)

	useRefreshModelListener(
		useCallback((providerName2, refreshModelState) => {
			if (providerName2 !== providerName) return
			const { state } = refreshModelState[providerName]
			if (!(state === 'finished' || state === 'error')) return
			// now we know we just entered 'finished' state for this providerName
			setJustFinished(state)
			const tid = setTimeout(() => { setJustFinished(null) }, 2000)
			return () => clearTimeout(tid)
		}, [providerName])
	)

	const { state } = refreshModelState[providerName]

	const { title: providerTitle } = displayInfoOfProviderName(providerName)

	return <ButtonLeftTextRightOption

		leftButton={
			<button
				className='flex items-center'
				disabled={state === 'refreshing' || justFinished !== null}
				onClick={() => {
					refreshModelService.startRefreshingModels(providerName, { enableProviderOnSuccess: false, doNotFire: false })
					metricsService.capture('Click', { providerName, action: 'Refresh Models' })
				}}
			>
				{justFinished === 'finished' ? <Check className='stroke-green-500 size-3' />
					: justFinished === 'error' ? <X className='stroke-red-500 size-3' />
						: state === 'refreshing' ? <Loader2 className='size-3 animate-spin' />
							: <RefreshCw className='size-3' />}
			</button>
		}

		text={justFinished === 'finished' ? `${providerTitle} Models are up-to-date!`
			: justFinished === 'error' ? `${providerTitle} not found!`
				: `Manually refresh ${providerTitle} models.`}
	/>
}

const RefreshableModels = () => {
	const settingsState = useSettingsState()


	const buttons = refreshableProviderNames.map(providerName => {
		if (!settingsState.settingsOfProvider[providerName]._didFillInProviderSettings) return null
		return <RefreshModelButton key={providerName} providerName={providerName} />
	})

	return <>
		{buttons}
	</>

}



export const AnimatedCheckmarkButton = ({ text, className }: { text?: string, className?: string }) => {
	const [dashOffset, setDashOffset] = useState(40);

	useEffect(() => {
		const startTime = performance.now();
		const duration = 500; // 500ms animation

		const animate = (currentTime: number) => {
			const elapsed = currentTime - startTime;
			const progress = Math.min(elapsed / duration, 1);
			const newOffset = 40 - (progress * 40);

			setDashOffset(newOffset);

			if (progress < 1) {
				requestAnimationFrame(animate);
			}
		};

		const animationId = requestAnimationFrame(animate);
		return () => cancelAnimationFrame(animationId);
	}, []);

	return <div
		className={`flex items-center gap-1.5 w-fit
			${className ? className : `px-2 py-0.5 text-xs text-zinc-900 bg-zinc-100 rounded-sm`}
		`}
	>
		<svg className="size-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
			<path
				d="M5 13l4 4L19 7"
				stroke="currentColor"
				strokeWidth="2"
				strokeLinecap="round"
				strokeLinejoin="round"
				style={{
					strokeDasharray: 40,
					strokeDashoffset: dashOffset
				}}
			/>
		</svg>
		{text}
	</div>
}


const AddButton = ({ disabled, text = 'Add', ...props }: { disabled?: boolean, text?: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) => {

	return <button
		disabled={disabled}
		className={`bg-[var(--vscode-button-background)] px-3 py-1 text-[var(--vscode-button-foreground)] rounded-sm ${!disabled ? 'hover:bg-[var(--vscode-button-hoverBackground)] cursor-pointer' : 'opacity-50 cursor-not-allowed bg-opacity-70'}`}
		{...props}
	>{text}</button>

}

// ConfirmButton prompts for a second click to confirm an action, cancels if clicking outside
const ConfirmButton = ({ children, onConfirm, className }: { children: React.ReactNode, onConfirm: () => void, className?: string }) => {
	const [confirm, setConfirm] = useState(false);
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		if (!confirm) return;
		const handleClickOutside = (e: MouseEvent) => {
			if (ref.current && !ref.current.contains(e.target as Node)) {
				setConfirm(false);
			}
		};
		document.addEventListener('click', handleClickOutside);
		return () => document.removeEventListener('click', handleClickOutside);
	}, [confirm]);
	return (
		<div ref={ref} className={`inline-block`}>
			<CodexButtonBgDarken className={className} onClick={() => {
				if (!confirm) {
					setConfirm(true);
				} else {
					onConfirm();
					setConfirm(false);
				}
			}}>
				{confirm ? `Confirm Reset` : children}
			</CodexButtonBgDarken>
		</div>
	);
};

// ---------------- Simplified Model Settings Dialog ------------------

// keys of ModelOverrides we allow the user to override



// This new dialog replaces the verbose UI with a single JSON override box.
const SimpleModelSettingsDialog = ({
	isOpen,
	onClose,
	modelInfo,
}: {
	isOpen: boolean;
	onClose: () => void;
	modelInfo: { modelName: string; providerName: ProviderName; type: 'autodetected' | 'custom' | 'default' } | null;
}) => {
	if (!isOpen || !modelInfo) return null;

	const { modelName, providerName, type } = modelInfo;
	const accessor = useAccessor()
	const settingsState = useSettingsState()
	const mouseDownInsideModal = useRef(false); // Ref to track mousedown origin
	const settingsStateService = accessor.get('ICodexSettingsService')

	// current overrides and defaults
	const defaultModelCapabilities = getModelCapabilities(providerName, modelName, undefined);
	const currentOverrides = settingsState.overridesOfModel?.[providerName]?.[modelName] ?? undefined;
	const { recognizedModelName, isUnrecognizedModel } = defaultModelCapabilities

	// Create the placeholder with the default values for allowed keys
	const partialDefaults: Partial<ModelOverrides> = {};
	for (const k of modelOverrideKeys) { if (defaultModelCapabilities[k]) partialDefaults[k] = defaultModelCapabilities[k] as any; }
	const placeholder = JSON.stringify(partialDefaults, null, 2);

	const [overrideEnabled, setOverrideEnabled] = useState<boolean>(() => !!currentOverrides);

	const [errorMsg, setErrorMsg] = useState<string | null>(null);

	const textAreaRef = useRef<HTMLTextAreaElement | null>(null)

	// reset when dialog toggles
	useEffect(() => {
		if (!isOpen) return;
		const cur = settingsState.overridesOfModel?.[providerName]?.[modelName];
		setOverrideEnabled(!!cur);
		setErrorMsg(null);
	}, [isOpen, providerName, modelName, settingsState.overridesOfModel, placeholder]);

	const onSave = async () => {
		// if disabled override, reset overrides
		if (!overrideEnabled) {
			await settingsStateService.setOverridesOfModel(providerName, modelName, undefined);
			onClose();
			return;
		}

		// enabled overrides
		// parse json
		let parsedInput: Record<string, unknown>

		if (textAreaRef.current?.value) {
			try {
				parsedInput = JSON.parse(textAreaRef.current.value);
			} catch (e) {
				setErrorMsg('Invalid JSON');
				return;
			}
		} else {
			setErrorMsg('Invalid JSON');
			return;
		}

		// only keep allowed keys
		const cleaned: Partial<ModelOverrides> = {};
		for (const k of modelOverrideKeys) {
			if (!(k in parsedInput)) continue
			const isEmpty = parsedInput[k] === '' || parsedInput[k] === null || parsedInput[k] === undefined;
			if (!isEmpty) {
				cleaned[k] = parsedInput[k] as any;
			}
		}
		await settingsStateService.setOverridesOfModel(providerName, modelName, cleaned);
		onClose();
	};

	const sourcecodeOverridesLink = `https://github.com/codexeditor/codex/blob/2e5ecb291d33afbe4565921664fb7e183189c1c5/src/vs/workbench/contrib/codex/common/modelCapabilities.ts#L146-L172`

	return (
		<div // Backdrop
			className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999999]"
			onMouseDown={() => {
				mouseDownInsideModal.current = false;
			}}
			onMouseUp={() => {
				if (!mouseDownInsideModal.current) {
					onClose();
				}
				mouseDownInsideModal.current = false;
			}}
		>
			{/* MODAL */}
			<div
				className="bg-codex-bg-1 rounded-md p-4 max-w-xl w-full shadow-xl overflow-y-auto max-h-[90vh]"
				onClick={(e) => e.stopPropagation()} // Keep stopping propagation for normal clicks inside
				onMouseDown={(e) => {
					mouseDownInsideModal.current = true;
					e.stopPropagation();
				}}
			>
				<div className="flex justify-between items-center mb-4">
					<h3 className="text-lg font-medium">
						Change Defaults for {modelName} ({displayInfoOfProviderName(providerName).title})
					</h3>
					<button
						onClick={onClose}
						className="text-codex-fg-3 hover:text-codex-fg-1"
					>
						<X className="size-5" />
					</button>
				</div>

				{/* Display model recognition status */}
				<div className="text-sm text-codex-fg-3 mb-4">
					{type === 'default' ? `${modelName} comes packaged with Codex, so you shouldn't need to change these settings.`
						: isUnrecognizedModel
							? `Model not recognized by Codex.`
							: `Codex recognizes ${modelName} ("${recognizedModelName}").`}
				</div>


				{/* override toggle */}
				<div className="flex items-center gap-2 mb-4">
					<CodexSwitch size='xs' value={overrideEnabled} onChange={setOverrideEnabled} />
					<span className="text-codex-fg-3 text-sm">Override model defaults</span>
				</div>

				{/* Informational link */}
				{overrideEnabled && <div className="text-sm text-codex-fg-3 mb-4">
					<ChatMarkdownRender string={`See the [sourcecode](${sourcecodeOverridesLink}) for a reference on how to set this JSON (advanced).`} chatMessageLocation={undefined} />
				</div>}

				<textarea
					key={overrideEnabled + ''}
					ref={textAreaRef}
					className={`w-full min-h-[200px] p-2 rounded-sm border border-codex-border-2 bg-codex-bg-2 resize-none font-mono text-sm ${!overrideEnabled ? 'text-codex-fg-3' : ''}`}
					defaultValue={overrideEnabled && currentOverrides ? JSON.stringify(currentOverrides, null, 2) : placeholder}
					placeholder={placeholder}
					readOnly={!overrideEnabled}
				/>
				{errorMsg && (
					<div className="text-red-500 mt-2 text-sm">{errorMsg}</div>
				)}


				<div className="flex justify-end gap-2 mt-4">
					<CodexButtonBgDarken onClick={onClose} className="px-3 py-1">
						Cancel
					</CodexButtonBgDarken>
					<CodexButtonBgDarken
						onClick={onSave}
						className="px-3 py-1 bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)]"
					>
						Save
					</CodexButtonBgDarken>
				</div>
			</div>
		</div>
	);
};




export const ModelDump = ({ filteredProviders }: { filteredProviders?: ProviderName[] }) => {
	const accessor = useAccessor()
	const settingsStateService = accessor.get('ICodexSettingsService')
	const settingsState = useSettingsState()

	// State to track which model's settings dialog is open
	const [openSettingsModel, setOpenSettingsModel] = useState<{
		modelName: string,
		providerName: ProviderName,
		type: 'autodetected' | 'custom' | 'default'
	} | null>(null);

	// States for add model functionality
	const [isAddModelOpen, setIsAddModelOpen] = useState(false);
	const [showCheckmark, setShowCheckmark] = useState(false);
	const [userChosenProviderName, setUserChosenProviderName] = useState<ProviderName | null>(null);
	const [modelName, setModelName] = useState<string>('');
	const [errorString, setErrorString] = useState('');

	// a dump of all the enabled providers' models
	const modelDump: (CodexStatefulModelInfo & { providerName: ProviderName, providerEnabled: boolean })[] = []

	// Use either filtered providers or all providers
	const providersToShow = filteredProviders || providerNames;

	for (let providerName of providersToShow) {
		const providerSettings = settingsState.settingsOfProvider[providerName]
		// if (!providerSettings.enabled) continue
		modelDump.push(...providerSettings.models.map(model => ({ ...model, providerName, providerEnabled: !!providerSettings._didFillInProviderSettings })))
	}

	// sort by hidden
	modelDump.sort((a, b) => {
		return Number(b.providerEnabled) - Number(a.providerEnabled)
	})

	// Add model handler
	const handleAddModel = () => {
		if (!userChosenProviderName) {
			setErrorString('Please select a provider.');
			return;
		}
		if (!modelName) {
			setErrorString('Please enter a model name.');
			return;
		}

		// Check if model already exists
		if (settingsState.settingsOfProvider[userChosenProviderName].models.find(m => m.modelName === modelName)) {
			setErrorString(`This model already exists.`);
			return;
		}

		settingsStateService.addModel(userChosenProviderName, modelName);
		setShowCheckmark(true);
		setTimeout(() => {
			setShowCheckmark(false);
			setIsAddModelOpen(false);
			setUserChosenProviderName(null);
			setModelName('');
		}, 1500);
		setErrorString('');
	};

	return (
		<div className="flex flex-col">
			<div className="relative mb-8 group">
				<input
					className="w-full bg-codex-bg-2 text-[13px] text-codex-fg-2 py-2.5 px-4 rounded-md border border-codex-border-2 focus:outline-none focus:border-[var(--vscode-focusBorder)] placeholder:text-codex-fg-4 transition-all"
					placeholder="Search model"
					value={modelName || ''}
					onChange={(e) => setModelName(e.target.value)}
				/>
				<div className="absolute inset-y-0 right-4 flex items-center gap-4">
					<RefreshCw size={14} className="text-codex-fg-4 cursor-pointer hover:text-codex-fg-1 hover:rotate-180 transition-all duration-500" />
				</div>
			</div>
			<div className="flex flex-col gap-10">
				{providerNames.map(providerName => {
					const modelsOfProvider = modelDump.filter(m => m.providerName === providerName);
					if (modelsOfProvider.length === 0 && !nonlocalProviderNames.includes(providerName)) return null;
					const { title: providerTitle } = displayInfoOfProviderName(providerName);

					const query = (modelName || '').toLowerCase();
					const filteredModels = modelsOfProvider.filter(m => m.modelName.toLowerCase().includes(query));

					// If searching and no models match this provider, hide the whole provider division
					if (query && filteredModels.length === 0) return null;

					return (
						<div key={providerName} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
							<div className="flex items-center justify-between mb-4 px-1">
								<h3 className="text-[12px] font-bold text-codex-fg-1 uppercase tracking-[0.15em]">{providerTitle}</h3>
								<div className="h-[1px] flex-1 bg-gradient-to-r from-[var(--vscode-widget-border)] to-transparent ml-6"></div>
							</div>

							{/* Provider Settings (API Keys, etc) */}
							<div className="mb-4 px-1">
								<SettingsForProvider providerName={providerName} showProviderTitle={false} showProviderSuggestions={false} />
							</div>

							<div className="flex flex-col border border-codex-border-2 rounded-md overflow-hidden bg-transparent">
								{filteredModels.map((m, i) => {
									const { isHidden, type, modelName: mName, providerEnabled } = m
									const providerEnabledFill = !!m.providerEnabled
									const disabled = !providerEnabledFill
									const isActive = disabled ? false : !isHidden

									return (
										<div
											key={`${mName}${providerName}`}
											className={`flex items-center justify-between h-[44px] px-4 group hover:bg-codex-bg-2-hover transition-colors border-b border-[var(--vscode-widget-border)] last:border-0`}
										>
											<div className="flex items-center gap-3 truncate">
												<span className={`text-[13px] font-medium truncate transition-colors ${isActive ? 'text-codex-fg-1' : 'text-codex-fg-4'}`}>
													{mName}
												</span>
												<Cloud size={11} className={`transition-opacity ${isActive ? 'text-codex-fg-4 opacity-40 group-hover:opacity-100' : 'text-codex-fg-4 opacity-10'}`} />
											</div>

											<div className="flex items-center gap-4">
												<div className="flex items-center justify-end w-6 opacity-0 group-hover:opacity-100 transition-opacity">
													{!disabled && (
														<button
															onClick={() => { setOpenSettingsModel({ modelName: mName, providerName, type }) }}
															className="w-6 h-6 flex items-center justify-center hover:bg-codex-bg-3 rounded-md transition-colors"
														>
															<Plus size={14} className="text-codex-fg-3 hover:text-codex-fg-1" />
														</button>
													)}
												</div>

												<div
													className={`relative w-8 h-[18px] rounded-full transition-all duration-200 cursor-pointer ${isActive ? 'bg-[var(--vscode-button-background)]' : 'bg-[var(--vscode-checkbox-background)]'}`}
													onClick={() => {
														if (!disabled) settingsStateService.toggleModelHidden(providerName, mName)
													}}
												>
													<div
														className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] bg-white rounded-full shadow-sm transition-transform duration-200 ${isActive ? 'translate-x-[14px]' : 'translate-x-0'}`}
													/>
												</div>
											</div>
										</div>
									)
								})}
							</div>
						</div>
					)
				})}
			</div>

			{/* Model Settings Dialog */}
			<SimpleModelSettingsDialog
				isOpen={openSettingsModel !== null}
				onClose={() => setOpenSettingsModel(null)}
				modelInfo={openSettingsModel}
			/>
		</div>
	)
}



// providers

const ProviderSetting = ({ providerName, settingName, subTextMd }: { providerName: ProviderName, settingName: SettingName, subTextMd: React.ReactNode }) => {

	const { title: settingTitle, placeholder, isPasswordField } = displayInfoOfSettingName(providerName, settingName)

	const accessor = useAccessor()
	const codexSettingsService = accessor.get('ICodexSettingsService')
	const settingsState = useSettingsState()

	const settingValue = settingsState.settingsOfProvider[providerName][settingName] as string // this should always be a string in this component
	if (typeof settingValue !== 'string') {
		console.log('Error: Provider setting had a non-string value.')
		return
	}

	// Create a stable callback reference using useCallback with proper dependencies
	const handleChangeValue = useCallback((newVal: string) => {
		codexSettingsService.setSettingOfProvider(providerName, settingName, newVal)
	}, [codexSettingsService, providerName, settingName]);

	return <ErrorBoundary>
		<div className='my-2'>
			<CodexSimpleInputBox
				value={settingValue}
				onChangeValue={handleChangeValue}
				placeholder={`${settingTitle} (${placeholder})`}
				passwordBlur={isPasswordField}
				compact={true}
			/>
			{!subTextMd ? null : <div className='pt-1.5 pb-2 px-1 text-[12px] text-codex-fg-4 font-medium flex items-center gap-1 opacity-90 hover:opacity-100 transition-opacity'>
				{subTextMd}
			</div>}
		</div>
	</ErrorBoundary>
}

// const OldSettingsForProvider = ({ providerName, showProviderTitle }: { providerName: ProviderName, showProviderTitle: boolean }) => {
// 	const codexSettingsState = useSettingsState()

// 	const needsModel = isProviderNameDisabled(providerName, codexSettingsState) === 'addModel'

// 	// const accessor = useAccessor()
// 	// const codexSettingsService = accessor.get('ICodexSettingsService')

// 	// const { enabled } = codexSettingsState.settingsOfProvider[providerName]
// 	const settingNames = customSettingNamesOfProvider(providerName)

// 	const { title: providerTitle } = displayInfoOfProviderName(providerName)

// 	return <div className='my-4'>

// 		<div className='flex items-center w-full gap-4'>
// 			{showProviderTitle && <h3 className='text-xl truncate'>{providerTitle}</h3>}

// 			{/* enable provider switch */}
// 			{/* <CodexSwitch
// 				value={!!enabled}
// 				onChange={
// 					useCallback(() => {
// 						const enabledRef = codexSettingsService.state.settingsOfProvider[providerName].enabled
// 						codexSettingsService.setSettingOfProvider(providerName, 'enabled', !enabledRef)
// 					}, [codexSettingsService, providerName])}
// 				size='sm+'
// 			/> */}
// 		</div>

// 		<div className='px-0'>
// 			{/* settings besides models (e.g. api key) */}
// 			{settingNames.map((settingName, i) => {
// 				return <ProviderSetting key={settingName} providerName={providerName} settingName={settingName} />
// 			})}

// 			{needsModel ?
// 				providerName === 'ollama' ?
// 					<WarningBox text={`Please install an Ollama model. We'll auto-detect it.`} />
// 					: <WarningBox text={`Please add a model for ${providerTitle} (Models section).`} />
// 				: null}
// 		</div>
// 	</div >
// }


export const SettingsForProvider = ({ providerName, showProviderTitle, showProviderSuggestions }: { providerName: ProviderName, showProviderTitle: boolean, showProviderSuggestions: boolean }) => {
	const codexSettingsState = useSettingsState()

	const needsModel = isProviderNameDisabled(providerName, codexSettingsState) === 'addModel'

	// const accessor = useAccessor()
	// const codexSettingsService = accessor.get('ICodexSettingsService')

	// const { enabled } = codexSettingsState.settingsOfProvider[providerName]
	const settingNames = customSettingNamesOfProvider(providerName)

	const { title: providerTitle } = displayInfoOfProviderName(providerName)

	return <div>

		<div className='flex items-center w-full gap-4'>
			{showProviderTitle && <h3 className='text-xl truncate'>{providerTitle}</h3>}

			{/* enable provider switch */}
			{/* <CodexSwitch
				value={!!enabled}
				onChange={
					useCallback(() => {
						const enabledRef = codexSettingsService.state.settingsOfProvider[providerName].enabled
						codexSettingsService.setSettingOfProvider(providerName, 'enabled', !enabledRef)
					}, [codexSettingsService, providerName])}
				size='sm+'
			/> */}
		</div>

		<div className='px-0'>
			{/* settings besides models (e.g. api key) */}
			{settingNames.map((settingName, i) => {

				return <ProviderSetting
					key={settingName}
					providerName={providerName}
					settingName={settingName}
					subTextMd={i !== settingNames.length - 1 ? null
						: <ChatMarkdownRender string={subTextMdOfProviderName(providerName)} chatMessageLocation={undefined} />}
				/>
			})}

			{showProviderSuggestions && needsModel ?
				providerName === 'ollama' ?
					<WarningBox className="pl-2 mb-4" text={`Please install an Ollama model. We'll auto-detect it.`} />
					: <WarningBox className="pl-2 mb-4" text={`Please add a model for ${providerTitle} (Models section).`} />
				: null}
		</div>
	</div >
}


export const CodexProviderSettings = ({ providerNames }: { providerNames: ProviderName[] }) => {
	return <>
		{providerNames.map(providerName =>
			<SettingsForProvider key={providerName} providerName={providerName} showProviderTitle={true} showProviderSuggestions={true} />
		)}
	</>
}


type TabName = 'models' | 'general'
export const AutoDetectLocalModelsToggle = () => {
	const settingName: GlobalSettingName = 'autoRefreshModels'

	const accessor = useAccessor()
	const codexSettingsService = accessor.get('ICodexSettingsService')
	const metricsService = accessor.get('IMetricsService')

	const codexSettingsState = useSettingsState()

	// right now this is just `enabled_autoRefreshModels`
	const enabled = codexSettingsState.globalSettings[settingName]

	return <ButtonLeftTextRightOption
		leftButton={<CodexSwitch
			size='xxs'
			value={enabled}
			onChange={(newVal) => {
				codexSettingsService.setGlobalSetting(settingName, newVal)
				metricsService.capture('Click', { action: 'Autorefresh Toggle', settingName, enabled: newVal })
			}}
		/>}
		text={`Automatically detect local providers and models (${refreshableProviderNames.map(providerName => displayInfoOfProviderName(providerName).title).join(', ')}).`}
	/>


}

export const AIInstructionsBox = () => {
	const accessor = useAccessor()
	const codexSettingsService = accessor.get('ICodexSettingsService')
	const codexSettingsState = useSettingsState()
	return <CodexInputBox2
		className='min-h-[81px] p-3 rounded-sm'
		initValue={codexSettingsState.globalSettings.aiInstructions}
		placeholder={`Do not change my indentation or delete my comments. When writing TS or JS, do not add ;'s. Write new code using Rust if possible. `}
		multiline
		onChangeText={(newText) => {
			codexSettingsService.setGlobalSetting('aiInstructions', newText)
		}}
	/>
}

const FastApplyMethodDropdown = () => {
	const accessor = useAccessor()
	const codexSettingsService = accessor.get('ICodexSettingsService')

	const options = useMemo(() => [true, false], [])

	const onChangeOption = useCallback((newVal: boolean) => {
		codexSettingsService.setGlobalSetting('enableFastApply', newVal)
	}, [codexSettingsService])

	return <CodexCustomDropdownBox
		className='text-xs text-codex-fg-3 bg-codex-bg-1 border border-codex-border-1 rounded p-0.5 px-1'
		options={options}
		selectedOption={codexSettingsService.state.globalSettings.enableFastApply}
		onChangeOption={onChangeOption}
		getOptionDisplayName={(val) => val ? 'Fast Apply' : 'Slow Apply'}
		getOptionDropdownName={(val) => val ? 'Fast Apply' : 'Slow Apply'}
		getOptionDropdownDetail={(val) => val ? 'Output Search/Replace blocks' : 'Rewrite whole files'}
		getOptionsEqual={(a, b) => a === b}
	/>

}


export const OllamaSetupInstructions = ({ sayWeAutoDetect }: { sayWeAutoDetect?: boolean }) => {
	return <div className='prose-p:my-0 prose-ol:list-decimal prose-p:py-0 prose-ol:my-0 prose-ol:py-0 prose-span:my-0 prose-span:py-0 text-codex-fg-3 text-sm list-decimal select-text'>
		<div className=''><ChatMarkdownRender string={`Ollama Setup Instructions`} chatMessageLocation={undefined} /></div>
		<div className=' pl-6'><ChatMarkdownRender string={`1. Download [Ollama](https://ollama.com/download).`} chatMessageLocation={undefined} /></div>
		<div className=' pl-6'><ChatMarkdownRender string={`2. Open your terminal.`} chatMessageLocation={undefined} /></div>
		<div
			className='pl-6 flex items-center w-fit'
			data-tooltip-id='codex-tooltip-ollama-settings'
		>
			<ChatMarkdownRender string={`3. Run \`ollama pull your_model\` to install a model.`} chatMessageLocation={undefined} />
		</div>
		{sayWeAutoDetect && <div className=' pl-6'><ChatMarkdownRender string={`Codex automatically detects locally running models and enables them.`} chatMessageLocation={undefined} /></div>}
	</div>
}


const RedoOnboardingButton = ({ className }: { className?: string }) => {
	const accessor = useAccessor()
	const codexSettingsService = accessor.get('ICodexSettingsService')
	return <div
		className={`text-codex-fg-4 flex flex-nowrap text-nowrap items-center hover:brightness-110 cursor-pointer ${className}`}
		onClick={() => { codexSettingsService.setGlobalSetting('isOnboardingComplete', false) }}
	>
		See onboarding screen?
	</div>

}







export const ToolApprovalTypeSwitch = ({ approvalType, size, desc }: { approvalType: ToolApprovalType, size: "xxs" | "xs" | "sm" | "sm+" | "md", desc: string }) => {
	const accessor = useAccessor()
	const codexSettingsService = accessor.get('ICodexSettingsService')
	const codexSettingsState = useSettingsState()
	const metricsService = accessor.get('IMetricsService')

	const onToggleAutoApprove = useCallback((approvalType: ToolApprovalType, newValue: boolean) => {
		codexSettingsService.setGlobalSetting('autoApprove', {
			...codexSettingsService.state.globalSettings.autoApprove,
			[approvalType]: newValue
		})
		metricsService.capture('Tool Auto-Accept Toggle', { enabled: newValue })
	}, [codexSettingsService, metricsService])

	return <>
		<CodexSwitch
			size={size}
			value={codexSettingsState.globalSettings.autoApprove[approvalType] ?? false}
			onChange={(newVal) => onToggleAutoApprove(approvalType, newVal)}
		/>
		<span className="text-codex-fg-3 text-xs">{desc}</span>
	</>
}



const EditorLogo = ({ editor, size = 24 }: { editor: TransferEditorType, size?: number }) => {
	switch (editor) {
		case 'Windsurf':
			return (
				<svg fill="currentColor" fillRule="evenodd" height={size} width={size} viewBox="0 0 24 24" className="flex-none leading-none">
					<path clipRule="evenodd" d="M23.78 5.004h-.228a2.187 2.187 0 00-2.18 2.196v4.912c0 .98-.804 1.775-1.76 1.775a1.818 1.818 0 01-1.472-.773L13.168 5.95a2.197 2.197 0 00-1.81-.95c-1.134 0-2.154.972-2.154 2.173v4.94c0 .98-.797 1.775-1.76 1.775-.57 0-1.136-.289-1.472-.773L.408 5.098C.282 4.918 0 5.007 0 5.228v4.284c0 .216.066.426.188.604l5.475 7.889c.324.466.8.812 1.351.938 1.377.316 2.645-.754 2.645-2.117V11.89c0-.98.787-1.775 1.76-1.775h.002c.586 0 1.135.288 1.472.773l4.972 7.163a2.15 2.15 0 001.81.95c1.158 0 2.151-.973 2.151-2.173v-4.939c0-.98.787-1.775 1.76-1.775h.194c.122 0 .22-.1.22-.222V5.225a.221.221 0 00-.22-.222z" />
				</svg>
			);
		case 'Cursor':
			return (
				<svg fill="currentColor" fillRule="evenodd" height={size} width={size} viewBox="0 0 24 24" className="flex-none leading-none">
					<path d="M22.106 5.68L12.5.135a.998.998 0 00-.998 0L1.893 5.68a.84.84 0 00-.419.726v11.186c0 .3.16.577.42.727l9.607 5.547a.999.999 0 00.998 0l9.608-5.547a.84.84 0 00.42-.727V6.407a.84.84 0 00-.42-.726zm-.603 1.176L12.228 22.92c-.063.108-.228.064-.228-.061V12.34a.59.59 0 00-.295-.51l-9.11-5.26c-.107-.062-.063-.228.062-.228h18.55c.264 0 .428.286.296.514z" />
				</svg>
			);
		case 'VS Code':
			return (
				<svg fill="currentColor" height={size} width={size} viewBox="0 0 16 16" className="flex-none leading-none">
					<path d="M10.8635 13.9195C10.6568 14.0195 10.4234 14.0246 10.2186 13.9444C10.1163 13.9044 10.0211 13.843 9.94003 13.7614L4.81622 9.06268L2.5844 10.7656C2.37664 10.9241 2.08603 10.9111 1.89307 10.7347L1.17725 10.0802C0.941229 9.86437 0.940959 9.49112 1.17667 9.27496L3.11219 7.5L1.17667 5.72504C0.940959 5.50888 0.941229 5.13563 1.17725 4.91982L1.89307 4.2653C2.08603 4.08887 2.37664 4.07588 2.5844 4.2344L4.81622 5.93732L9.94003 1.23855C9.97043 1.20797 10.0028 1.18023 10.0368 1.15538C10.2749 0.981429 10.5923 0.949298 10.8635 1.08048L13.54 2.37507C13.8212 2.5111 14.0001 2.79721 14.0001 3.11109V8H10.752V4.53356L6.86425 7.5L10.752 10.4664V8H14.0001V11.8889C14.0001 12.2028 13.8212 12.4889 13.54 12.625L10.8635 13.9195Z" />
				</svg>
			);
	}
}

export const OneClickSwitchCard = ({ fromEditor = 'VS Code', className = '' }: { fromEditor?: TransferEditorType, className?: string }) => {
	const accessor = useAccessor()
	const extensionTransferService = accessor.get('IExtensionTransferService')

	const [transferState, setTransferState] = useState<{ type: 'done', error?: string } | { type: | 'loading' | 'justfinished' }>({ type: 'done' })

	const onClick = async () => {
		if (transferState.type !== 'done') return

		setTransferState({ type: 'loading' })

		const errAcc = await extensionTransferService.transferExtensions(os, fromEditor)

		const hadError = !!errAcc
		if (hadError) {
			setTransferState({ type: 'done', error: errAcc })
		}
		else {
			setTransferState({ type: 'justfinished' })
			setTimeout(() => { setTransferState({ type: 'done' }); }, 3000)
		}
	}

	const isDone = transferState.type === 'done';
	const isLoading = transferState.type === 'loading';
	const isFinished = transferState.type === 'justfinished';

	return (
		<div
			className={`
				relative flex flex-col items-start p-5 rounded-lg border border-codex-border-2 bg-codex-bg-1
				cursor-pointer overflow-hidden ${className}
				${isLoading ? 'opacity-70 pointer-events-none' : ''}
			`}
			onClick={onClick}
		>
			<div className="flex items-center justify-between w-full mb-4">
				<div className={`p-2 rounded-md bg-codex-bg-2 ${isLoading ? 'animate-pulse' : ''}`}>
					<EditorLogo editor={fromEditor} size={28} />
				</div>
				{isFinished && <div className="absolute top-2 right-2"><Check className="text-green-500 size-5" /></div>}
			</div>

			<h3 className="text-[15px] font-semibold text-codex-fg-1 mb-1">Import from {fromEditor}</h3>
			<p className="text-xs text-codex-fg-3 mb-4 leading-relaxed line-clamp-2">
				Transfer extensions, keybindings, and UI settings automatically.
			</p>

			<div className="mt-auto w-full">
				<div className={`
					flex items-center justify-center gap-2 w-full py-2 rounded-md text-xs font-medium transition-all
					${isLoading ? 'bg-codex-bg-3 text-codex-fg-3' :
						isFinished ? 'bg-green-500/10 text-green-500 border border-green-500/20' :
							'bg-[var(--vscode-button-background)] text-[var(--vscode-button-foreground)] hover:bg-[var(--vscode-button-hoverBackground)]'}
				`}>
					{isLoading ? (
						<>
							<Loader2 className="size-3 animate-spin" />
							<span>Transferring...</span>
						</>
					) : isFinished ? (
						<>
							<Check className="size-3" />
							<span>Settings Transferred</span>
						</>
					) : (
						<span>Start Migration</span>
					)}
				</div>
			</div>

			{transferState.type === 'done' && transferState.error && (
				<div className="mt-3 w-full">
					<WarningBox text={transferState.error} />
				</div>
			)}
		</div>
	)
}


export const OneClickSwitchButton = ({ fromEditor = 'VS Code', className = '' }: { fromEditor?: TransferEditorType, className?: string }) => {
	const accessor = useAccessor()
	const extensionTransferService = accessor.get('IExtensionTransferService')

	const [transferState, setTransferState] = useState<{ type: 'done', error?: string } | { type: | 'loading' | 'justfinished' }>({ type: 'done' })

	const onClick = async () => {
		if (transferState.type !== 'done') return

		setTransferState({ type: 'loading' })

		const errAcc = await extensionTransferService.transferExtensions(os, fromEditor)

		// Even if some files were missing, consider it a success if no actual errors occurred
		const hadError = !!errAcc
		if (hadError) {
			setTransferState({ type: 'done', error: errAcc })
		}
		else {
			setTransferState({ type: 'justfinished' })
			setTimeout(() => { setTransferState({ type: 'done' }); }, 3000)
		}
	}

	return <>
		<CodexButtonBgDarken className={`max-w-48 p-4 ${className}`} disabled={transferState.type !== 'done'} onClick={onClick}>
			{transferState.type === 'done' ? `Transfer from ${fromEditor}`
				: transferState.type === 'loading' ? <span className='text-nowrap flex flex-nowrap'>Transferring<IconLoading /></span>
					: transferState.type === 'justfinished' ? <AnimatedCheckmarkButton text='Settings Transferred' className='bg-none' />
						: null
			}
		</CodexButtonBgDarken>
		{transferState.type === 'done' && transferState.error ? <WarningBox text={transferState.error} /> : null}
	</>
}



// full settings

// MCP Server component
const MCPServerComponent = ({ name, server }: { name: string, server: MCPServer }) => {
	const accessor = useAccessor();
	const mcpService = accessor.get('IMCPService');

	const codexSettings = useSettingsState()
	const isOn = codexSettings.mcpUserStateOfName[name]?.isOn

	const removeUniquePrefix = (name: string) => name.split('_').slice(1).join('_')

	return (
		<div className="border border-codex-border-2 bg-codex-bg-1 py-3 px-4 rounded-sm my-2">
			<div className="flex items-center justify-between">
				{/* Left side - status and name */}
				<div className="flex items-center gap-2">
					{/* Status indicator */}
					<div className={`w-2 h-2 rounded-full
						${server.status === 'success' ? 'bg-green-500'
							: server.status === 'error' ? 'bg-red-500'
								: server.status === 'loading' ? 'bg-yellow-500'
									: server.status === 'offline' ? 'bg-codex-fg-3'
										: ''}
					`}></div>

					{/* Server name */}
					<div className="text-sm font-medium text-codex-fg-1">{name}</div>
				</div>

				{/* Right side - power toggle switch */}
				<CodexSwitch
					value={isOn ?? false}
					size='xs'
					disabled={server.status === 'error'}
					onChange={() => mcpService.toggleServerIsOn(name, !isOn)}
				/>
			</div>

			{/* Tools section */}
			{isOn && (
				<div className="mt-3">
					<div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
						{(server.tools ?? []).length > 0 ? (
							(server.tools ?? []).map((tool: { name: string; description?: string }) => (
								<span
									key={tool.name}
									className="px-2 py-0.5 bg-codex-bg-2 text-codex-fg-3 rounded-sm text-xs"

									data-tooltip-id='codex-tooltip'
									data-tooltip-content={tool.description || ''}
									data-tooltip-class-name='codex-max-w-[300px]'
								>
									{removeUniquePrefix(tool.name)}
								</span>
							))
						) : (
							<span className="text-xs text-codex-fg-3">No tools available</span>
						)}
					</div>
				</div>
			)}

			{/* Command badge */}
			{isOn && server.command && (
				<div className="mt-3">
					<div className="text-xs text-codex-fg-3 mb-1">Command:</div>
					<div className="px-2 py-1 bg-codex-bg-2 text-xs font-mono overflow-x-auto whitespace-nowrap text-codex-fg-2 rounded-sm">
						{server.command}
					</div>
				</div>
			)}

			{/* Error message if present */}
			{server.error && (
				<div className="mt-3">
					<WarningBox text={server.error} />
				</div>
			)}
		</div>
	);
};

// Main component that renders the list of servers
const MCPServersList = () => {
	const mcpServiceState = useMCPServiceState()

	let content: React.ReactNode
	if (mcpServiceState.error) {
		content = <div className="text-codex-fg-3 text-sm mt-2">
			{mcpServiceState.error}
		</div>
	}
	else {
		const entries = Object.entries(mcpServiceState.mcpServerOfName)
		if (entries.length === 0) {
			content = <div className="text-codex-fg-3 text-sm mt-2">
				No servers found
			</div>
		}
		else {
			content = entries.map(([name, server]) => (
				<MCPServerComponent key={name} name={name} server={server} />
			))
		}
	}

	return <div className="my-2">{content}</div>
};

export const Settings = () => {
	const isDark = useIsDark()
	// ─── sidebar nav ──────────────────────────
	const [selectedSection, setSelectedSection] =
		useState<Tab>('models');

	const navItems: { tab: Tab; label: string; icon: any }[] = [
		{ tab: 'models', label: 'Models', icon: Package },
		{ tab: 'localProviders', label: 'Local Providers', icon: HardDrive },
		{ tab: 'providers', label: 'Main Providers', icon: Cloud },
		{ tab: 'featureOptions', label: 'Feature Options', icon: Zap },
		{ tab: 'general', label: 'General', icon: SettingsIcon },
		{ tab: 'mcp', label: 'MCP', icon: CircuitBoard },
		{ tab: 'all', label: 'All Settings', icon: List },
	];
	const shouldShowTab = (tab: Tab) => selectedSection === 'all' || selectedSection === tab;
	const accessor = useAccessor()
	const commandService = accessor.get('ICommandService')
	const environmentService = accessor.get('IEnvironmentService')
	const nativeHostService = accessor.get('INativeHostService')
	const settingsState = useSettingsState()
	const codexSettingsService = accessor.get('ICodexSettingsService')
	const chatThreadsService = accessor.get('IChatThreadService')
	const notificationService = accessor.get('INotificationService')
	const mcpService = accessor.get('IMCPService')
	const storageService = accessor.get('IStorageService')
	const metricsService = accessor.get('IMetricsService')
	const isOptedOut = useIsOptedOut()

	const onDownload = (t: 'Chats' | 'Settings') => {
		let dataStr: string
		let downloadName: string
		if (t === 'Chats') {
			// Export chat threads
			dataStr = JSON.stringify(chatThreadsService.state, null, 2)
			downloadName = 'codex-chats.json'
		}
		else if (t === 'Settings') {
			// Export user settings
			dataStr = JSON.stringify(codexSettingsService.state, null, 2)
			downloadName = 'codex-settings.json'
		}
		else {
			dataStr = ''
			downloadName = ''
		}

		const blob = new Blob([dataStr], { type: 'application/json' })
		const url = URL.createObjectURL(blob)
		const a = document.createElement('a')
		a.href = url
		a.download = downloadName
		a.click()
		URL.revokeObjectURL(url)
	}


	// Add file input refs
	const fileInputSettingsRef = useRef<HTMLInputElement>(null)
	const fileInputChatsRef = useRef<HTMLInputElement>(null)

	const [s, ss] = useState(0)

	const handleUpload = (t: 'Chats' | 'Settings') => (e: React.ChangeEvent<HTMLInputElement>,) => {
		const files = e.target.files
		if (!files) return;
		const file = files[0]
		if (!file) return

		const reader = new FileReader();
		reader.onload = () => {
			try {
				const json = JSON.parse(reader.result as string);

				if (t === 'Chats') {
					chatThreadsService.dangerousSetState(json as any)
				}
				else if (t === 'Settings') {
					codexSettingsService.dangerousSetState(json as any)
				}

				notificationService.info(`${t} imported successfully!`)
			} catch (err) {
				notificationService.notify({ message: `Failed to import ${t}`, source: err + '', severity: Severity.Error, })
			}
		};
		reader.readAsText(file);
		e.target.value = '';

		ss(s => s + 1)
	}


	return (
		<div className={`@@codex-scope ${isDark ? 'dark' : ''}`} style={{ height: '100%', width: '100%', overflow: 'auto' }}>
			<div className="flex flex-col md:flex-row w-full gap-6 max-w-[900px] mx-auto mb-32" style={{ minHeight: '80vh' }}>
				{/* ──────────────  SIDEBAR  ────────────── */}

				<aside className="md:w-[200px] w-full p-4 shrink-0 sticky top-0 self-start md:max-h-[100vh] overflow-y-auto custom-scrollbar">
					{/* vertical tab list */}
					<div className="flex flex-col gap-1 pt-6">
						{navItems.map(({ tab, label, icon: Icon }) => (
							<button
								key={tab}
								onClick={() => {
									if (tab === 'all') {
										setSelectedSection('all');
										window.scrollTo({ top: 0, behavior: 'smooth' });
									} else {
										setSelectedSection(tab);
									}
								}}
								className={`
          group flex items-center gap-2.5 py-1.5 px-3 rounded-md text-left transition-all duration-200 text-[13px]
          ${selectedSection === tab
										? 'bg-[var(--vscode-list-activeSelectionBackground)] text-[var(--vscode-list-activeSelectionForeground)] font-medium shadow-sm'
										: 'bg-transparent hover:bg-codex-bg-2 text-codex-fg-3 hover:text-codex-fg-1'}
        `}
							>
								<Icon size={14} className={`${selectedSection === tab ? 'text-[var(--vscode-list-activeSelectionForeground)]' : 'text-codex-fg-4 group-hover:text-codex-fg-2'}`} />
								{label}
							</button>
						))}
					</div>
				</aside>

				{/* ───────────── MAIN PANE ───────────── */}
				<main className="flex-1 p-6 select-none">



					<div className='max-w-3xl'>

						<h1 className='text-3xl w-full font-bold mb-4'>{`Codex's Settings`}</h1>

						<div className='w-full h-[1px] my-4 bg-codex-border-2' />

						{/* All sections in flex container with gap-12 */}
						<div className='flex flex-col gap-12'>
							{/* Models section (formerly FeaturesTab) */}
							<div className={shouldShowTab('models') ? `` : 'hidden'}>
								<ErrorBoundary>
									<h2 className={`text-3xl font-bold mb-6`}>Models</h2>
									<ModelDump />
									<div className='w-full h-[1px] my-4 bg-codex-border-2' />
									<AutoDetectLocalModelsToggle />
									<div className="flex flex-col gap-2 mt-2">
										<RefreshableModels />
									</div>
								</ErrorBoundary>
							</div>

							{/* Local Providers section */}
							<div className={shouldShowTab('localProviders') ? `` : 'hidden'}>
								<ErrorBoundary>
									<h2 className={`text-3xl font-bold mb-6`}>Local Providers</h2>
									<h3 className={`text-codex-fg-3 mb-4`}>{`Codex can access any model that you host locally. We automatically detect your local models by default.`}</h3>

									<div className='opacity-80 mb-6 bg-codex-bg-1 p-4 rounded-md border border-[var(--vscode-widget-border)]'>
										<OllamaSetupInstructions sayWeAutoDetect={true} />
									</div>

									<div className="flex flex-col gap-6">
										<CodexProviderSettings providerNames={localProviderNames} />
									</div>
								</ErrorBoundary>
							</div>

							{/* Main Providers section */}
							<div className={shouldShowTab('providers') ? `` : 'hidden'}>
								<ErrorBoundary>
									<h2 className={`text-3xl font-bold mb-6`}>Main Providers</h2>
									<h3 className={`text-codex-fg-3 mb-4`}>{`Codex can access models from Anthropic, OpenAI, OpenRouter, and more.`}</h3>

									<div className="flex flex-col gap-6">
										<CodexProviderSettings providerNames={nonlocalProviderNames} />
									</div>
								</ErrorBoundary>
							</div>

							{/* Feature Options section */}
							<div className={shouldShowTab('featureOptions') ? `` : 'hidden'}>
								<ErrorBoundary>
									<h2 className={`text-3xl font-bold mb-6`}>Feature Options</h2>
								</ErrorBoundary>

								<div className="flex flex-col gap-6">
									{/* Autocomplete */}
									<div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
										<ErrorBoundary>
											<div className="mb-4">
												<h3 className={`text-xl font-semibold`}>{displayInfoOfFeatureName('Autocomplete')}</h3>
												<p className='text-sm text-codex-fg-3 mt-1'>
													Experimental.{' '}
													<span
														className='hover:brightness-110'
														data-tooltip-id='codex-tooltip'
														data-tooltip-content='We recommend using the largest qwen2.5-coder model you can with Ollama (try qwen2.5-coder:3b).'
														data-tooltip-class-name='codex-max-w-[20px]'
													>
														Only works with FIM models.*
													</span>
												</p>
											</div>

											<div className='p-5 bg-codex-bg-1 rounded-md border border-[var(--vscode-widget-border)]'>
												<ErrorBoundary>
													<div className='flex items-center justify-between'>
														<div className="flex flex-col gap-1">
															<span className='text-[14px] font-medium text-codex-fg-1'>Enable Autocomplete</span>
														</div>
														<div className="flex items-center gap-3">
															<span className='text-xs text-codex-fg-4'>{settingsState.globalSettings.enableAutocomplete ? 'Enabled' : 'Disabled'}</span>
															<CodexSwitch
																size='xs'
																value={settingsState.globalSettings.enableAutocomplete}
																onChange={(newVal) => codexSettingsService.setGlobalSetting('enableAutocomplete', newVal)}
															/>
														</div>
													</div>
												</ErrorBoundary>

												<ErrorBoundary>
													<div className={`mt-4 pt-4 border-t border-[var(--vscode-widget-border)] ${!settingsState.globalSettings.enableAutocomplete ? 'hidden' : ''}`}>
														<label className="text-xs text-codex-fg-4 block mb-2">Completion Model</label>
														<ModelDropdown featureName={'Autocomplete'} className='text-xs text-codex-fg-3 bg-codex-bg-1 border border-[var(--vscode-widget-border)] rounded-md p-1.5 px-3 w-full max-w-sm' />
													</div>
												</ErrorBoundary>
											</div>
										</ErrorBoundary>
									</div>

									{/* Apply */}
									<div className="animate-in fade-in slide-in-from-bottom-2 duration-300 delay-75">
										<ErrorBoundary>
											<div className="mb-4">
												<h3 className={`text-xl font-semibold`}>{displayInfoOfFeatureName('Apply')}</h3>
												<p className='text-sm text-codex-fg-3 mt-1'>Settings that control the behavior of the Apply button.</p>
											</div>

											<div className='p-5 bg-codex-bg-1 rounded-md border border-[var(--vscode-widget-border)]'>
												<div className='flex items-center justify-between'>
													<div className="flex flex-col gap-1">
														<span className='text-[14px] font-medium text-codex-fg-1'>Sync with Chat Model</span>
													</div>
													<div className='flex items-center gap-3'>
														<span className='text-xs text-codex-fg-4 pointer-events-none'>{settingsState.globalSettings.syncApplyToChat ? 'Same as Chat' : 'Different'}</span>
														<CodexSwitch
															size='xs'
															value={settingsState.globalSettings.syncApplyToChat}
															onChange={(newVal) => codexSettingsService.setGlobalSetting('syncApplyToChat', newVal)}
														/>
													</div>
												</div>

												<div className={`mt-4 pt-4 border-t border-[var(--vscode-widget-border)] ${settingsState.globalSettings.syncApplyToChat ? 'hidden' : ''}`}>
													<label className="text-xs text-codex-fg-4 block mb-2">Apply Model</label>
													<ModelDropdown featureName={'Apply'} className='text-xs text-codex-fg-3 bg-codex-bg-1 border border-[var(--vscode-widget-border)] rounded-md p-1.5 px-3 w-full max-w-sm' />
												</div>

												<div className='mt-4 pt-4 border-t border-[var(--vscode-widget-border)]'>
													<div className='flex items-center justify-between'>
														<span className='text-[14px] font-medium text-codex-fg-1'>Apply Method</span>
														<FastApplyMethodDropdown />
													</div>
												</div>
											</div>
										</ErrorBoundary>
									</div>

									{/* Tools Section */}
									<div className="animate-in fade-in slide-in-from-bottom-2 duration-300 delay-100">
										<div className="mb-4">
											<h3 className={`text-xl font-semibold`}>Tools</h3>
											<p className='text-sm text-codex-fg-3 mt-1'>Tools are functions that LLMs can call. Some tools require user approval.</p>
										</div>

										<div className='p-5 bg-codex-bg-1 rounded-md border border-[var(--vscode-widget-border)]'>
											<ErrorBoundary>
												<div className="flex flex-col gap-4">
													{[...toolApprovalTypes].map((approvalType) => {
														return <div key={approvalType} className="flex items-center gap-x-3">
															<ToolApprovalTypeSwitch size='xs' approvalType={approvalType} desc={`Auto-approve ${approvalType}`} />
														</div>
													})}
												</div>
											</ErrorBoundary>

											<div className="mt-6 pt-5 border-t border-[var(--vscode-widget-border)] flex flex-col gap-5">
												<ErrorBoundary>
													<div className='flex items-center justify-between'>
														<div className="flex flex-col gap-1">
															<span className='text-[14px] font-medium text-codex-fg-1'>Attempt to automatically fix lint errors</span>
														</div>
														<div className="flex items-center gap-3">
															<CodexSwitch
																size='xs'
																value={settingsState.globalSettings.includeToolLintErrors}
																onChange={(newVal) => codexSettingsService.setGlobalSetting('includeToolLintErrors', newVal)}
															/>
														</div>
													</div>
												</ErrorBoundary>

												<ErrorBoundary>
													<div className='flex items-center justify-between'>
														<div className="flex flex-col gap-1">
															<span className='text-[14px] font-medium text-codex-fg-1'>Auto-accept LLM code changes</span>
														</div>
														<div className="flex items-center gap-3">
															<CodexSwitch
																size='xs'
																value={settingsState.globalSettings.autoAcceptLLMChanges}
																onChange={(newVal) => codexSettingsService.setGlobalSetting('autoAcceptLLMChanges', newVal)}
															/>
														</div>
													</div>
												</ErrorBoundary>
											</div>
										</div>
									</div>

									{/* Editor */}
									<div className="animate-in fade-in slide-in-from-bottom-2 duration-300 delay-150">
										<div className="mb-4">
											<h3 className={`text-xl font-semibold`}>Editor</h3>
											<p className='text-sm text-codex-fg-3 mt-1'>Settings that control the visibility of Codex suggestions in the code editor.</p>
										</div>

										<div className='p-5 bg-codex-bg-1 rounded-md border border-[var(--vscode-widget-border)]'>
											<ErrorBoundary>
												<div className='flex items-center justify-between'>
													<span className='text-[14px] font-medium text-codex-fg-1'>Show inline suggestions on text selection</span>
													<CodexSwitch
														size='xs'
														value={settingsState.globalSettings.showInlineSuggestions}
														onChange={(newVal) => codexSettingsService.setGlobalSetting('showInlineSuggestions', newVal)}
													/>
												</div>
											</ErrorBoundary>
										</div>
									</div>

									{/* SCM */}
									<div className="animate-in fade-in slide-in-from-bottom-2 duration-300 delay-200">
										<ErrorBoundary>
											<div className="mb-4">
												<h3 className={`text-xl font-semibold`}>{displayInfoOfFeatureName('SCM')}</h3>
												<p className='text-sm text-codex-fg-3 mt-1'>Settings that control the behavior of the commit message generator.</p>
											</div>

											<div className='p-5 bg-codex-bg-1 rounded-md border border-[var(--vscode-widget-border)]'>
												<div className='flex items-center justify-between'>
													<div className="flex flex-col gap-1">
														<span className='text-[14px] font-medium text-codex-fg-1'>Sync with Chat Model</span>
													</div>
													<div className='flex items-center gap-3'>
														<span className='text-xs text-codex-fg-4 pointer-events-none'>{settingsState.globalSettings.syncSCMToChat ? 'Same as Chat' : 'Different'}</span>
														<CodexSwitch
															size='xs'
															value={settingsState.globalSettings.syncSCMToChat}
															onChange={(newVal) => codexSettingsService.setGlobalSetting('syncSCMToChat', newVal)}
														/>
													</div>
												</div>

												<div className={`mt-4 pt-4 border-t border-[var(--vscode-widget-border)] ${settingsState.globalSettings.syncSCMToChat ? 'hidden' : ''}`}>
													<label className="text-xs text-codex-fg-4 block mb-2">SCM Model</label>
													<ModelDropdown featureName={'SCM'} className='text-xs text-codex-fg-3 bg-codex-bg-1 border border-[var(--vscode-widget-border)] rounded-md p-1.5 px-3 w-full max-w-sm' />
												</div>
											</div>
										</ErrorBoundary>
									</div>
								</div>
							</div>

							{/* General section */}
							<div className={shouldShowTab('general') ? `` : 'hidden'}>
								<ErrorBoundary>
									<h2 className='text-3xl font-bold mb-6'>General</h2>
								</ErrorBoundary>

								<div className="flex flex-col gap-6">
									{/* One-Click Switch section */}
									<div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
										<ErrorBoundary>
											<div className="mb-4">
												<h3 className='text-xl font-semibold'>One-Click Migration</h3>
												<p className='text-codex-fg-3 text-sm mt-1'>Transfer your favorite editor settings into Codex instantly.</p>
											</div>

											<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
												<OneClickSwitchCard fromEditor="VS Code" />
												<OneClickSwitchCard fromEditor="Cursor" />
												<OneClickSwitchCard fromEditor="Windsurf" />
											</div>
										</ErrorBoundary>
									</div>

									{/* Import/Export section */}
									<div className="animate-in fade-in slide-in-from-bottom-2 duration-300 delay-75">
										<div className="mb-4">
											<h3 className='text-xl font-semibold'>Data Synchronization</h3>
											<p className='text-codex-fg-3 text-sm mt-1'>Manage your settings and chat history across devices.</p>
										</div>

										<div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
											{/* Settings card */}
											<div className='rounded-lg border border-[var(--vscode-widget-border)] overflow-hidden' style={{ background: 'var(--vscode-editor-background)' }}>
												<div className='px-5 pt-5 pb-4 border-b border-[var(--vscode-widget-border)]'>
													<h5 className="text-[13px] font-semibold text-codex-fg-1 mb-1">Configuration</h5>
													<p className="text-[12px] text-codex-fg-3 leading-relaxed">Backup your provider settings, model preferences, and global configurations.</p>
												</div>
												<div className="flex flex-col gap-2 p-4">
													<button
														className='flex justify-center items-center h-8 w-full rounded-md text-[12px] font-medium transition-opacity hover:opacity-80'
														style={{ background: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-secondaryForeground)', border: '1px solid var(--vscode-widget-border)' }}
														onClick={() => { fileInputSettingsRef.current?.click() }}
													>Import Settings</button>
													<button
														className='flex justify-center items-center h-8 w-full rounded-md text-[12px] font-medium transition-opacity hover:opacity-80'
														style={{ background: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-secondaryForeground)', border: '1px solid var(--vscode-widget-border)' }}
														onClick={() => onDownload('Settings')}
													>Export Settings</button>
													<ConfirmButton
														className='flex justify-center items-center h-8 w-full rounded-md text-[12px] font-medium transition-opacity hover:opacity-80'
														onConfirm={() => { codexSettingsService.resetState(); }}
													>
														<span style={{ color: 'var(--vscode-errorForeground, #e74c3c)' }}>Reset All Settings</span>
													</ConfirmButton>
												</div>
											</div>

											{/* Chats card */}
											<div className='rounded-lg border border-[var(--vscode-widget-border)] overflow-hidden' style={{ background: 'var(--vscode-editor-background)' }}>
												<div className='px-5 pt-5 pb-4 border-b border-[var(--vscode-widget-border)]'>
													<h5 className="text-[13px] font-semibold text-codex-fg-1 mb-1">Chat Logs</h5>
													<p className="text-[12px] text-codex-fg-3 leading-relaxed">Save your conversations and training data to keep your AI context consistent.</p>
												</div>
												<div className="flex flex-col gap-2 p-4">
													<button
														className='flex justify-center items-center h-8 w-full rounded-md text-[12px] font-medium transition-opacity hover:opacity-80'
														style={{ background: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-secondaryForeground)', border: '1px solid var(--vscode-widget-border)' }}
														onClick={() => { fileInputChatsRef.current?.click() }}
													>Import Chats</button>
													<button
														className='flex justify-center items-center h-8 w-full rounded-md text-[12px] font-medium transition-opacity hover:opacity-80'
														style={{ background: 'var(--vscode-button-secondaryBackground)', color: 'var(--vscode-button-secondaryForeground)', border: '1px solid var(--vscode-widget-border)' }}
														onClick={() => onDownload('Chats')}
													>Export Chats</button>
													<ConfirmButton
														className='flex justify-center items-center h-8 w-full rounded-md text-[12px] font-medium transition-opacity hover:opacity-80'
														onConfirm={() => { chatThreadsService.resetState(); }}
													>
														<span style={{ color: 'var(--vscode-errorForeground, #e74c3c)' }}>Reset Chat History</span>
													</ConfirmButton>
												</div>
											</div>
										</div>
									</div>

									{/* Built-in Settings section */}
									<div className="animate-in fade-in slide-in-from-bottom-2 duration-300 delay-100">
										<div className="mb-4">
											<h3 className='text-xl font-semibold'>IDE Environment</h3>
											<p className='text-codex-fg-3 text-sm mt-1'>Configure your fundamental IDE preferences and view logs.</p>
										</div>
										<ErrorBoundary>
											<div className='rounded-lg border border-[var(--vscode-widget-border)] overflow-hidden' style={{ background: 'var(--vscode-editor-background)' }}>
												{([
													{ label: 'General Settings', desc: 'Open the VS Code settings editor', onClick: () => commandService.executeCommand('workbench.action.openSettings') },
													{ label: 'Keyboard Shortcuts', desc: 'Customize keybindings for all commands', onClick: () => commandService.executeCommand('workbench.action.openGlobalKeybindings') },
													{ label: 'Color Theme', desc: 'Change your editor color theme', onClick: () => commandService.executeCommand('workbench.action.selectTheme') },
													{ label: 'View Application Logs', desc: 'Open the log folder in Finder / Explorer', onClick: () => nativeHostService.showItemInFolder(environmentService.logsHome.fsPath) },
												] as const).map(({ label, desc, onClick }, i, arr) => (
													<button
														key={label}
														className={`w-full flex items-center justify-between px-5 py-3.5 text-left transition-colors hover:bg-[var(--vscode-list-hoverBackground)] ${i < arr.length - 1 ? 'border-b border-[var(--vscode-widget-border)]' : ''}`}
														onClick={onClick}
													>
														<div>
															<div className='text-[13px] font-medium text-codex-fg-1'>{label}</div>
															<div className='text-[11px] text-codex-fg-3 mt-0.5'>{desc}</div>
														</div>
														<svg className='size-3.5 text-codex-fg-4 shrink-0 ml-4' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round'><path d='M9 18l6-6-6-6' /></svg>
													</button>
												))}
											</div>
										</ErrorBoundary>
									</div>

									{/* Metrics section */}
									<div className="animate-in fade-in slide-in-from-bottom-2 duration-300 delay-150">
										<div className="mb-4">
											<h3 className='text-xl font-semibold'>Privacy &amp; Metrics</h3>
											<p className='text-codex-fg-3 text-sm mt-1'>We respect your privacy. All data is anonymous and helps us improve your experience.</p>
										</div>

										<div className='rounded-lg border border-[var(--vscode-widget-border)] overflow-hidden' style={{ background: 'var(--vscode-editor-background)' }}>
											<ErrorBoundary>
												<div className='flex items-center justify-between px-5 py-4'>
													<div className="flex flex-col gap-1">
														<span className='text-[13px] font-medium text-codex-fg-1'>Anonymous Usage Tracking</span>
														<span className='text-[12px] text-codex-fg-3'>Codex never sees your code, messages, or API keys.</span>
													</div>
													<div className="flex flex-col items-end gap-1 shrink-0 ml-6">
														<CodexSwitch
															size='xs'
															value={isOptedOut}
															onChange={(newVal) => {
																storageService.store(OPT_OUT_KEY, newVal, StorageScope.APPLICATION, StorageTarget.MACHINE)
																metricsService.capture(`Set metrics opt-out to ${newVal}`, {})
															}}
														/>
														<span className='text-[11px] text-codex-fg-4'>{isOptedOut ? 'Opted out' : 'Tracking active'}</span>
													</div>
												</div>
											</ErrorBoundary>
										</div>
									</div>

									{/* AI Instructions section */}
									<div className="animate-in fade-in slide-in-from-bottom-2 duration-300 delay-200">
										<div className="mb-4">
											<h3 className='text-xl font-semibold'>AI Customization</h3>
											<p className='text-codex-fg-3 text-sm mt-1'>Define custom instructions to guide the AI's behavior across all features.</p>
										</div>

										<div className="flex flex-col gap-4">
											<ErrorBoundary>
												<div className="rounded-lg border border-[var(--vscode-widget-border)] overflow-hidden focus-within:border-[var(--vscode-focusBorder)] transition-all" style={{ background: 'var(--vscode-editor-background)' }}>
													<div className='px-5 pt-4 pb-1'>
														<label className='text-[11px] font-semibold uppercase tracking-wider text-codex-fg-3'>Custom System Instructions</label>
													</div>
													<div className='p-2'>
														<AIInstructionsBox />
													</div>
												</div>
											</ErrorBoundary>

											<div className='rounded-lg border border-[var(--vscode-widget-border)] overflow-hidden' style={{ background: 'var(--vscode-editor-background)' }}>
												<ErrorBoundary>
													<div className='flex items-center justify-between px-5 py-4'>
														<div className="flex flex-col gap-1.5 pr-6">
															<span className='text-[13px] font-semibold text-codex-fg-1'>Disable Built-in System Message</span>
															<span className='text-[12px] text-codex-fg-3 leading-relaxed'>When enabled, Codex removes its built-in system prompt and sends only your custom instructions above.</span>
														</div>
														<div className='flex flex-col items-end gap-1 shrink-0'>
															<CodexSwitch
																size='xs'
																value={!!settingsState.globalSettings.disableSystemMessage}
																onChange={(newValue) => {
																	codexSettingsService.setGlobalSetting('disableSystemMessage', newValue);
																}}
															/>
															<span className='text-[11px] text-codex-fg-4'>
																{settingsState.globalSettings.disableSystemMessage ? 'System prompt off' : 'System prompt on'}
															</span>
														</div>
													</div>
													<div className='border-t border-[var(--vscode-widget-border)] px-5 py-3' style={{ background: 'var(--vscode-textBlockQuote-background, rgba(128,128,128,0.05))' }}>
														<span className='text-[11px] text-codex-fg-3 leading-relaxed'>You can also place a <code className='font-mono px-1 py-0.5 rounded' style={{ background: 'var(--vscode-textCodeBlock-background)', color: 'var(--vscode-textPreformat-foreground)' }}>.codexrules</code> file in your project root to apply per-project instructions automatically.</span>
													</div>
												</ErrorBoundary>
											</div>
										</div>
									</div>
								</div>
							</div>

							{/* MCP section */}
							<div className={shouldShowTab('mcp') ? `` : 'hidden'}>
								<ErrorBoundary>
									<h2 className='text-3xl font-bold mb-6'>MCP</h2>
								</ErrorBoundary>

								<div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
									<ErrorBoundary>
										<div className="mb-4">
											<h3 className={`text-xl font-semibold`}>Model Context Protocol</h3>
											<p className='text-sm text-codex-fg-3 mt-1'>Provide the Agent mode with more tools through MCP servers.</p>
										</div>

										<div className='p-6 bg-codex-bg-1 rounded-md border border-[var(--vscode-widget-border)] flex flex-col gap-6'>
											<div className='flex items-center justify-between'>
												<div className="flex flex-col gap-1">
													<span className='text-[14px] font-medium text-codex-fg-1'>MCP Configurations</span>
													<span className='text-xs text-codex-fg-3'>Manage your active Model Context Protocol servers.</span>
												</div>
												<CodexButtonBgDarken className='px-4 py-2 bg-codex-bg-2 border border-[var(--vscode-widget-border)] rounded-md text-sm font-medium hover:bg-codex-bg-3 transition-all' onClick={async () => { await mcpService.revealMCPConfigFile() }}>
													Add MCP Server
												</CodexButtonBgDarken>
											</div>

											<div className="pt-6 border-t border-[var(--vscode-widget-border)]">
												<ErrorBoundary>
													<MCPServersList />
												</ErrorBoundary>
											</div>
										</div>
									</ErrorBoundary>
								</div>
							</div>





						</div>
					</div>
				</main>
			</div>



			{/* Hidden inputs for file upload */}
			<input key={2 * s} ref={fileInputSettingsRef} type='file' accept='.json' className='hidden' onChange={handleUpload('Settings')} />
			<input key={2 * s + 1} ref={fileInputChatsRef} type='file' accept='.json' className='hidden' onChange={handleUpload('Chats')} />
		</div>
	);
}
