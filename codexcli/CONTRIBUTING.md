# Contributing to CodexCLI

Thanks for helping improve [CodexCLI](https://github.com/Suryanshu-Nabheet/CodeX/tree/main/codexcli).

## Getting started

1. Fork the repository on GitHub.
2. Clone your fork:

```bash
git clone https://github.com/Suryanshu-Nabheet/CodeX.git
cd CodeX/codexcli
```

3. Install and build:

```bash
npm install
npm run build
```

## Workflow

1. Create a branch: `git checkout -b feature/short-name`
2. Make focused changes.
3. Verify:

```bash
npm test
npm run lint
npm run build
```

4. Push and open a Pull Request against `main` on [Suryanshu-Nabheet/CodeX](https://github.com/Suryanshu-Nabheet/CodeX).

## Style

- `eslint` + `prettier` — run `npm run format:fix` before submitting
- Prefer small, production-ready diffs
- Match existing patterns in `src/`

## License

Contributions are licensed under the project [LICENSE](./LICENSE).
