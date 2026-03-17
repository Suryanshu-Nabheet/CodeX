import { Disposable } from '../../../../../base/common/lifecycle.js';
import { $, append, clearNode } from '../../../../../base/browser/dom.js';
import { IOnboardingStep } from '../../common/onboardingTypes.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { INativeEnvironmentService } from '../../../../../platform/environment/common/environment.js';
import { INotificationService, Severity } from '../../../../../platform/notification/common/notification.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { joinPath } from '../../../../../base/common/resources.js';
import { URI } from '../../../../../base/common/uri.js';
import { isMacintosh, isLinux, isWindows } from '../../../../../base/common/platform.js';
import { localize } from '../../../../../nls.js';

interface ISetupOption {
	id: string;
	title: string;
	description: string;
}

export class ImportStep extends Disposable implements IOnboardingStep {
	readonly element: HTMLElement;
	readonly title = localize('onboarding.setupFlow', 'Setup Flow');
	readonly canProceed = true;

	private _selectedId = 'fresh';

	private get OPTIONS(): ISetupOption[] {
		return [
			{ id: 'fresh', title: localize('onboarding.setup.fresh.title', 'Fresh Start'), description: localize('onboarding.setup.fresh.desc', 'Clean slate, default settings') },
			{ id: 'vscode', title: localize('onboarding.setup.vscode.title', 'VS Code'), description: localize('onboarding.setup.vscode.desc', 'Settings, extensions, keybindings') },
			{ id: 'cursor', title: localize('onboarding.setup.cursor.title', 'Cursor'), description: localize('onboarding.setup.cursor.desc', 'AI workflow & preferences') },
			{ id: 'windsurf', title: localize('onboarding.setup.windsurf.title', 'Windsurf'), description: localize('onboarding.setup.windsurf.desc', 'Projects & configuration') }
		];
	}

	constructor(
		@IFileService private readonly fileService: IFileService,
		@INativeEnvironmentService private readonly environmentService: INativeEnvironmentService,
		@INotificationService private readonly notificationService: INotificationService,
		@ILogService private readonly logService: ILogService
	) {
		super();
		this.element = $('.onboarding-step.import-step');
		this.render();
	}

	private render() {
		clearNode(this.element);
		const container = append(this.element, $('.import-step-content'));

		const header = append(container, $('.import-heading'));
		append(header, $('h2', undefined, localize('onboarding.setup.heading', 'Configure your setup')));
		append(header, $('p', undefined, localize('onboarding.setup.subheading', 'Import your environment or start fresh.')));

		const grid = append(container, $('.import-options-list'));
		grid.setAttribute('role', 'radiogroup');
		grid.setAttribute('aria-label', localize('onboarding.setup.ariaGroup', 'Setup Options'));

		this.OPTIONS.forEach((option) => {
			const card = append(grid, $('.import-option-box'));
			card.setAttribute('tabindex', '0');
			card.setAttribute('role', 'radio');

			const leftContent = append(card, $('.import-box-left-content'));
			const iconContainer = append(leftContent, $('.import-box-icon'));

			if (option.id === 'windsurf') {
				const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
				svg.setAttribute('fill', 'currentColor');
				svg.setAttribute('fill-rule', 'evenodd');
				svg.setAttribute('height', '28');
				svg.setAttribute('width', '28');
				svg.setAttribute('viewBox', '0 0 24 24');
				svg.style.flex = 'none';
				svg.style.lineHeight = '1';

				const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
				path.setAttribute('clip-rule', 'evenodd');
				path.setAttribute('d', 'M23.78 5.004h-.228a2.187 2.187 0 00-2.18 2.196v4.912c0 .98-.804 1.775-1.76 1.775a1.818 1.818 0 01-1.472-.773L13.168 5.95a2.197 2.197 0 00-1.81-.95c-1.134 0-2.154.972-2.154 2.173v4.94c0 .98-.797 1.775-1.76 1.775-.57 0-1.136-.289-1.472-.773L.408 5.098C.282 4.918 0 5.007 0 5.228v4.284c0 .216.066.426.188.604l5.475 7.889c.324.466.8.812 1.351.938 1.377.316 2.645-.754 2.645-2.117V11.89c0-.98.787-1.775 1.76-1.775h.002c.586 0 1.135.288 1.472.773l4.972 7.163a2.15 2.15 0 001.81.95c1.158 0 2.151-.973 2.151-2.173v-4.939c0-.98.787-1.775 1.76-1.775h.194c.122 0 .22-.1.22-.222V5.225a.221.221 0 00-.22-.222z');
				svg.appendChild(path);
				iconContainer.appendChild(svg);
			} else if (option.id === 'cursor') {
				const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
				svg.setAttribute('fill', 'currentColor');
				svg.setAttribute('fill-rule', 'evenodd');
				svg.setAttribute('height', '28');
				svg.setAttribute('width', '28');
				svg.setAttribute('viewBox', '0 0 24 24');
				svg.style.flex = 'none';
				svg.style.lineHeight = '1';

				const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
				path.setAttribute('d', 'M22.106 5.68L12.5.135a.998.998 0 00-.998 0L1.893 5.68a.84.84 0 00-.419.726v11.186c0 .3.16.577.42.727l9.607 5.547a.999.999 0 00.998 0l9.608-5.547a.84.84 0 00.42-.727V6.407a.84.84 0 00-.42-.726zm-.603 1.176L12.228 22.92c-.063.108-.228.064-.228-.061V12.34a.59.59 0 00-.295-.51l-9.11-5.26c-.107-.062-.063-.228.062-.228h18.55c.264 0 .428.286.296.514z');
				svg.appendChild(path);
				iconContainer.appendChild(svg);
			} else if (option.id === 'vscode') {
				const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
				svg.setAttribute('fill', 'currentColor');
				svg.setAttribute('height', '28');
				svg.setAttribute('width', '28');
				svg.setAttribute('viewBox', '0 0 16 16');
				svg.style.flex = 'none';
				svg.style.lineHeight = '1';

				const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
				path1.setAttribute('d', 'M10.8635 13.9195C10.6568 14.0195 10.4234 14.0246 10.2186 13.9444C10.1163 13.9044 10.0211 13.843 9.94003 13.7614L4.81622 9.06268L2.5844 10.7656C2.37664 10.9241 2.08603 10.9111 1.89307 10.7347L1.17725 10.0802C0.941229 9.86437 0.940959 9.49112 1.17667 9.27496L3.11219 7.5L1.17667 5.72504C0.940959 5.50888 0.941229 5.13563 1.17725 4.91982L1.89307 4.2653C2.08603 4.08887 2.37664 4.07588 2.5844 4.2344L4.81622 5.93732L9.94003 1.23855C9.97043 1.20797 10.0028 1.18023 10.0368 1.15538C10.2749 0.981429 10.5923 0.949298 10.8635 1.08048L13.54 2.37507C13.8212 2.5111 14.0001 2.79721 14.0001 3.11109V8H10.752V4.53356L6.86425 7.5L10.752 10.4664V8H14.0001V11.8889C14.0001 12.2028 13.8212 12.4889 13.54 12.625L10.8635 13.9195Z');
				svg.appendChild(path1);
				iconContainer.appendChild(svg);
			} else if (option.id === 'fresh') {
				const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
				svg.setAttribute('fill', 'currentColor');
				svg.setAttribute('height', '28');
				svg.setAttribute('width', '28');
				svg.setAttribute('viewBox', '0 0 16 16');
				svg.style.flex = 'none';
				svg.style.lineHeight = '1';

				const paths = [
					'M12.5 1H3.5C2.121 1 1 2.122 1 3.5V12.5C1 13.879 2.121 15 3.5 15H12.5C13.879 15 15 13.879 15 12.5V3.5C15 2.122 13.879 1 12.5 1ZM2 12.5V3.5C2 2.673 2.673 2 3.5 2H5V14H3.5C2.673 14 2 13.327 2 12.5ZM14 12.5C14 13.327 13.327 14 12.5 14H6V2H12.5C13.327 2 14 2.673 14 3.5V12.5Z',
					'M7.5 4H10.5C10.776 4 11 3.776 11 3.5C11 3.224 10.776 3 10.5 3H7.5C7.224 3 7 3.224 7 3.5C7 3.776 7.224 4 7.5 4Z',
					'M12.5 5H9.5C9.224 5 9 5.224 9 5.5C9 5.776 9.224 6 9.5 6H12.5C12.776 6 13 5.776 13 5.5C13 5.224 12.776 5 12.5 5Z',
					'M10.5 11H7.5C7.224 11 7 11.224 7 11.5C7 11.776 7.224 12 7.5 12H10.5C10.776 12 11 11.776 11 11.5C11 11.224 10.776 11 10.5 11Z',
					'M12.5 7H9.5C9.224 7 9 7.224 9 7.5C9 7.776 9.224 8 9.5 8H12.5C12.776 8 13 7.776 13 7.5C13 7.224 12.776 7 12.5 7Z',
					'M12.5 9H9.5C9.224 9 9 9.224 9 9.5C9 9.776 9.224 10 9.5 10H12.5C12.776 10 13 9.776 13 9.5C13 9.224 12.776 9 12.5 9Z'
				];

				paths.forEach(d => {
					const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
					path.setAttribute('d', d);
					svg.appendChild(path);
				});
				iconContainer.appendChild(svg);
			}

			const info = append(leftContent, $('.import-box-info'));
			append(info, $('.import-box-title', undefined, option.title));
			append(info, $('.import-box-desc', undefined, option.description));

			const checkContainer = append(card, $('.import-box-check'));
			const checkSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
			checkSvg.setAttribute('width', '12');
			checkSvg.setAttribute('height', '12');
			checkSvg.setAttribute('viewBox', '0 0 16 16');
			checkSvg.setAttribute('fill', 'currentColor');
			const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
			path.setAttribute('d', 'M12.207 4.793a1 1 0 0 1 0 1.414l-5 5a1 1 0 0 1-1.414 0l-2-2a1 1 0 0 1 1.414-1.414L6.5 9.086l4.293-4.293a1 1 0 0 1 1.414 0z');
			checkSvg.appendChild(path);
			checkContainer.appendChild(checkSvg);

			const selectOption = () => {
				const allCards = grid.querySelectorAll('.import-option-box');
				allCards.forEach(c => {
					c.classList.remove('active');
					c.setAttribute('aria-checked', 'false');
				});
				card.classList.add('active');
				card.setAttribute('aria-checked', 'true');
				this._selectedId = option.id;
			};

			card.addEventListener('click', selectOption);
			card.addEventListener('keydown', (e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					selectOption();
				}
			});

			if (option.id === this._selectedId) {
				card.classList.add('active');
				card.setAttribute('aria-checked', 'true');
			}
		});
	}

	async performMigration(): Promise<void> {
		if (this._selectedId === 'fresh') {
			return;
		}

		const id = this._selectedId;
		try {
			const sources = this.getSourcePaths(id);
			if (!sources) {
				throw new Error(localize('onboarding.setup.errorPlatform', 'Migration paths not supported on this platform'));
			}

			// 1. Migrate User Data (Settings, Keybindings)
			await this.migrateUserData(sources.userData);

			// 2. Migrate Extensions
			await this.migrateExtensions(sources.extensions);

			this.notificationService.notify({
				severity: Severity.Info,
				message: localize('onboarding.setup.successMsg', 'Successfully imported settings from {0}. Some changes may require a restart.', id.toUpperCase())
			});

		} catch (e: any) {
			this.logService.error(`[Migration] ${id} failed: ${e.message}`);
			this.notificationService.error(localize('onboarding.setup.failedMsg', 'Migration failed: {0}', e.message));
			throw e;
		}
	}

	private getSourcePaths(id: string): { userData: URI; extensions: URI } | undefined {
		const home = this.environmentService.userHome;

		if (isMacintosh) {
			const appSupport = joinPath(home, 'Library', 'Application Support');
			switch (id) {
				case 'vscode':
					return {
						userData: joinPath(appSupport, 'Code', 'User'),
						extensions: joinPath(home, '.vscode', 'extensions')
					};
				case 'cursor':
					return {
						userData: joinPath(appSupport, 'Cursor', 'User'),
						extensions: joinPath(home, '.cursor', 'extensions')
					};
				case 'windsurf':
					return {
						userData: joinPath(appSupport, 'Windsurf', 'User'),
						extensions: joinPath(home, '.windsurf', 'extensions')
					};
			}
		} else if (isLinux) {
			const config = joinPath(home, '.config');
			switch (id) {
				case 'vscode':
					return {
						userData: joinPath(config, 'Code', 'User'),
						extensions: joinPath(home, '.vscode', 'extensions')
					};
				case 'cursor':
					return {
						userData: joinPath(config, 'Cursor', 'User'),
						extensions: joinPath(home, '.cursor', 'extensions')
					};
				case 'windsurf':
					return {
						userData: joinPath(config, 'Windsurf', 'User'),
						extensions: joinPath(home, '.windsurf', 'extensions')
					};
			}
		} else if (isWindows) {
			const roaming = joinPath(home, 'AppData', 'Roaming');
			switch (id) {
				case 'vscode':
					return {
						userData: joinPath(roaming, 'Code', 'User'),
						extensions: joinPath(home, '.vscode', 'extensions')
					};
				case 'cursor':
					return {
						userData: joinPath(roaming, 'Cursor', 'User'),
						extensions: joinPath(home, '.cursor', 'extensions')
					};
				case 'windsurf':
					return {
						userData: joinPath(roaming, 'Windsurf', 'User'),
						extensions: joinPath(home, '.windsurf', 'extensions')
					};
			}
		}
		return undefined;
	}

	private async migrateUserData(source: URI) {
		const target = this.environmentService.appSettingsHome;
		const filesToCopy = ['settings.json', 'keybindings.json', 'snippets'];

		for (const file of filesToCopy) {
			const sourceFile = joinPath(source, file);
			const targetFile = joinPath(target, file);

			if (await this.fileService.exists(sourceFile)) {
				this.logService.info(`[Migration] Copying ${file} from ${sourceFile.fsPath}`);
				await this.fileService.copy(sourceFile, targetFile, true);
			}
		}
	}

	private async migrateExtensions(source: URI) {
		const target = URI.file(this.environmentService.extensionsPath);
		if (await this.fileService.exists(source)) {
			this.logService.info(`[Migration] Copying extensions from ${source.fsPath}`);
			// Copy is recursive for folders in IFileService
			await this.fileService.copy(source, target, true);
		}
	}

	onEnter(): void { }
	onExit(): void { }
}
