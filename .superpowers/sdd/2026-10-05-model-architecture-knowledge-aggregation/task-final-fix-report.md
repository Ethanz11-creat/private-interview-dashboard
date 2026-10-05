# Final review fix report

Date: 2026-10-05

## Scope

Corrected source traceability in the model architecture content after reviewing `public/assets/model-architecture/manifest.json`, the embedded PNGs, and the source-board metadata.

## Asset corrections

- Kept `source-video-board-01.png` as the Transformer/MiniMind dense overview and removed the incorrectly placed `source-new-architecture-01..04.png` figures from the Transformer chapter.
- Moved all nine `source-new-architecture-01..09.png` assets into the model chapter with their actual model-card identities: DeepSeek V3/R1, DeepSeek V3.2, Kimi K2, Qwen3 235B-A22B, Qwen3-Coder-Next, Qwen3.5, Step 3.5 Flash, MiniMax-M2.5, and GLM-5.
- Corrected component mappings: `source-video-board-05.png` is RMSNorm; `source-video-board-03.png` is the SiLU formula. The attention-variants card now uses a clearly labeled “暂无匹配原图 / 待核实” figure placeholder rather than a SiLU plot.
- Relabeled component originals `07..10` as sequence-level/batch-level MoE auxiliary-loss formulas, Router Top-K, and expert/ideal-load definitions.
- Relabeled training originals `11..14` as LoRA, PPO Actor/Critic/Reward/Reference, GRPO group-relative advantage, and DPO loss.
- Removed the misleading Agent image strip and added a source note stating that no current user-board PNG directly represents tool calling, workflow state, or JEV decision content. The Agent chapter uses its redraw for those concepts.
- Removed the later five-column sidebar override so grouped navigation keeps the intended three-column compact layout at narrow widths.

## Validation

- `npm run check` — passed.
- `npm run check:architecture` — passed (`Architecture content validation passed`).
- `npm run build` — passed.
- `git diff --check` — passed.

## Concerns

The Agent/tool/state/decision concepts remain represented by the chapter’s redraw and prose because the audited source PNG set has no directly attributable original for those concepts. No image meaning was inferred beyond the inspected asset contents.
