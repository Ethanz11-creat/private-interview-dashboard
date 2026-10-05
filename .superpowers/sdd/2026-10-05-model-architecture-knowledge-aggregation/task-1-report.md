# Task 1 Report

## Status

DONE

## Files

- `scripts/extract-architecture-assets.mjs`
- `public/assets/model-architecture/manifest.json`
- 9 `source-new-architecture-##.png` assets
- 14 `source-video-board-##.png` assets

## Commands and output

`node scripts/extract-architecture-assets.mjs`

```text
/Users/yiheng/Downloads/新架构解读讲解.excalidraw: 9 assets
/Users/yiheng/Downloads/视频画板.excalidraw: 14 assets
Wrote 23 assets to public/assets/model-architecture/manifest.json
```

`node -e "const fs=require('fs'); const m=require('./public/assets/model-architecture/manifest.json'); console.log(m.length, new Set(m.map(x=>x.output)).size, m.filter(x=>!fs.existsSync(x.output)).length)"`

```text
23 23 0
```

## Self-review

- Source `.excalidraw` files were read only and remain unchanged.
- Embedded base64 PNG data is decoded directly from each `files[*].dataURL`.
- Assets are sorted by source order, then canvas `y`, `x`, and `fileId` for deterministic output.
- Duplicate image elements referencing one file ID are deduplicated. The source boards contain 9 and 14 embedded file records respectively, matching the required total.
- The extractor raises a clear error when an embedded file record has no valid base64 `dataURL`.

## Concerns

The first board contains one stale image element whose file ID is absent from its `files` map, and the second board contains duplicate image elements. The extractor intentionally follows embedded file records, using matching image coordinates where available, to produce the required 9 + 14 assets.
