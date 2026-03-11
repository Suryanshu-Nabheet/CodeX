import { URI } from '../../../../base/common/uri.js';

export type CodexDirectoryItem = {
	uri: URI;
	name: string;
	isSymbolicLink: boolean;
	children: CodexDirectoryItem[] | null;
	isDirectory: boolean;
	isGitIgnoredDirectory: false | { numChildren: number }; // if directory is gitignored, we ignore children
}
