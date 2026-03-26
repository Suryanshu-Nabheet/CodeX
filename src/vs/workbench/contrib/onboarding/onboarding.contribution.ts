
import { Registry } from '../../../platform/registry/common/platform.js';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions, IWorkbenchContribution } from '../../common/contributions.js';
import { LifecyclePhase } from '../../services/lifecycle/common/lifecycle.js';
import { IOnboardingService } from './common/onboardingTypes.js';
import { OnboardingService } from './browser/onboardingService.js';
import { InstantiationType, registerSingleton } from '../../../platform/instantiation/common/extensions.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { registerAction2, Action2 } from '../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../platform/instantiation/common/instantiation.js';
import { localize2 } from '../../../nls.js';

class OnboardingContribution extends Disposable implements IWorkbenchContribution {
	constructor(
		@IOnboardingService private readonly onboardingService: IOnboardingService
	) {
		super();
		this.maybeShowOnboarding();
	}

	private maybeShowOnboarding(): void {
		if (!this.onboardingService.state.completed) {
			this.onboardingService.show();
		}
	}
}

// Register Service
registerSingleton(IOnboardingService, OnboardingService, InstantiationType.Eager);

// Register Contribution
Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(
	OnboardingContribution,
	LifecyclePhase.Restored
);

// Register Reset Command
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.resetWelcome',
			title: localize2('onboarding.reset', 'Welcome: Reset'),
			f1: true,
		});
	}

	run(accessor: ServicesAccessor): void {
		const onboardingService = accessor.get(IOnboardingService);
		onboardingService.reset();
	}
});

// Register Show Command
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'workbench.action.showWelcome',
			title: localize2('onboarding.show', 'Welcome: Show Onboarding Screen'),
			f1: true,
		});
	}

	run(accessor: ServicesAccessor): void {
		const onboardingService = accessor.get(IOnboardingService);
		onboardingService.show();
	}
});
