import { Disposable } from '../../../../base/common/lifecycle.js';
import { $, append, addDisposableListener } from '../../../../base/browser/dom.js';
import { localize } from '../../../../nls.js';
import { IOnboardingService } from '../common/onboardingTypes.js';
import { WelcomeStep } from './components/WelcomeStep.js';

import { IWorkbenchLayoutService } from '../../../services/layout/browser/layoutService.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { CustomThemeStep } from './components/CustomThemeStep.js';
import { ImportStep } from './components/ImportStep.js';

import './onboardingStyles.css';

export class OnboardingView extends Disposable {

	private _overlay: HTMLElement | undefined;
	private _container: HTMLElement | undefined;
	private _content: HTMLElement | undefined;
	private _navigation: HTMLElement | undefined;
	private _prevBtn: HTMLElement | undefined;
	private _nextBtn: HTMLElement | undefined;
	private _stepIndicator: HTMLElement | undefined;
	private _finalizingOverlay: HTMLElement | undefined;

	private readonly _steps: any[] = [];
	private readonly _stepInstances: any[] = [];
	private _currentStep = 0;

	constructor(
		@IOnboardingService private readonly onboardingService: IOnboardingService,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
		@IInstantiationService private readonly instantiationService: IInstantiationService
	) {
		super();
		this._steps = [WelcomeStep, ImportStep, CustomThemeStep];
	}

	show(): void {
		if (!this._overlay) {
			this.render();
		}
		this._finalizingOverlay?.classList.remove('visible');
		this._overlay!.classList.add('visible');
		const workbenchContainer = this.layoutService.getContainer(window);
		if (workbenchContainer) {
			workbenchContainer.classList.add('codex-onboarding-active');
		}
		this.goStep(0);
	}

	hide(): void {
		if (this._overlay) {
			this._overlay.classList.remove('visible');
		}
		const workbenchContainer = this.layoutService.getContainer(window);
		if (workbenchContainer) {
			workbenchContainer.classList.remove('codex-onboarding-active');
		}
	}

	isVisible(): boolean {
		return this._overlay?.classList.contains('visible') || false;
	}

	private render(): void {
		this._overlay = $('.onboarding-overlay');
		this._container = append(this._overlay, $('.onboarding-container'));

		this._content = append(this._container, $('.onboarding-content'));

		// Finalizing Overlay
		this._finalizingOverlay = append(this._container, $('.onboarding-finalizing-overlay'));
		append(this._finalizingOverlay, $('.finalizing-loader'));
		append(this._finalizingOverlay, $('.finalizing-text', undefined, localize('onboarding.setupTitle', 'Setting up CodeX')));
		append(this._finalizingOverlay, $('.finalizing-subtext', undefined, localize('onboarding.setupSubtext', 'Bringing your environment to life...')));

		// Navigation
		this._navigation = append(this._container, $('.onboarding-navigation'));

		// Navigation button row
		const navButtons = append(this._navigation, $('.onboarding-nav-buttons'));

		// Previous button
		this._prevBtn = append(navButtons, $('.onboarding-button', undefined, localize('onboarding.previous', 'Previous')));
		this._prevBtn.setAttribute('aria-label', localize('onboarding.prevStepLabel', 'Previous step'));
		this._prevBtn.setAttribute('role', 'button');
		this.updatePrevButton();

		// Next button
		this._nextBtn = append(navButtons, $('.onboarding-button.primary', undefined, localize('onboarding.next', 'Next')));
		this._nextBtn.setAttribute('aria-label', localize('onboarding.nextStepLabel', 'Next step'));
		this._nextBtn.setAttribute('role', 'button');

		// Step indicator at bottom
		this._stepIndicator = append(this._navigation, $('.onboarding-step-indicator'));
		this.updateStepIndicator();

		// Button event listeners
		this._register(addDisposableListener(this._prevBtn, 'click', () => {
			this.previousStep();
		}));

		this._register(addDisposableListener(this._nextBtn, 'click', () => {
			this.nextStep();
		}));

		// Keyboard navigation
		this._register(addDisposableListener(this._overlay, 'keydown', (e) => {
			this.handleKeydown(e);
		}));

		// Append to workbench container for theme syncing
		const workbenchContainer = this.layoutService.getContainer(window);
		if (this._overlay && workbenchContainer) {
			workbenchContainer.appendChild(this._overlay);
		}

		// Initialize steps
		this._steps.forEach((StepClass) => {
			const instance = this.instantiationService.createInstance(StepClass);
			this._stepInstances.push(this._register(instance));
			this._content!.appendChild(instance.element);
		});
	}

	private goStep(index: number): void {
		if (index < 0 || index >= this._stepInstances.length) {
			return;
		}

		// Call onExit for current step
		if (this._stepInstances[this._currentStep]?.onExit) {
			this._stepInstances[this._currentStep].onExit();
		}

		// Update current step
		this._currentStep = index;

		// Update step visibility
		this._stepInstances.forEach((instance, i) => {
			instance.element.classList.toggle('active', i === index);
		});

		// Call onEnter for new step
		if (this._stepInstances[this._currentStep]?.onEnter) {
			this._stepInstances[this._currentStep].onEnter();
		}

		// Update UI
		this.updateStepIndicator();
		this.updatePrevButton();
		this.updateNextButton();

		// Save state
		this.onboardingService.saveState({
			currentStep: index,
			totalSteps: this._stepInstances.length
		});
	}

	private nextStep(): void {
		if (this._currentStep < this._stepInstances.length - 1) {
			this.goStep(this._currentStep + 1);
		} else {
			// Last step - complete onboarding
			this.completeOnboarding();
		}
	}

	private previousStep(): void {
		if (this._currentStep > 0) {
			this.goStep(this._currentStep - 1);
		}
	}

	private async completeOnboarding(): Promise<void> {
		const importStep = this._stepInstances.find(s => s instanceof ImportStep) as ImportStep;

		if (importStep) {
			this._finalizingOverlay?.classList.add('visible');
			try {
				await importStep.performMigration();
				// Small delay for professional feel after "Success"
				await new Promise(resolve => setTimeout(resolve, 800));
			} catch (e) {
				// Error handled in ImportStep notification, we can still proceed
				this._finalizingOverlay?.classList.remove('visible');
			}
		}

		this.onboardingService.saveState({ completed: true });
		this.hide();

		// Ensure overlay is reset for next time (if opened from menu)
		setTimeout(() => {
			this._finalizingOverlay?.classList.remove('visible');
		}, 400);
	}

	private updateStepIndicator(): void {
		if (!this._stepIndicator) return;

		// Clear existing dots safely
		while (this._stepIndicator.firstChild) {
			this._stepIndicator.removeChild(this._stepIndicator.firstChild);
		}

		this._stepInstances.forEach((_, index) => {
			const dot = append(this._stepIndicator!, $('.step-dot'));
			dot.classList.toggle('active', index === this._currentStep);
		});
	}

	private updatePrevButton(): void {
		if (!this._prevBtn) return;

		const isDisabled = this._currentStep === 0;
		(this._prevBtn as HTMLButtonElement).disabled = isDisabled;
		this._prevBtn.style.opacity = isDisabled ? '0.5' : '1';
		this._prevBtn.style.cursor = isDisabled ? 'not-allowed' : 'pointer';
	}

	private updateNextButton(): void {
		if (!this._nextBtn) return;

		const isLastStep = this._currentStep === this._stepInstances.length - 1;
		const currentStepInstance = this._stepInstances[this._currentStep];
		const canProceed = currentStepInstance?.canProceed !== false;

		(this._nextBtn as HTMLButtonElement).disabled = !canProceed;
		this._nextBtn.style.opacity = canProceed ? '1' : '0.5';
		this._nextBtn.style.cursor = canProceed ? 'pointer' : 'not-allowed';

		// Update button text for last step
		const buttonText = isLastStep ? localize('onboarding.getStarted', 'Get Started') : localize('onboarding.next', 'Next');
		if (this._nextBtn.textContent !== buttonText) {
			this._nextBtn.textContent = buttonText;
		}
		this._nextBtn.setAttribute('aria-label', isLastStep ? localize('onboarding.startLabel', 'Complete onboarding and get started') : localize('onboarding.nextStepLabel', 'Next step'));
	}

	private handleKeydown(e: KeyboardEvent): void {
		switch (e.key) {
			case 'ArrowLeft':
				e.preventDefault();
				this.previousStep();
				break;
			case 'ArrowRight':
				e.preventDefault();
				this.nextStep();
				break;
			case 'Escape':
				e.preventDefault();
				this.hide();
				break;
			case 'Enter':
				if (e.target === this._nextBtn || e.target === this._prevBtn) {
					// Let default click handler handle it
					return;
				}
				e.preventDefault();
				this.nextStep();
				break;
		}
	}
}
