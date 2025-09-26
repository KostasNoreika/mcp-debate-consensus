# Repository Guidelines

## Project Structure & Module Organization
Core orchestration code resides in `src/`, with debate control in `src/iterative-debate-orchestrator.js`, model routing in `src/gemini-coordinator.js`, and guardrails in `src/security.js`. Agent wrappers (`k*-wrapper.sh`), startup scripts (`index.js`, `k-proxy-server.js`, `health-check.js`), and operational docs sit at the repository root. Configuration presets and schema helpers live under `config/`, while scenario research and design notes are filed in `docs/` and `tasks/`. Jest fixtures and integration harnesses use the root `test-*.js` scripts backed by utilities in `tests/`.

## Build, Test, and Development Commands
Install dependencies with `npm install`, then bootstrap local state through `npm run setup`. Launch the OpenRouter proxy via `npm run proxy`, and start the MCP server with `npm start` or `npm run dev` for verbose logging. `npm run health` performs an end-to-end readiness probe. Run the main regression suite with `npm test`; add `npm run test:coverage` before large merges. Targeted diagnostics exist for critical subsystems, including `npm run test:cache`, `npm run test:confidence`, and `npm run learning:status`.

## Coding Style & Naming Conventions
The project targets Node.js 18+ and uses ES modules, so prefer `import`/`export` and async/await patterns. Keep indentation at two spaces, terminate statements with semicolons, and use descriptive camelCase identifiers. Filenames and scripts stay in kebab-case (`test-performance-tracking.js`). When expanding orchestration flows, preserve the existing helper classes (e.g., `DebateMemory`) and align logging prefixes with the established `[Debate]`, `[Cache]`, or `[Learning]` tags.

## Testing Guidelines
Jest drives automated testing. Mirror the existing naming pattern (`test-<focus>.js`) for new scripts, and colocate fixtures in `tests/`. Prioritise end-to-end scenarios that exercise debate coordination, caching, and scoring, mocking only external network calls. Capture new behaviours with coverage runs (`npm run test:coverage`) and include reproduction commands in the PR body.

## Commit & Pull Request Guidelines
Follow the conventional commit prefixes visible in history (`feat:`, `fix:`, `docs:`, `chore:`) and keep imperative subject lines under 72 characters. Each PR should describe the change, reference the related task or issue, list validation commands (`npm test`, `npm run health`), and flag configuration impacts such as new environment variables. Attach logs or screenshots when the change influences debate transcripts or scoring output.

## Configuration & Security Tips
Start from `.env.example`, store secrets in `.env`, and never commit credentials. The proxy requires a valid OpenRouter API key before any debate run. When editing security constraints (`src/security.js` or `config/security.json`), document the threat model in your PR and rerun `npm run health` to confirm sandbox protections remain intact.
