# Task 4 Report: Architecture Route Wiring

## Changes

- Added `architecture` to the initial route and `popstate` URL allowlist, so `?round=architecture` survives refresh and hash navigation.
- Added architecture-specific title, system knowledge-map description, and five-chapter round map.
- Rendered `#architectureSource` as `大模型架构与训练知识汇总` for the architecture route.
- Replaced the generic footer wording for the architecture route with a system-knowledge-map description.
- Added the `03 / MODEL ARCHITECTURE` hero label in `reading-design.css`.
- Extended `topicLevel()` for architecture pages: the architecture title, five chapter headings, subsection/model/algorithm headings, and JEV cards are represented as nested topics. The source ledger page and body paragraphs are excluded.

## Verification

- `npm run build` passed and embedded school, supervisor, and architecture fragments.
- `npm run check` passed.
- `node --check public/topic-navigation.js` passed.
- Inline route script parsed successfully with `new Function(...)`.
- Static checks confirmed the architecture route allowlist and `source('#architectureSource', ...)` call are present.
- `git diff --check` passed.

## Concerns

- The architecture source is rendered from the existing template fragment; future chapter changes should continue to preserve the five stable IDs from Task 2.
- No browser automation dependency is configured in this package, so DOM behavior was validated through static route/template checks rather than a headless browser run.

## Review Fixes

- Corrected the architecture topic selector to use the actual `.architecture-hero h2` title, so the five chapter headings are nested beneath the page title in the right rail.
- Added a scoped five-column desktop grid for `.architecture-map`, with a three-column fallback below 1100px; existing narrow-screen and diagram overflow rules remain unchanged.

## Review Verification

- Re-ran `npm run build`, `npm run check`, `git diff --check`, and targeted static assertions for the hero selector and five-column map rule.
