# Codex Project Tree
Produced and Maintained by **Suryanshu Nabheet**

A production-grade Visual Studio Code extension that generates a professional tree structure of your project directly into your `README.md` or any other documentation file.

## Features
- **One-Command Generation**: Just press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac) and run `Codex: Generate Project Tree`.
- **Intelligent Filtering**: Respects your `.gitignore` rules and custom ignore patterns automatically.
- **Customizable Themes**: Choose between 'Modern' and 'Standard' tree styling.
- **Optional Inline Comments**: Add a prefix for manual file/folder annotations.

## Extension Settings
Customize your experience through the VS Code Settings (`CodexProjectTree.*`):

| Setting | Default | Description |
|---|---|---|
| `CodexProjectTree.theme` | `perfect` | Tree appearance: `normal` (standard) or `perfect` (modern). |
| `CodexProjectTree.withComment` | `false` | If enabled, appends `//` to each line for descriptions. |
| `CodexProjectTree.commentDistance` | `5` | Spacing before the comment prefix. |
| `CodexProjectTree.loadIgnore` | `true` | Whether to exclude files listed in `.gitignore`. |
| `CodexProjectTree.ignoreFolders` | `[...]` | Additional folders to exclude (e.g., `node_modules`, `.git`). |
| `CodexProjectTree.distFileName` | `README.md` | The target file to append the project tree to. |

## Example Output
```text
codex-project-tree
├─ .gitignore
├─ CHANGELOG.md
├─ README.md
├─ images
│  └─ tree-icon.jpg
├─ package.json
├─ src
│  ├─ config.ts
│  ├─ extension.ts
│  ├─ index.ts
│  └─ traverse.ts
└─ tsconfig.json
```

---
Built by **Suryanshu Nabheet**
