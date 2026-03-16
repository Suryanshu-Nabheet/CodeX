
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IDisposable } from '../../../../base/common/lifecycle.js';

export const IOnboardingService = createDecorator<IOnboardingService>('onboardingService');

export interface IOnboardingService {
	readonly _serviceBrand: undefined;

	readonly state: IOnboardingState;

	show(): void;
	hide(): void;
	reset(): void;

	saveState(state: Partial<IOnboardingState>): void;
}

export interface IOnboardingState {
	completed: boolean;
	currentStep?: number;
	totalSteps?: number;
	model?: string;
	apiKey?: string;
	theme?: 'light' | 'dark';
	layout?: 'sidebar' | 'floating';
	density?: 'compact' | 'comfortable';
}

export interface IOnboardingStep extends IDisposable {
	readonly element: HTMLElement;
	readonly title?: string;
	readonly canProceed?: boolean;
	updateState?(state: IOnboardingState): void;
	onEnter?(): void;
	onExit?(): void;
}

export interface IFeatureCard {
	id: string;
	title: string;
	description: string;
	shortcut: string;
	icon?: string;
	animationDelay?: number;
}
