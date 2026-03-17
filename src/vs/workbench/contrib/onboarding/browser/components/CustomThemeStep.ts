import { Disposable } from '../../../../../base/common/lifecycle.js';
import { $, append } from '../../../../../base/browser/dom.js';
import { localize } from '../../../../../nls.js';
import { IOnboardingStep } from '../../common/onboardingTypes.js';
import { IWorkbenchThemeService } from '../../../../services/themes/common/workbenchThemeService.js';

interface IThemeOption {
	id: string; // The inner theme ID used by theme service
	label: string; // Display label
	description: string;
	previewColor: string; // Used for UI placeholder
	accentColor: string;
	titleBar: string;
	activityBar: string;
	sideBar: string;
	sideBarBorder: string;
	statusBar: string;
}

export class CustomThemeStep extends Disposable implements IOnboardingStep {
	readonly element: HTMLElement;
	readonly title = localize('onboarding.customTheme', 'Custom Theme');
	readonly canProceed = true;

	private get THEMES(): IThemeOption[] {
		return [
			{ id: 'CodeX Dark', label: localize('onboarding.theme.dark', 'Dark'), description: localize('onboarding.theme.dark.desc', 'The default dark experience'), previewColor: '#121212', accentColor: '#0078D4', titleBar: '#0D0D0D', activityBar: '#0D0D0D', sideBar: '#0D0D0D', sideBarBorder: '#1A1A1A', statusBar: '#0D0D0D' },
			{ id: 'CodeX Midnight', label: localize('onboarding.theme.midnight', 'Midnight'), description: localize('onboarding.theme.midnight.desc', 'Deep blue tones for late nights'), previewColor: '#1e2127', accentColor: '#88c0d0', titleBar: '#191c22', activityBar: '#191c22', sideBar: '#191c22', sideBarBorder: '#272c36', statusBar: '#191c22' },
			{ id: 'CodeX Obsidian', label: localize('onboarding.theme.obsidian', 'Obsidian'), description: localize('onboarding.theme.obsidian.desc', 'Pure black for OLED displays'), previewColor: '#1a1a1a', accentColor: '#88C0D0', titleBar: '#141414', activityBar: '#141414', sideBar: '#141414', sideBarBorder: '#2A2A2A', statusBar: '#141414' },
			{ id: 'CodeX Light', label: localize('onboarding.theme.light', 'Light'), description: localize('onboarding.theme.light.desc', 'Clean and bright'), previewColor: '#F7F7F7', accentColor: '#0078D4', titleBar: '#F0F0F0', activityBar: '#F0F0F0', sideBar: '#F0F0F0', sideBarBorder: '#DCDCDC', statusBar: '#F0F0F0' },
			{ id: 'CodeX High Contrast', label: localize('onboarding.theme.hc', 'High Contrast'), description: localize('onboarding.theme.hc.desc', 'Maximum legibility'), previewColor: '#0A0A0A', accentColor: '#88C0D0', titleBar: '#0A0A0A', activityBar: '#0A0A0A', sideBar: '#0A0A0A', sideBarBorder: '#ffffff1a', statusBar: '#0A0A0A' }
		];
	}

	constructor(
		@IWorkbenchThemeService private readonly themeService: IWorkbenchThemeService
	) {
		super();
		this.element = $('.onboarding-step.custom-theme-step');
		this.render();
	}

	private render() {
		const container = append(this.element, $('.theme-step-content'));

		const header = append(container, $('.theme-heading'));
		append(header, $('h2', undefined, localize('onboarding.theme.heading', 'Choose your style')));
		append(header, $('p', undefined, localize('onboarding.theme.subheading', 'Select a theme that works best for you. You can always change it later.')));

		const grid = append(container, $('.theme-cards-grid'));
		grid.setAttribute('role', 'radiogroup');
		grid.setAttribute('aria-label', localize('onboarding.theme.ariaLabel', 'Theme Selection'));

		this.THEMES.forEach((theme) => {
			const card = append(grid, $('.theme-card'));
			card.setAttribute('tabindex', '0');
			card.setAttribute('role', 'radio');
			card.setAttribute('aria-checked', 'false');
			card.setAttribute('aria-label', theme.label);

			const previewContainer = append(card, $('.theme-card-preview-area'));

			// Realistic minified 100% paired IDE UI
			const fakeIde = append(previewContainer, $('.theme-fake-ide'));
			fakeIde.style.borderColor = theme.sideBarBorder;

			// Title Bar
			const fakeTitleBar = append(fakeIde, $('.theme-fake-titlebar'));
			fakeTitleBar.style.backgroundColor = theme.titleBar;
			const dots = append(fakeTitleBar, $('.theme-fake-dots'));
			append(dots, $('.theme-dot.theme-dot-red'));
			append(dots, $('.theme-dot.theme-dot-yellow'));
			append(dots, $('.theme-dot.theme-dot-green'));

			// Main Area Layer
			const fakeMain = append(fakeIde, $('.theme-fake-main'));

			// Activity Bar
			const fakeActivityBar = append(fakeMain, $('.theme-fake-activitybar'));
			fakeActivityBar.style.backgroundColor = theme.activityBar;
			fakeActivityBar.style.borderRight = `1px solid ${theme.sideBarBorder}`;

			const icon1 = append(fakeActivityBar, $('.theme-fake-icon'));
			icon1.style.backgroundColor = theme.accentColor;
			const icon2 = append(fakeActivityBar, $('.theme-fake-icon'));
			icon2.style.backgroundColor = `color-mix(in srgb, ${theme.accentColor} 30%, transparent)`;

			// Side Bar
			const fakeSidebar = append(fakeMain, $('.theme-fake-sidebar'));
			fakeSidebar.style.backgroundColor = theme.sideBar;
			fakeSidebar.style.borderRight = `1px solid ${theme.sideBarBorder}`;

			for (let j = 0; j < 4; j++) {
				const item = append(fakeSidebar, $('.theme-fake-sidebar-item'));
				item.style.backgroundColor = `color-mix(in srgb, ${theme.accentColor} 10%, transparent)`;
				item.style.width = j === 0 ? '70%' : (j === 1 ? '50%' : '85%');
			}

			// Editor
			const fakeEditor = append(fakeMain, $('.theme-fake-editor'));
			fakeEditor.style.backgroundColor = theme.previewColor;

			const fakeTabs = append(fakeEditor, $('.theme-fake-tabs'));
			fakeTabs.style.backgroundColor = theme.titleBar;

			const fakeTab1 = append(fakeTabs, $('.theme-fake-tab.active'));
			fakeTab1.style.backgroundColor = theme.previewColor;
			fakeTab1.style.borderTop = `1px solid ${theme.accentColor}`;

			const fakeTab2 = append(fakeTabs, $('.theme-fake-tab'));
			fakeTab2.style.backgroundColor = 'transparent';

			const fakeEditorContent = append(fakeEditor, $('.theme-fake-editor-content'));
			for (let i = 0; i < 4; i++) {
				const lineWrap = append(fakeEditorContent, $('.theme-fake-line-wrap'));
				const gutter = append(lineWrap, $('.theme-fake-gutter'));
				gutter.textContent = String(i + 1);

				const line = append(lineWrap, $('.theme-fake-line'));
				line.style.width = `${Math.random() * 40 + 20}%`;
				line.style.backgroundColor = i === 1 ? theme.accentColor : `color-mix(in srgb, ${theme.accentColor} 40%, transparent)`;
			}

			// Status Bar
			const fakeStatusBar = append(fakeIde, $('.theme-fake-statusbar'));
			fakeStatusBar.style.backgroundColor = theme.statusBar;

			const info = append(card, $('.theme-card-info'));
			append(info, $('.theme-card-title', undefined, theme.label));
			append(info, $('.theme-card-desc', undefined, theme.description));

			const activeCheck = append(card, $('.theme-active-check'));
			const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
			svg.setAttribute('width', '16');
			svg.setAttribute('height', '16');
			svg.setAttribute('viewBox', '0 0 16 16');
			svg.setAttribute('fill', 'currentColor');
			const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
			path.setAttribute('d', 'M12.207 4.793a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L6.5 9.086l4.293-4.293a1 1 0 0 1 1.414 0z');
			svg.appendChild(path);
			activeCheck.appendChild(svg);

			// Select active
			const selectTheme = async () => {
				const allCards = grid.querySelectorAll('.theme-card');
				allCards.forEach(c => {
					c.classList.remove('active');
					c.setAttribute('aria-checked', 'false');
				});
				card.classList.add('active');
				card.setAttribute('aria-checked', 'true');

				const themes = await this.themeService.getColorThemes();
				const target = themes.find(t => t.id === theme.id || t.label === theme.id || t.settingsId === theme.id);

				if (target) {
					await this.themeService.setColorTheme(target.id, 'auto');
				} else {
					await this.themeService.setColorTheme(theme.id, 'auto');
				}
			};

			const updateActiveState = () => {
				const currentTheme = this.themeService.getColorTheme();
				// Compare ID or Label, label comes from theme package.json or settings
				if (currentTheme.id === theme.id || currentTheme.label === theme.id || currentTheme.label === theme.label || currentTheme.settingsId === theme.id) {
					card.classList.add('active');
					card.setAttribute('aria-checked', 'true');
				} else {
					card.classList.remove('active');
					card.setAttribute('aria-checked', 'false');
				}
			};

			updateActiveState();

			this._register(this.themeService.onDidColorThemeChange(() => {
				updateActiveState();
			}));

			card.addEventListener('click', selectTheme);
			card.addEventListener('keydown', (e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					selectTheme();
				}
			});
		});
	}

	onEnter(): void {
		// active
	}

	onExit(): void {
	}
}
