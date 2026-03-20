import { CodexPathIntellisenseProvider } from "./provider.interface";
import { JavaScriptProvider } from "./javascript/javascript.provider";

export const DefaultProvider: CodexPathIntellisenseProvider = {
  selector: "*",
  provider: JavaScriptProvider.provider,
  triggerCharacters: ["/", '"', "'"]
};
