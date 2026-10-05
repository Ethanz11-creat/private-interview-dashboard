# Task 3 Report: Architecture Build Integration

## Scope

- Added grouped sidebar navigation in `public/index.html` with the existing `data-round` selectors preserved.
- Added the `architectureSource` template with `ARCHITECTURE_SOURCE_START` and `ARCHITECTURE_SOURCE_END` markers outside the project and supervisor templates.
- Updated `scripts/merge-content.mjs` to read and validate `content/model-architecture.html`, then inject it through the architecture marker block.
- Kept route/render behavior unchanged for the later route integration task.

## Verification

- `npm run build` passed.
- Build output: `Preserved other projects; embedded the complete school, supervisor and architecture content.`
- `node --check scripts/merge-content.mjs` passed.
- Marker checks passed for project, supervisor, and architecture marker pairs; the architecture section appears once inside `architectureSource`.

## Files

- `public/index.html`
- `scripts/merge-content.mjs`

## Concern

The existing supervisor merge behavior refreshes a stale source-link line from the current source HTML during `npm run build`. This is pre-existing merge behavior and was left unchanged as required; it appears in the generated `public/index.html` diff alongside the requested architecture injection.
