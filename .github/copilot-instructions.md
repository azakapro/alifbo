# GitHub Copilot instructions

Read and follow `/AGENTS.md` and `/CONTRIBUTING.md` before proposing changes.

In particular: never invent Uzbek transliteration rules, never use locale-aware or implicit Unicode case-conversion methods in `src`, preserve structured warnings for lossy conversions, keep the core free of runtime dependencies and Node APIs, and add golden tests for every conversion change. Run `npm run check` and `npx tsc --noEmit` before considering a change complete.
