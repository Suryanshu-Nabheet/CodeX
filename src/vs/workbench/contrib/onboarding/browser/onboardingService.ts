
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IOnboardingService, IOnboardingState } from '../common/onboardingTypes.js';
import { OnboardingState } from './onboardingState.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { OnboardingView } from './onboardingView.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';

export class OnboardingService extends Disposable implements IOnboardingService {

	readonly _serviceBrand: undefined;

	private readonly _state: OnboardingState;
	private _view: OnboardingView | undefined;

	constructor(
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IStorageService storageService: IStorageService,
	) {
		super();
		this._state = this._register(this.instantiationService.createInstance(OnboardingState));

		// Ensure UI is restored if service is disposed during onboarding
		this._register({
			dispose: () => {
				this.restoreTitleBar();
			}
		});
	}

	get state(): IOnboardingState {
		return this._state.state;
	}

	show(): void {
		if (!this._view) {
			this._view = this._register(this.instantiationService.createInstance(OnboardingView));
		}

		// Hide title bar and other UI elements for immersive onboarding
		this.hideTitleBar();

		this._view.show();
	}

	hide(): void {
		if (this._view) {
			this._view.hide();
		}

		// Restore title bar and other UI elements
		this.restoreTitleBar();
	}

	private hideTitleBar(): void {
		// Only hide when onboarding is actually visible
		if (this._view && this._view.isVisible()) {
			// Hide the title bar part if it exists
			const titleBar = document.querySelector('.part.titlebar');
			if (titleBar) {
				titleBar.classList.add('hidden-during-onboarding');
			}

			// Hide activity bar for cleaner experience
			const activityBar = document.querySelector('.part.activitybar');
			if (activityBar) {
				activityBar.classList.add('hidden-during-onboarding');
			}

			// Hide status bar for immersive experience
			const statusBar = document.querySelector('.part.statusbar');
			if (statusBar) {
				statusBar.classList.add('hidden-during-onboarding');
			}
		}
	}

	private restoreTitleBar(): void {
		// Restore the title bar part
		const titleBar = document.querySelector('.part.titlebar');
		if (titleBar) {
			titleBar.classList.remove('hidden-during-onboarding');
		}

		// Restore activity bar
		const activityBar = document.querySelector('.part.activitybar');
		if (activityBar) {
			activityBar.classList.remove('hidden-during-onboarding');
		}

		// Restore status bar
		const statusBar = document.querySelector('.part.statusbar');
		if (statusBar) {
			statusBar.classList.remove('hidden-during-onboarding');
		}
	}

	reset(): void {
		this._state.updateState({ completed: false });
		this.show();
	}

	saveState(state: Partial<IOnboardingState>): void {
		this._state.updateState(state);
	}
}
