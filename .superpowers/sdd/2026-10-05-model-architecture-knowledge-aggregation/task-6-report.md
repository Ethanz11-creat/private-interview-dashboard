# Task 6 Report: Source Status and Content Validation

## Status

Implemented the static architecture content validator and added the `check:architecture` package command.

The validator checks:

- all five required architecture section IDs and at least one figure in each;
- the `architecture-jev` section and the source ledger marker;
- every fragment image path, including traversal and missing-file diagnostics;
- source labels on every model card and external algorithm source block.

Accepted labels are `官方资料`, `用户画板`, `第三方说明`, and `待核实`.

## Verification

- `npm run check:architecture` passed: `Architecture content validation passed`
- `npm run check` passed
- `npm run build` passed
- `node --check scripts/validate-model-architecture.mjs` passed

## Concerns

The validator intentionally uses the repository's current semantic class names and lightweight HTML matching; it does not attempt to fully parse arbitrary HTML or validate remote URLs.

## Fix Follow-up

Source labels are now required in the structural `.architecture-source-note` and `.architecture-source-label` elements within each card. JEV and source-ledger checks are scoped to their expected subsection/footer structures. An internal regression check removes the first model card's label and verifies that validation would fail.
