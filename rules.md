# CodeX — Production Codebase Rules

> These rules govern all development, contribution, and AI-assisted work within the CodeX codebase. They are non-negotiable for maintaining stability, security, and architectural integrity across the production environment.

---

## 1. Architectural Principles

### 1.1 Non-Blocking by Default
All services must be implemented as non-blocking and asynchronous. No operation — inference, file I/O, state mutation, or API call — may block the editor's main thread. Use async/await, Promises, or event-driven patterns consistently. Synchronous blocking calls are grounds for immediate rejection.

### 1.2 Separation of Concerns
The codebase is divided into strict layers. Never cross layer boundaries:

| Layer | Path | Responsibility |
|---|---|---|
| Frontend / Contributions | `src/vs/workbench/contrib/codex/browser` | React components, view zones, workbench contribution points |
| Common / Business Logic | `src/vs/workbench/contrib/codex/common` | Shared types, inference services, core logic |
| Extensions | `extensions/codex-*` | Specialized UI and SCM enhancements |
| Build / Runtime | `scripts/` | Build utilities, launch scripts only |

Do not place business logic in `browser/`. Do not place UI rendering in `common/`. Extensions must not reach into `src/vs/workbench/contrib/codex/common` directly — go through defined service interfaces.

### 1.3 Service Interface Contracts
All inter-service communication must go through typed interfaces. Concrete implementations are never imported directly across module boundaries. Use VS Code's dependency injection (service locator / `IInstantiationService`) for all workbench services.

---

## 2. Code Quality Standards

### 2.1 TypeScript Strictness
- `strict: true` is mandatory. No exceptions.
- No use of `any` unless wrapping a third-party boundary — and even then, constrain it immediately with a cast or type guard.
- All public-facing service methods must have explicit return types.
- Avoid non-null assertions (`!`) unless the nullability has been ruled out in the same scope.

### 2.2 Naming Conventions
- **Services**: `PascalCase` class name suffixed with `Service` (e.g., `EditCodeService`, `ContextGatheringService`).
- **Interfaces**: Prefixed with `I` (e.g., `IEditCodeService`).
- **Files**: `camelCase` for service files (e.g., `contextGatheringService.ts`), `PascalCase` for React components (e.g., `SidebarPanel.tsx`).
- **Constants**: `SCREAMING_SNAKE_CASE`.
- **Private class members**: prefix with `_` (e.g., `_undoStack`).

### 2.3 File Size and Modularity
No single file should exceed 600 lines of logic. If a file approaches this limit, decompose it. Context-gathering logic, diffing algorithms, and streaming orchestration each live in their own dedicated modules.

### 2.4 No Dead Code
Dead code, commented-out blocks, and unused imports are not permitted in production branches. Use `// TODO(username): reason` with an associated issue reference for deferred work — never leave unexplained stubs.

---

## 3. AI Integration Rules

### 3.1 Inference Layer Discipline
The inference layer communicates directly with AI providers (Anthropic, OpenAI, DeepSeek, Google Gemini). It must never introduce an intermediary relay or third-party proxy. Any change to provider communication must preserve direct-connection semantics and zero data retention guarantees.

### 3.2 Prompt and Context Construction
- All prompt construction is the exclusive responsibility of `contextGatheringService.ts` and its dependents.
- Token budgets must be enforced before any context is sent to a model. Never send unbounded context.
- Workspace indexing results must be serialized in a token-efficient, deterministic format. Do not inline raw file contents without truncation logic.

### 3.3 Streaming Outputs
- The streaming orchestration handler must remain the single path for processing partial LLM outputs.
- Diff projection into editor view zones must be flicker-free. Partial states must never produce invalid AST or syntax errors in the active buffer.
- All streamed diffs must be reversible via the AI-specific undo/redo stack managed by `EditCodeService`. Do not conflate this stack with the native VS Code undo stack.

### 3.4 MCP (Model Context Protocol)
- MCP tool discovery and execution must be sandboxed. Tools may interact with the filesystem and external APIs only within the permissions declared at registration.
- New MCP tool schemas must be reviewed before merging. No tool may exfiltrate workspace data to an undeclared endpoint.
- MCP tool invocations must be logged for auditability. Log entries must include: tool name, invocation timestamp, input schema hash, and result status. Never log raw input values that may contain source code or secrets.

### 3.5 Edge Inference
- Local inference endpoints (Ollama, vLLM, LM Studio) are accessed via OpenAI-compliant interfaces only.
- No provider-specific SDK may be used for local inference. Standardized endpoints ensure portability.
- Latency and availability of local endpoints must be handled gracefully with fallback messaging — never a silent failure.

---

## 4. Data Sovereignty and Privacy

### 4.1 Zero Telemetry
Telemetry is permanently disabled. No new telemetry, analytics, usage tracking, or crash reporting may be added. This is a hard constraint, not a configuration option.

### 4.2 No Third-Party Data Routing
Source code, file contents, symbol data, commit history, and any workspace metadata must never be routed through third-party infrastructure beyond the declared AI provider endpoints. This includes logging aggregators, error-tracking services, and CDN edge functions.

### 4.3 Secrets Handling
- API keys and credentials are never hardcoded, logged, stored in state, or passed through React props.
- Secrets are accessed exclusively via the designated secure credential store.
- No secret value may appear in any diff, view zone, commit message generator output, or diagnostic overlay.

---

## 5. Editor Integration Rules

### 5.1 Decoration and View Zone API
- All editor decorations must be created via the internal decoration API. Direct DOM manipulation of the editor surface is forbidden.
- View zones used by `EditCodeService` for diff display must be cleaned up on rejection, acceptance, or editor close. Memory leaks from orphaned view zones are a blocking bug.

### 5.2 Cmd+K Inline Transformation
- Inline transformations operate only on the active editor's text buffer.
- All generated diffs must go through the diffing algorithm defined in `EditCodeService` — ad-hoc string splicing is not acceptable.
- The user must always be able to accept or reject any AI-generated change. There is no "auto-apply without review" mode in production.

### 5.3 Autocomplete Service
- The predictive autocomplete service is a background service. It must never produce UI-blocking behavior.
- Suggestions must respect prefix/suffix context and cross-file dependencies. Suggestions that ignore open file context are a quality regression.
- Autocomplete must degrade gracefully if the inference layer is unavailable.

### 5.4 Diagnostics (Error Lens)
- Diagnostic overlays are applied via the decoration API only.
- Diagnostic metadata is sourced from the language server and compiler — not inferred or fabricated by the AI layer.
- Error Lens rendering must not interfere with existing editor gutter annotations or breakpoints.

---

## 6. SCM (Source Control) Rules

### 6.1 Codex Commit
- Commit message generation analyzes only staged diffs. It must not read unstaged changes, stash contents, or untracked files without explicit user action.
- Generated commit messages must be structured, descriptive, and accurate. Do not use vague placeholder messages (e.g., "fixed stuff", "update").
- The user always reviews and confirms the generated message before a commit is created. Auto-commit without review is disallowed.

### 6.2 Codex Timeline
- The Timeline TreeView is read-only. It must not modify repository state.
- Navigation of commit history, stashes, and remote states must be non-destructive.

### 6.3 Codex Sync
- Pull and Push controls are high-priority UI operations. They must reflect real-time SCM state.
- Sync operations must surface clear, actionable error states (e.g., merge conflicts, authentication failures) — never fail silently.
- Force-push operations are never triggered implicitly. Any destructive remote operation requires an explicit user confirmation dialog.

---

## 7. React Component Standards

### 7.1 AI Sidebar
- The sidebar is a persistent React application embedded in the workbench auxiliary bar.
- State for multi-turn agentic workflows must be managed with explicit, typed state machines — not ad-hoc flag accumulation.
- Component re-renders must be minimized. Use `React.memo`, `useMemo`, and `useCallback` where rendering cost is measurable.

### 7.2 General Component Rules
- No component may perform direct inference calls. Inference is always delegated to the service layer.
- Props must be fully typed. No `any` in component prop types.
- Side effects (subscriptions, service calls) live in `useEffect` with proper cleanup functions. Resource leaks from missing cleanup are blocking bugs.
- No inline styles. Use the VS Code theming API and CSS custom properties for all visual styling to ensure theme compatibility.

---

## 8. Build and Runtime

### 8.1 Node.js Version
The runtime is **Node.js v20 or v22 (LTS) only**. No other versions are supported. CI will reject builds on unsupported runtimes.

### 8.2 Build Discipline
- `npm run compile` must pass with zero errors before any PR is submitted.
- `npm run watch` is for local development only — never used in CI or production builds.
- Build warnings are treated as errors. Address them; do not suppress them.

### 8.3 Dependency Management
- All new dependencies require justification in the PR description: purpose, size impact, and license.
- No dependency with a non-permissive license (GPL, AGPL, SSPL) may be added without legal review.
- Dependencies are pinned to exact versions in `package.json`. Floating ranges (`^`, `~`) are not permitted for production dependencies.
- `node_modules` is never committed.

### 8.4 Platform Build Toolchains
- macOS: Xcode Command Line Tools must be installed.
- Linux: `build-essential` (GCC/G++) is required.
- Windows: Visual Studio Build Tools are required.
- CI pipelines must validate all three platforms on each release branch merge.

---

## 9. Git and Contribution Workflow

### 9.1 Branch Naming
| Type | Pattern | Example |
|---|---|---|
| Feature | `feat/<scope>/<short-description>` | `feat/sidebar/multi-turn-state` |
| Bug Fix | `fix/<scope>/<short-description>` | `fix/editcode/undo-stack-leak` |
| Refactor | `refactor/<scope>/<short-description>` | `refactor/context-engine/token-budget` |
| Hotfix | `hotfix/<short-description>` | `hotfix/mcp-auth-bypass` |

### 9.2 Commit Messages
Follow the Conventional Commits specification:

```
<type>(<scope>): <short summary>

[optional body: what and why, not how]

[optional footer: BREAKING CHANGE, issue refs]
```

Types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `chore`, `ci`.

Scope maps to the codebase layer (e.g., `editcode`, `context-engine`, `sidebar`, `scm`, `mcp`, `inference`).

### 9.3 Pull Requests
- Every PR requires at least one reviewer with domain knowledge of the affected layer.
- PRs touching the inference layer, MCP schema, or data routing require review from the Technical Lead (`suryanshunab@gmail.com`).
- PRs must include a description of: what changed, why, and how it was tested.
- All CI checks must pass before merge. No force-merging over failing checks.

### 9.4 Protected Branches
- `main` is the production branch. Direct commits are forbidden.
- All merges to `main` go through a PR with passing CI and at least one approval.
- History on `main` is linear. Squash or rebase merges only — no merge commits.

---

## 10. Testing Requirements

### 10.1 Coverage Expectations
- All new services in `common/` must have unit tests.
- Integration tests are required for: inference layer provider integrations, MCP tool execution paths, and SCM lifecycle operations.
- React components in `browser/` require snapshot tests for any component exposed in the primary user workflow (sidebar, inline diff, commit UI).

### 10.2 Test Organization
- Unit tests live adjacent to source files: `foo.ts` → `foo.test.ts`.
- Integration and E2E tests live under `test/integration/` and `test/e2e/` respectively.
- Tests must not make real network calls. Mock all provider endpoints and external services.

### 10.3 Test Quality
- Tests must test behavior, not implementation. Never assert on private method calls.
- Flaky tests are treated as bugs. A test that passes intermittently provides no safety guarantees and must be fixed or removed.

---

## 11. Security Rules

### 11.1 Input Validation
All inputs entering the inference layer, MCP tool executor, or SCM operations must be validated and sanitized. Never pass raw user input or raw file content directly to shell commands, filesystem APIs, or external service calls without sanitization.

### 11.2 Dependency Auditing
`npm audit` must be run and addressed before each release. Critical and high severity vulnerabilities block the release. Moderate vulnerabilities require a documented remediation plan.

### 11.3 No Eval
`eval()`, `new Function()`, and dynamic code execution from runtime strings are forbidden everywhere in the codebase.

---

## 12. Documentation Standards

- Every exported service interface must have JSDoc comments describing its purpose and each method's contract.
- Non-obvious algorithmic choices (e.g., token budget calculation, diff projection logic) must have inline explanatory comments.
- `README` and setup documentation must be updated in the same PR as any change to the installation, build, or execution workflow.
- Architecture decision records (ADRs) are stored in `docs/adr/` for any significant structural change.

---

## Enforcement

Violations of rules marked with hard constraints (telemetry, data routing, main-thread blocking, force-merge on `main`) are grounds for immediate revert without discussion. All other violations are addressed through the standard PR review and feedback process.

Questions and exceptions: contact the Technical Lead at `suryanshunab@gmail.com`.

