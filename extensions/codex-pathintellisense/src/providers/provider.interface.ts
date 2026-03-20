import { CompletionItemProvider, DocumentSelector } from "vscode";

export interface CodexPathIntellisenseProvider {
  selector: DocumentSelector;
  provider: CompletionItemProvider;
  triggerCharacters?: string[];
}
