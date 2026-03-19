# CodeX Path Intellisense

Native path completion engine for CodeX, providing lightning-fast autocompletion for filenames across your entire workspace.

## Features

- **Blazing Fast**: Engineered for performance with CodeX.
- **Smart Mappings**: Automatically resolves workspace paths, supporting `tsconfig` baseUrl and paths.
- **Customizable**: Extensive configuration options to tailor the completion experience to your workflow.
- **Cross-Platform**: Seamless support for macOS, Windows, and Linux.

## Configuration

To use CodeX Path Intellisense instead of the default autocompletion, add the following to your settings:

```json
{ 
    "typescript.suggest.paths": false,
    "javascript.suggest.paths": false 
}
```

### Settings

- `codexPathIntellisense.mappings`: Define custom path mappings (supports `${workspaceFolder}`).
- `codexPathIntellisense.extensionOnImport`: Toggle file extensions in import statements.
- `codexPathIntellisense.showHiddenFiles`: Show hidden files in suggestions.
- `codexPathIntellisense.autoSlashAfterDirectory`: Automatically add a slash after selecting a directory.
- `codexPathIntellisense.absolutePathToWorkspace`: Resolve absolute paths relative to the workspace root.

## Usage

Simply start typing a path (e.g., `./`, `../`, or `/`) in any supported file, and CodeX Path Intellisense will offer relevant suggestions.

## License

MIT License by Suryanshu Nabheet.
