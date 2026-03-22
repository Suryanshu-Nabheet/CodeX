import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Position } from '../../../../editor/common/core/position.js';
import { DocumentSymbol, SymbolKind } from '../../../../editor/common/languages.js';
import { ITextModel } from '../../../../editor/common/model.js';
import { ILanguageFeaturesService } from '../../../../editor/common/services/languageFeatures.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Range, IRange } from '../../../../editor/common/core/range.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';
import { URI } from '../../../../base/common/uri.js';
import { IDirectoryStrService } from '../common/directoryStrService.js';
import { IFileService } from '../../../../platform/files/common/files.js';


// make sure snippet logic works
// change logic for `visited` to intervals
// atomically set new snippets at end
// throttle cache setting

interface IVisitedInterval {
	uri: string;
	startLine: number;
	endLine: number;
}

export interface IContextGatheringService {
	readonly _serviceBrand: undefined;
	updateCache(model: ITextModel, pos: Position): Promise<void>;
	getCachedSnippets(): string[];
}

export const IContextGatheringService = createDecorator<IContextGatheringService>('contextGatheringService');

class ContextGatheringService extends Disposable implements IContextGatheringService {
	_serviceBrand: undefined;
	private readonly _DEFAULT_SNIPPET_LINE_COUNT = 15;
	private readonly _ARCHITECTURAL_CONTEXT_LINE_COUNT = 100;
	// Cache holds the most recent list of snippets.
	private _cache: string[] = [];
	private _snippetIntervals: IVisitedInterval[] = [];

	constructor(
		@ILanguageFeaturesService private readonly _langFeaturesService: ILanguageFeaturesService,
		@IModelService private readonly _modelService: IModelService,
		@ICodeEditorService private readonly _codeEditorService: ICodeEditorService,
		@IDirectoryStrService private readonly _directoryStrService: IDirectoryStrService,
		@IFileService private readonly _fileService: IFileService,
	) {
		super();
		this._modelService.getModels().forEach(model => this._subscribeToModel(model));
		this._register(this._modelService.onModelAdded(model => this._subscribeToModel(model)));
	}

	private _updateDebounce: any;
	private _subscribeToModel(model: ITextModel): void {
		this._register(model.onDidChangeContent(() => {
			if (this._updateDebounce) clearTimeout(this._updateDebounce);
			this._updateDebounce = setTimeout(() => {
				const editor = this._codeEditorService.getFocusedCodeEditor();
				if (editor && editor.getModel() === model) {
					const pos = editor.getPosition();
					if (pos) {
						this.updateCache(model, pos);
					}
				}
			}, 50); // Debounce to avoid excessive symbol lookups
		}));
	}

	private async _gatherArchitecturalContext(model: ITextModel, pos: Position, snippets: Set<string>): Promise<void> {
		const providers = this._langFeaturesService.documentSymbolProvider.all(model);
		const symbolPromises = providers.map(p => p.provideDocumentSymbols(model, CancellationToken.None));
		const symbolsList = await Promise.all(symbolPromises);

		for (const symbols of symbolsList) {
			if (!symbols) continue;

			for (const symbol of symbols) {
				if (Range.containsPosition(symbol.range, pos)) {
					snippets.add(`// Architecturally relevant symbol in ${model.uri.fsPath}:\n// ${symbol.name}`);
					const range = symbol.range;
					const context = model.getValueInRange({
						startLineNumber: Math.max(1, range.startLineNumber - 5),
						startColumn: 1,
						endLineNumber: Math.min(model.getLineCount(), range.endLineNumber + 5),
						endColumn: model.getLineMaxColumn(Math.min(model.getLineCount(), range.endLineNumber + 5))
					});
					snippets.add(context);
				}
			}
		}
	}

	public async updateCache(model: ITextModel, pos: Position): Promise<void> {
		const snippets = new Set<string>();
		this._snippetIntervals = []; // Reset intervals for new cache update

		await this._gatherNearbySnippets(model, pos, this._DEFAULT_SNIPPET_LINE_COUNT, 5, snippets, this._snippetIntervals); // Deep architectural scan
		await this._gatherParentSnippets(model, pos, this._DEFAULT_SNIPPET_LINE_COUNT, 5, snippets, this._snippetIntervals); // Full logic-tree resolution
		await this._gatherArchitecturalContext(model, pos, snippets); // Project-wide awareness scan
		await this._gatherProjectPulse(model, snippets); // High-level project pulse
		await this._gatherHotFiles(snippets); // Mission-critical file context

		// Convert to array and prioritize by relevance
		const prioritized = Array.from(snippets).sort((a, b) => {
			// Prioritize local siblings and parent snippets
			if (a.includes('Sibling Context') && !b.includes('Sibling Context')) return -1;
			if (b.includes('Sibling Context') && !a.includes('Sibling Context')) return 1;
			return b.length - a.length; // Prefer more detailed context if other factors are equal
		});

		// Cap total context size to prevent LLM overload (approx 3000 tokens)
		this._cache = prioritized.slice(0, 15); 
		console.log('Cache updated with prioritized snippets:', this._cache.length);
	}

	public getCachedSnippets(): string[] {
		return this._cache;
	}

	// Basic snippet extraction.
	private _getSnippetForRange(model: ITextModel, range: IRange, numLines: number): string {
		const startLine = Math.max(range.startLineNumber - numLines, 1);
		const endLine = Math.min(range.endLineNumber + numLines, model.getLineCount());

		// Enforce maximum snippet size
		const totalLines = endLine - startLine + 1;
		const adjustedStartLine = totalLines > this._ARCHITECTURAL_CONTEXT_LINE_COUNT
			? endLine - this._ARCHITECTURAL_CONTEXT_LINE_COUNT + 1
			: startLine;

		const snippetRange = new Range(adjustedStartLine, 1, endLine, model.getLineMaxColumn(endLine));
		return this._cleanSnippet(model.getValueInRange(snippetRange));
	}

	private _cleanSnippet(snippet: string): string {
		return snippet
			.split('\n')
			// Remove empty lines and lines with only comments
			.filter(line => {
				const trimmed = line.trim();
				return trimmed && !/^\/\/+$/.test(trimmed);
			})
			// Rejoin with newlines
			.join('\n')
			// Remove excess whitespace
			.trim();
	}

	private _normalizeSnippet(snippet: string): string {
		return snippet
			// Remove multiple newlines
			.replace(/\n{2,}/g, '\n')
			// Remove trailing whitespace
			.trim();
	}

	private _addSnippetIfNotOverlapping(
		model: ITextModel,
		range: IRange,
		snippets: Set<string>,
		visited: IVisitedInterval[]
	): void {
		const startLine = range.startLineNumber;
		const endLine = range.endLineNumber;
		const uri = model.uri.toString();

		if (!this._isRangeVisited(uri, startLine, endLine, visited)) {
			visited.push({ uri, startLine, endLine });
			const snippet = this._normalizeSnippet(this._getSnippetForRange(model, range, this._DEFAULT_SNIPPET_LINE_COUNT));
			if (snippet.length > 0) {
				snippets.add(snippet);
			}
		}
	}

	private async _gatherNearbySnippets(
		model: ITextModel,
		pos: Position,
		numLines: number,
		depth: number,
		snippets: Set<string>,
		visited: IVisitedInterval[]
	): Promise<void> {
		if (depth <= 0) return;

		const startLine = Math.max(pos.lineNumber - numLines, 1);
		const endLine = Math.min(pos.lineNumber + numLines, model.getLineCount());
		const range = new Range(startLine, 1, endLine, model.getLineMaxColumn(endLine));

		this._addSnippetIfNotOverlapping(model, range, snippets, visited);

		const symbols = await this._getSymbolsNearPosition(model, pos, numLines);
		for (const sym of symbols) {
			const defs = await this._getDefinitionSymbols(model, sym);
			for (const def of defs) {
				const defModel = this._modelService.getModel(def.uri);
				if (defModel) {
					const defPos = new Position(def.range.startLineNumber, def.range.startColumn);
					this._addSnippetIfNotOverlapping(defModel, def.range, snippets, visited);
					await this._gatherNearbySnippets(defModel, defPos, numLines, depth - 1, snippets, visited);
				}
			}
		}
	}

	private async _gatherParentSnippets(
		model: ITextModel,
		pos: Position,
		numLines: number,
		depth: number,
		snippets: Set<string>,
		visited: IVisitedInterval[]
	): Promise<void> {
		if (depth <= 0) return;

		const container = await this._findContainerFunction(model, pos);
		if (!container) return;

		const containerRange = container.kind === SymbolKind.Method ? container.selectionRange : container.range;
		this._addSnippetIfNotOverlapping(model, containerRange, snippets, visited);

		const symbols = await this._getSymbolsNearRange(model, containerRange, numLines);
		for (const sym of symbols) {
			const defs = await this._getDefinitionSymbols(model, sym);
			for (const def of defs) {
				const defModel = this._modelService.getModel(def.uri);
				if (defModel) {
					const defPos = new Position(def.range.startLineNumber, def.range.startColumn);
					this._addSnippetIfNotOverlapping(defModel, def.range, snippets, visited);
					await this._gatherNearbySnippets(defModel, defPos, numLines, depth - 1, snippets, visited);
				}
			}
		}

		const containerPos = new Position(containerRange.startLineNumber, containerRange.startColumn);
		await this._gatherParentSnippets(model, containerPos, numLines, depth - 1, snippets, visited);
	}

	private _isRangeVisited(uri: string, startLine: number, endLine: number, visited: IVisitedInterval[]): boolean {
		return visited.some(interval =>
			interval.uri === uri &&
			!(endLine < interval.startLine || startLine > interval.endLine)
		);
	}

	private async _getSymbolsNearPosition(model: ITextModel, pos: Position, numLines: number): Promise<DocumentSymbol[]> {
		const startLine = Math.max(pos.lineNumber - numLines, 1);
		const endLine = Math.min(pos.lineNumber + numLines, model.getLineCount());
		const range = new Range(startLine, 1, endLine, model.getLineMaxColumn(endLine));
		return this._getSymbolsInRange(model, range);
	}

	private async _getSymbolsNearRange(model: ITextModel, range: IRange, numLines: number): Promise<DocumentSymbol[]> {
		const centerLine = Math.floor((range.startLineNumber + range.endLineNumber) / 2);
		const startLine = Math.max(centerLine - numLines, 1);
		const endLine = Math.min(centerLine + numLines, model.getLineCount());
		const searchRange = new Range(startLine, 1, endLine, model.getLineMaxColumn(endLine));
		return this._getSymbolsInRange(model, searchRange);
	}

	private async _getSymbolsInRange(model: ITextModel, range: IRange): Promise<DocumentSymbol[]> {
		const symbols: DocumentSymbol[] = [];
		const providers = this._langFeaturesService.documentSymbolProvider.ordered(model);
		for (const provider of providers) {
			try {
				const result = await provider.provideDocumentSymbols(model, CancellationToken.None);
				if (result) {
					const flat = this._flattenSymbols(result);
					const intersecting = flat.filter(sym => this._rangesIntersect(sym.range, range));
					symbols.push(...intersecting);
				}
			} catch (e) {
				console.warn('Symbol provider error:', e);
			}
		}
		// Also check reference providers.
		const refProviders = this._langFeaturesService.referenceProvider.ordered(model);
		for (let line = range.startLineNumber; line <= range.endLineNumber; line++) {
			const content = model.getLineContent(line);
			const words = content.match(/[a-zA-Z_]\w*/g) || [];
			for (const word of words) {
				const startColumn = content.indexOf(word) + 1;
				const pos = new Position(line, startColumn);
				if (!this._positionInRange(pos, range)) continue;
				for (const provider of refProviders) {
					try {
						const refs = await provider.provideReferences(model, pos, { includeDeclaration: true }, CancellationToken.None);
						if (refs) {
							const filtered = refs.filter(ref => this._rangesIntersect(ref.range, range));
							for (const ref of filtered) {
								symbols.push({
									name: word,
									detail: '',
									kind: SymbolKind.Variable,
									range: ref.range,
									selectionRange: ref.range,
									children: [],
									tags: []
								});
							}
						}
					} catch (e) {
						console.warn('Reference provider error:', e);
					}
				}
			}
		}
		return symbols;
	}

	private _flattenSymbols(symbols: DocumentSymbol[]): DocumentSymbol[] {
		const flat: DocumentSymbol[] = [];
		for (const sym of symbols) {
			flat.push(sym);
			if (sym.children && sym.children.length > 0) {
				flat.push(...this._flattenSymbols(sym.children));
			}
		}
		return flat;
	}

	private _rangesIntersect(a: IRange, b: IRange): boolean {
		return !(
			a.endLineNumber < b.startLineNumber ||
			a.startLineNumber > b.endLineNumber ||
			(a.endLineNumber === b.startLineNumber && a.endColumn < b.startColumn) ||
			(a.startLineNumber === b.endLineNumber && a.endColumn > b.endColumn)
		);
	}

	private _positionInRange(pos: Position, range: IRange): boolean {
		return pos.lineNumber >= range.startLineNumber &&
			pos.lineNumber <= range.endLineNumber &&
			(pos.lineNumber !== range.startLineNumber || pos.column >= range.startColumn) &&
			(pos.lineNumber !== range.endLineNumber || pos.column <= range.endColumn);
	}

	// Get definition symbols for a given symbol.
	private async _getDefinitionSymbols(model: ITextModel, symbol: DocumentSymbol): Promise<(DocumentSymbol & { uri: URI })[]> {
		const pos = new Position(symbol.range.startLineNumber, symbol.range.startColumn);
		const providers = this._langFeaturesService.definitionProvider.ordered(model);
		const defs: (DocumentSymbol & { uri: URI })[] = [];
		for (const provider of providers) {
			try {
				const res = await provider.provideDefinition(model, pos, CancellationToken.None);
				if (res) {
					const links = Array.isArray(res) ? res : [res];
					defs.push(...links.map(link => ({
						name: symbol.name,
						detail: symbol.detail,
						kind: symbol.kind,
						range: link.range,
						selectionRange: link.range,
						children: [],
						tags: symbol.tags || [],
						uri: link.uri  // Now keeping it as URI instead of converting to string
					})));
				}
			} catch (e) {
				console.warn('Definition provider error:', e);
			}
		}
		return defs;
	}

	private async _findContainerFunction(model: ITextModel, pos: Position): Promise<DocumentSymbol | null> {
		const searchRange = new Range(
			Math.max(pos.lineNumber - 1, 1), 1,
			Math.min(pos.lineNumber + 1, model.getLineCount()),
			model.getLineMaxColumn(pos.lineNumber)
		);
		const symbols = await this._getSymbolsInRange(model, searchRange);
		const funcs = symbols.filter(s =>
			(s.kind === SymbolKind.Function || s.kind === SymbolKind.Method) &&
			this._positionInRange(pos, s.range)
		);
		if (!funcs.length) return null;
		return funcs.reduce((innermost, current) => {
			if (!innermost) return current;
			const moreInner =
				(current.range.startLineNumber > innermost.range.startLineNumber ||
					(current.range.startLineNumber === innermost.range.startLineNumber &&
						current.range.startColumn > innermost.range.startColumn)) &&
				(current.range.endLineNumber < innermost.range.endLineNumber ||
					(current.range.endLineNumber === innermost.range.endLineNumber &&
						current.range.endColumn < innermost.range.endColumn));
			return moreInner ? current : innermost;
		}, null as DocumentSymbol | null);
	}

	private async _gatherProjectPulse(model: ITextModel, snippets: Set<string>): Promise<void> {
		try {
			const currentUri = model.uri;
			const parentDir = URI.revive(currentUri).with({ path: currentUri.path.split('/').slice(0, -1).join('/') });
			
			// Get siblings to understand local neighborhood
			const dirContent = await this._fileService.resolve(parentDir);
			if (dirContent.children) {
				const siblings = dirContent.children
					.filter(c => !c.isDirectory && c.name !== currentUri.path.split('/').pop())
					.slice(0, 3); // Top 3 siblings

				for (const sibling of siblings) {
					const siblingModel = this._modelService.getModel(sibling.resource);
					let content = '';
					if (siblingModel) {
						content = siblingModel.getValueInRange(new Range(1, 1, 30, 1)); // First 30 lines (exports/imports)
					} else {
						const fileContent = await this._fileService.readFile(sibling.resource);
						content = fileContent.value.toString().split('\n').slice(0, 30).join('\n');
					}
					if (content.trim()) {
						snippets.add(`// Sibling Context (${sibling.name}):\n${this._cleanSnippet(content)}`);
					}
				}
			}

			// Add global structure hint
			const structure = await this._directoryStrService.getAllDirectoriesStr({ cutOffMessage: '...' });
			if (structure) {
				snippets.add(`// Project Structure Overview:\n${structure.split('\n').slice(0, 20).join('\n')}`);
			}
		} catch (e) {
			console.warn('Project pulse error:', e);
		}
	}

	private async _gatherHotFiles(snippets: Set<string>): Promise<void> {
		try {
			// Mission critical files that define the project environment
			const hotFiles = ['package.json', 'tsconfig.json', 'README.md', 'src/vs/workbench/contrib/codex/common/prompt/prompts.ts']; 
			// Note: prompts.ts is added because it's the core of the AI logic in this specific project
			
			for (const fileName of hotFiles) {
				const models = this._modelService.getModels();
				const model = models.find(m => m.uri.path.endsWith(fileName));
				if (model) {
					snippets.add(`// Hot File Context (${fileName}):\n${model.getValueInRange(new Range(1, 1, 20, 1))}`);
				}
			}
		} catch (e) {
			console.warn('Hot file gathering error:', e);
		}
	}
}

registerSingleton(IContextGatheringService, ContextGatheringService, InstantiationType.Eager);
