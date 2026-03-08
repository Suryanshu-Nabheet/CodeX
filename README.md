<p align="center">
  <img src="public/banner.png" width="100%" alt="CodeX Banner" />
</p>

# CodeX

CodeX is a development environment built on a modified VS Code foundation, engineered for native AI integration. Unlike traditional plugin-based solutions, CodeX embeds autonomous intelligence into the core workbench services, enabling high-performance orchestration and deep contextual awareness across the entire development lifecycle.

## Technical Architecture

The system is architected as a set of non-blocking asynchronous services that handle inference, state management, and UI rendering without compromising the responsiveness of the editor's main thread.

### Workbench Contribution Layer (`src/vs/workbench/contrib/codex`)
This is the primary integration point for CodeX features within the VS Code codebase.
- **EditCodeService**: Manages the lifecycle of inline code transformations (Cmd+K). It handles the projection of LLM-generated diffs into editor view zones and maintains a dedicated undo/redo stack for AI modifications.
- **Context Engine (`contextGatheringService.ts`)**: Implements automated workspace indexing. It performs dependency mapping, project-wide symbol analysis, and token-efficient serialization to provide LLMs with high-fidelity workspace state.
- **Model Context Protocol (MCP)**: Implements native support for the MCP standard. This allows the AI engine to dynamically discover and execute local tools, interact with the filesystem, and bridge external service APIs through a unified schema.

### Core Foundation & Services
- **Inference Layer**: Direct protocol implementation for major providers (Anthropic, OpenAI, DeepSeek, Google Gemini). It bypasses intermediary relays to ensure zero data retention and minimal latency.
- **Edge Inference**: Native support for local inference engines including Ollama, vLLM, and LM Studio via standardized OpenAI-compliant endpoints.
- **Streaming Orchestration**: A custom event-driven handler that processes partial LLM outputs to render real-time, flicker-free diffs directly within the active text buffer.

## Integrated Capabilities

### AI Sidebar
A persistent, React-powered engineering environment integrated into the workbench auxiliary bar. It facilitates complex, multi-turn agentic workflows, supporting autonomous reasoning and workspace-wide code generation.

### Inline Transformation (Cmd+K)
Processes logical modifications directly within the active editor. It uses a specialized diffing algorithm to project changes into high-contrast view zones, allowing for granular review and acceptance of generated snippets.

### Predictive Autocomplete
A background service providing low-latency inline suggestions. It analyzes prefix/suffix metadata and cross-file dependencies to anticipate engineering intent, significantly reducing boilerplate overhead.

### Integrated Diagnostics (Error Lens)
Visualizes compiler errors and lint warnings at the point of origin. It leverages the internal decoration API to project diagnostic metadata directly onto the source line, improving the technical feedback loop.

### SCM Lifecycle Management
Advanced tools for streamlined version control integrated into the SCM pane:
- **Codex Commit**: Analyzes staged diffs to generate precise, structured, and descriptive commit documentation.
- **Codex Timeline**: A custom TreeView implementation for granular navigation of commit history, stashed changes, and remote repository states.
- **Codex Sync**: Extends the workbench UI with dedicated, high-priority controls for source control synchronization (Pull/Push).

## Project Structure

- `src/vs/workbench/contrib/codex/browser`: Frontend logic, React components, and workbench contribution points.
- `src/vs/workbench/contrib/codex/common`: Shared types, inference services, and core business logic.
- `extensions/codex-*`: Internal extension suite providing specialized UI and SCM enhancements.
- `scripts/`: Build and launch utilities for the CodeX runtime.

## Setup & Deployment

### Prerequisites
- **Runtime**: Node.js v20 or v22 (LTS)
- **Toolchain**: Git 2.x+, Python 3.x
- **Build Chain**:
  - macOS: Xcode Command Line Tools
  - Linux: GCC/G++ build-essential
  - Windows: Visual Studio Build Tools

### Installation
```bash
git clone https://github.com/Suryanshu-Nabheet/CodeX.git
cd CodeX
npm install
npm run compile
```

### Execution
```bash
# Start background compilation
npm run watch

# Launch CodeX
./scripts/code.sh
```

## Data Sovereignty
CodeX is designed for technical privacy. All telemetry is disabled. Communications with AI providers are direct, ensuring that source code and sensitive project metadata are never routed through or stored on third-party infrastructure.

## Governance
Managed by the CodeX Open Source Initiative.
Technical Lead: suryanshunab@gmail.com
