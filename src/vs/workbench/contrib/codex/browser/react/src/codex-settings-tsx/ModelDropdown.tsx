/*--------------------------------------------------------------------------------------
 *  Copyright 2026 Suryanshu Nabheet All rights reserved.
 *  Licensed under the MIT License. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FeatureName, featureNames, isFeatureNameDisabled, ModelSelection, modelSelectionsEqual, ProviderName, providerNames, SettingsOfProvider } from '../../../../../../../workbench/contrib/codex/common/codexSettingsTypes.js'
import { useSettingsState, useRefreshModelState, useAccessor } from '../util/services.js'
import { _CodexSelectBox, CodexCustomDropdownBox } from '../util/inputs.js'
import { SelectBox } from '../../../../../../../base/browser/ui/selectBox/selectBox.js'
import { IconWarning } from '../sidebar-tsx/SidebarChat.js'
import { CODEX_OPEN_SETTINGS_ACTION_ID, CODEX_TOGGLE_SETTINGS_ACTION_ID } from '../../../codexSettingsPane.js'
import { modelFilterOfFeatureName, ModelOption } from '../../../../../../../workbench/contrib/codex/common/codexSettingsService.js'
import { WarningBox } from './WarningBox.js'
import ErrorBoundary from '../sidebar-tsx/ErrorBoundary.js'
import { ChevronRight, Sparkles } from 'lucide-react'

const optionsEqual = (m1: ModelOption[], m2: ModelOption[]) => {
	if (m1.length !== m2.length) return false
	for (let i = 0; i < m1.length; i++) {
		if (!modelSelectionsEqual(m1[i].selection, m2[i].selection)) return false
	}
	return true
}

const ModelSelectBox = ({ options, featureName, className }: { options: ModelOption[], featureName: FeatureName, className: string }) => {
	const accessor = useAccessor()
	const codexSettingsService = accessor.get('ICodexSettingsService')

	const selection = codexSettingsService.state.modelSelectionOfFeature[featureName]
	const selectedOption = selection ? codexSettingsService.state._modelOptions.find(v => modelSelectionsEqual(v.selection, selection))! : options[0]

	const onChangeOption = useCallback((newOption: ModelOption) => {
		codexSettingsService.setModelSelectionOfFeature(featureName, newOption.selection)
	}, [codexSettingsService, featureName])

	return <CodexCustomDropdownBox
		options={options}
		selectedOption={selectedOption}
		onChangeOption={onChangeOption}
		getOptionDisplayName={(option) => option.selection.modelName}
		getOptionDropdownName={(option) => option.selection.modelName}
		getOptionDropdownDetail={(option) => option.selection.providerName}
		getOptionGroupName={(option) => option.selection.providerName.toUpperCase()}
		getOptionsEqual={(a, b) => optionsEqual([a], [b])}
		className={className}
		matchInputWidth={false}
		fixedWidth={260}
		dividedLayout={true}
		maxHeight={featureName === 'Ctrl+K' ? 220 : 350}
	/>
}


const MemoizedModelDropdown = ({ featureName, className }: { featureName: FeatureName, className: string }) => {
	const settingsState = useSettingsState()
	const oldOptionsRef = useRef<ModelOption[]>([])
	const [memoizedOptions, setMemoizedOptions] = useState(oldOptionsRef.current)

	const { filter, emptyMessage } = modelFilterOfFeatureName[featureName]

	useEffect(() => {
		const oldOptions = oldOptionsRef.current
		const newOptions = settingsState._modelOptions.filter((o) => filter(o.selection, { chatMode: settingsState.globalSettings.chatMode, overridesOfModel: settingsState.overridesOfModel }))

		if (!optionsEqual(oldOptions, newOptions)) {
			setMemoizedOptions(newOptions)
		}
		oldOptionsRef.current = newOptions
	}, [settingsState._modelOptions, filter])

	if (memoizedOptions.length === 0) { // Pretty sure this will never be reached unless filter is enabled
		return <WarningBox text={emptyMessage?.message || 'No models available'} />
	}

	return <ModelSelectBox featureName={featureName} options={memoizedOptions} className={className} />

}

export const ModelDropdown = ({ featureName, className }: { featureName: FeatureName, className: string }) => {
	const settingsState = useSettingsState()

	const accessor = useAccessor()
	const commandService = accessor.get('ICommandService')

	const openSettings = () => { commandService.executeCommand(CODEX_OPEN_SETTINGS_ACTION_ID); };


	const { emptyMessage } = modelFilterOfFeatureName[featureName]

	const isDisabled = isFeatureNameDisabled(featureName, settingsState)
	if (isDisabled)
		return <button
			type='button'
			onClick={openSettings}
			className='group flex items-center gap-1.5 rounded-md border border-codex-border-2 bg-codex-bg-1/50 px-2 py-1 text-[11px] text-codex-fg-3 transition-colors hover:border-codex-border-1 hover:text-codex-fg-1'
			aria-label='Set up a model'
		>
			<Sparkles size={12} className='text-codex-link-color' />
			<span>{
				emptyMessage && emptyMessage.priority === 'always' ? emptyMessage.message :
					isDisabled === 'needToEnableModel' ? 'Choose a model to start'
						: isDisabled === 'addModel' ? 'Add a model to start'
							: (isDisabled === 'addProvider' || isDisabled === 'notFilledIn' || isDisabled === 'providerNotAutoDetected') ? 'Set up a provider'
								: 'Set up a provider'
			}</span>
			<ChevronRight size={12} className='opacity-50 transition-transform group-hover:translate-x-0.5' />
		</button>

	return <ErrorBoundary>
		<MemoizedModelDropdown featureName={featureName} className={className} />
	</ErrorBoundary>
}
