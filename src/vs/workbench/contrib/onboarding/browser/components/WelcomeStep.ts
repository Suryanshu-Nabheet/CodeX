import { Disposable } from '../../../../../base/common/lifecycle.js';
import { $, append } from '../../../../../base/browser/dom.js';
import { localize } from '../../../../../nls.js';
import { IOnboardingStep } from '../../common/onboardingTypes.js';

interface IFeatureCardDefinition {
	id: string;
	title: string;
	description: string;
	shortcut: string;
	animationDelay: number;
}

export class WelcomeStep extends Disposable implements IOnboardingStep {
	readonly element: HTMLElement;
	readonly title = localize('onboarding.welcomeStep', 'Welcome');
	readonly canProceed = true;

	private get FEATURE_CARDS(): IFeatureCardDefinition[] {
		return [
			{
				id: 'tab',
				title: localize('onboarding.feature.tab.title', 'Tab'),
				description: localize('onboarding.feature.tab.desc', 'Predict your next move with intelligent code completion'),
				shortcut: 'Tab',
				animationDelay: 0.08
			},
			{
				id: 'agent',
				title: localize('onboarding.feature.agent.title', 'Agent'),
				description: localize('onboarding.feature.agent.desc', 'Ask, plan, build anything with AI assistance'),
				shortcut: '⌘I',
				animationDelay: 0.13
			},
			{
				id: 'plan',
				title: localize('onboarding.feature.plan.title', 'Plan'),
				description: localize('onboarding.feature.plan.desc', 'Create and implement plans to tackle complex tasks'),
				shortcut: 'Shift + Tab',
				animationDelay: 0.18
			},
			{
				id: 'multi-agent',
				title: localize('onboarding.feature.ma.title', 'Multi-Agent Layout'),
				description: localize('onboarding.feature.ma.desc', 'A new interface purpose-built for working with agents'),
				shortcut: '⌘E',
				animationDelay: 0.23
			}
		];
	}

	constructor() {
		super();
		this.element = $('.onboarding-step.welcome-features-step');
		// Add both classes for compatibility
		this.element.classList.add('feature-cards-step');
		this.render();
	}

	private render(): void {
		const container = append(this.element, $('.onboarding-v2-container.fade-in'));

		const header = append(container, $('.onboarding-v2-welcome-header'));
		header.style.alignItems = 'center';
		header.style.textAlign = 'center';
		const headerContent = append(header, $('.onboarding-v2-welcome-header-content'));
		const titleContainer = append(headerContent, $('.onboarding-v2-welcome-title'));

		// Use branding from WelcomeStep
		const mainTitle = append(titleContainer, $('span', undefined, localize('onboarding.welcomeTitle', 'Welcome to CodeX')));
		mainTitle.style.animation = 'fadeInUp 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) both';

		append(titleContainer, $('br'));

		const subTitle = append(titleContainer, $('span.onboarding-v2-welcome-subtitle', undefined, localize('onboarding.welcomeSub', 'The AI Code Editor')));
		subTitle.style.animation = 'fadeInUp 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) 0.1s both';

		const grid = append(container, $('.onboarding-v2-quickstart-cards-container'));

		this.FEATURE_CARDS.forEach((card, index) => {
			const cardElement = this.createFeatureCard(card, index);
			append(grid, cardElement);
		});
	}

	private createFeatureCard(card: IFeatureCardDefinition, index: number): HTMLElement {
		const cardElement = $('.onboarding-v2-quickstart-card');
		cardElement.setAttribute('data-feature', card.id);
		cardElement.setAttribute('tabindex', '0');
		cardElement.setAttribute('role', 'button');
		cardElement.setAttribute('aria-label', `${card.title}: ${card.description}`);
		cardElement.style.animation = `fadeInUp 0.8s cubic-bezier(0.2, 0.8, 0.2, 1) ${0.2 + card.animationDelay}s both`;

		const content = append(cardElement, $('.onboarding-v2-quickstart-card-content'));
		const header = append(content, $('.onboarding-v2-quickstart-card-header'));
		append(header, $('span.onboarding-v2-quickstart-card-title', undefined, card.title));
		append(header, $('.onboarding-v2-quickstart-card-hotkey', undefined, card.shortcut));
		append(content, $('.onboarding-v2-quickstart-card-desc', undefined, card.description));

		const imageArea = append(cardElement, $('.onboarding-v2-quickstart-card-image'));

		switch (card.id) {
			case 'tab': this.createTabPreview(imageArea); break;
			case 'agent': this.createAgentPreview(imageArea); break;
			case 'plan': this.createPlanPreview(imageArea); break;
			case 'multi-agent': this.createMultiAgentPreview(imageArea); break;
		}

		append(cardElement, $('.onboarding-v2-fade-gradient-overlay.quickstart-card-gradient'));

		this.setupCardInteractions(cardElement, card.id);
		return cardElement;
	}

	private setupCardInteractions(cardElement: HTMLElement, featureId: string): void {
		const handleClick = (e: Event) => { e.preventDefault(); this.onCardClick(featureId); };
		const handleKeydown = (e: KeyboardEvent) => {
			if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.onCardClick(featureId); }
		};
		cardElement.addEventListener('click', handleClick);
		cardElement.addEventListener('keydown', handleKeydown);
		this._register({
			dispose: () => {
				cardElement.removeEventListener('click', handleClick);
				cardElement.removeEventListener('keydown', handleKeydown);
			}
		});
	}

	private onCardClick(featureId: string): void {
		// Navigation or other logic here
	}

	private createTabPreview(container: HTMLElement): void {
		const codeContainer = append(container, $('.onboarding-v2-code-container'));
		const pre = append(codeContainer, $('pre.onboarding-v2-code-pre.onboarding-v2-code-visible'));
		pre.setAttribute('aria-hidden', 'true');

		type CodeToken = { text: string, classes: string[] };
		type CodeLine = { tokens: CodeToken[], highlighted?: boolean, dimmed?: boolean };

		const lines: CodeLine[] = [
			{
				tokens: [
					{ text: 'export', classes: ['mtk4'] },
					{ text: ' ', classes: ['mtk1'] },
					{ text: 'function', classes: ['mtk4'] },
					{ text: ' ', classes: ['mtk1'] },
					{ text: 'generateCustomPalette', classes: ['mtk9'] },
					{ text: '(', classes: ['mtk1'] }
				]
			},
			{
				highlighted: true,
				dimmed: true,
				tokens: [
					{ text: '  ', classes: ['mtk1'] },
					{ text: 'baseHex', classes: ['mtk5', 'mtki'] },
					{ text: ':', classes: ['mtk5'] },
					{ text: ' ', classes: ['mtk1'] },
					{ text: 'string', classes: ['mtk4'] },
					{ text: ',', classes: ['mtk1'] }
				]
			},
			{
				dimmed: true,
				tokens: [
					{ text: '  ', classes: ['mtk1'] },
					{ text: 'lightnessRange', classes: ['mtk5', 'mtki'] },
					{ text: ':', classes: ['mtk5'] },
					{ text: ' { ', classes: ['mtk1'] },
					{ text: 'min:', classes: ['mtk5'] },
					{ text: ' ', classes: ['mtk1'] },
					{ text: 'number', classes: ['mtk4'] },
					{ text: '; ', classes: ['mtk1'] },
					{ text: 'max:', classes: ['mtk5'] },
					{ text: ' ', classes: ['mtk1'] },
					{ text: 'number', classes: ['mtk4'] },
					{ text: ' },', classes: ['mtk1'] }
				]
			},
			{
				dimmed: true,
				tokens: [
					{ text: '  ', classes: ['mtk1'] },
					{ text: 'steps', classes: ['mtk5', 'mtki'] },
					{ text: ':', classes: ['mtk5'] },
					{ text: ' ', classes: ['mtk1'] },
					{ text: 'number', classes: ['mtk4'] },
					{ text: ' ', classes: ['mtk1'] },
					{ text: '=', classes: ['mtk5'] },
					{ text: ' ', classes: ['mtk1'] },
					{ text: '6', classes: ['mtk13'] }
				]
			},
			{
				dimmed: true,
				tokens: [
					{ text: ')', classes: ['mtk1'] },
					{ text: ':', classes: ['mtk5'] },
					{ text: ' ', classes: ['mtk1'] },
					{ text: 'string', classes: ['mtk4'] },
					{ text: '[] {', classes: ['mtk1'] }
				]
			}
		];

		lines.forEach(line => {
			const lineEl = append(pre, $(`.onboarding-v2-code-line${line.highlighted ? '.highlighted' : ''}`));
			if (line.highlighted) {
				append(lineEl, $('.onboarding-v2-code-caret'));
			}
			const textSpan = append(lineEl, $(`span.onboarding-v2-code-text${line.dimmed ? '.dimmed' : ''}`));
			line.tokens.forEach(token => {
				const tokenSpan = append(textSpan, $('span'));
				tokenSpan.className = token.classes.join(' ');
				tokenSpan.textContent = token.text;
			});
		});
	}

	private createAgentPreview(container: HTMLElement): void {
		const composer = append(container, $('.onboarding-v2-composer'));
		append(composer, $('.onboarding-v2-composer-user-message', undefined, localize('onboarding.agent.prompt', 'Add a button that converts HEX values')));

		const footer = append(composer, $('.onboarding-v2-composer-footer'));
		const mode = append(footer, $('.onboarding-v2-composer-mode'));
		const icon = append(mode, $('span.codicon.codicon-infinity'));
		icon.style.fontSize = '16px';
		icon.style.color = 'var(--cursor-icon-secondary, #61afef)';
		append(mode, document.createTextNode(localize('onboarding.agent.tab1', 'Agent')));

		append(footer, $('.onboarding-v2-composer-model', undefined, 'CodeX'));
	}

	private createPlanPreview(container: HTMLElement): void {
		const planContainer = append(container, $('.onboarding-v2-quick-start-plan-mode-container'));
		const content = append(planContainer, $('.onboarding-v2-quick-start-plan-mode-content'));
		append(content, $('.onboarding-v2-quick-start-plan-mode-title', undefined, localize('onboarding.plan.title', 'Enable GitHub OAuth')));

		const todos = append(content, $('.onboarding-v2-quick-start-plan-mode-todos'));
		append(todos, $('.onboarding-v2-quick-start-plan-mode-todos-header', undefined, localize('onboarding.plan.todos', 'To-dos')));

		const list = append(todos, $('.onboarding-v2-quick-start-plan-mode-todos-list'));

		const items = [
			localize('onboarding.plan.item1', 'Install express-session, @types/express-session'),
			localize('onboarding.plan.item2', 'Create src/oauth.ts with Git OAuth configuration and token exchange logic')
		];

		items.forEach(text => {
			const item = append(list, $('.onboarding-v2-quick-start-plan-mode-todos-list-item'));
			const iconWrap = append(item, $('.onboarding-v2-quick-start-plan-mode-todos-list-item-icon'));
			append(iconWrap, $('.onboarding-v2-quick-start-plan-mode-todos-list-item-icon-circle'));
			append(item, $('.onboarding-v2-quick-start-plan-mode-todos-list-item-text', undefined, text));
		});
	}

	private createMultiAgentPreview(container: HTMLElement): void {
		const maLayout = append(container, $('.onboarding-v2-quick-start-multi-agent-layout'));

		const sidebar = append(maLayout, $('.onboarding-v2-quick-start-multi-agent-sidebar'));
		for (let i = 0; i < 4; i++) {
			append(sidebar, $('.onboarding-v2-quick-start-multi-agent-sidebar-cell'));
		}

		const chat = append(maLayout, $('.onboarding-v2-quick-start-multi-agent-chat.appearance-preview-chat'));
		const messages = append(chat, $('.appearance-preview-chat-messages'));

		// Message 1
		const m1 = append(messages, $('.appearance-preview-chat-message'));
		m1.style.alignItems = 'flex-start';
		m1.style.paddingRight = '32px';
		m1.style.display = 'flex';
		m1.style.flexDirection = 'column';
		const b1 = append(m1, $('.appearance-preview-chat-message-bubble'));
		b1.style.background = 'var(--cursor-bg-secondary, rgba(255,255,255,0.05))';
		const t1 = append(m1, $('.appearance-preview-chat-message-tail'));
		t1.style.background = 'var(--cursor-bg-secondary, rgba(255,255,255,0.05))';

		// Message 2
		const m2 = append(messages, $('.appearance-preview-chat-message'));
		m2.style.alignItems = 'flex-end';
		m2.style.display = 'flex';
		m2.style.flexDirection = 'column';
		m2.style.paddingRight = '2px';
		m2.style.paddingLeft = '32px';
		const b2 = append(m2, $('.appearance-preview-chat-message-bubble'));
		b2.style.background = 'var(--cursor-bg-secondary, rgba(255,255,255,0.05))';
		const t2 = append(m2, $('.appearance-preview-chat-message-tail'));
		t2.style.background = 'var(--cursor-bg-secondary, rgba(255,255,255,0.05))';

		const composer = append(chat, $('.appearance-preview-chat-composer'));
		composer.style.background = 'var(--cursor-bg-secondary, rgba(255,255,255,0.05))';
		append(composer, $('.appearance-preview-chat-composer-icon'));
	}

	onEnter(): void {
		// Step became active - CSS handles all theme changes automatically
	}

	onExit(): void {
		// Leaving step - no cleanup needed
	}
}
