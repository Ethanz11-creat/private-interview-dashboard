# 模型架构知识汇总 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在现有私人面试网站中新增一个“模型架构解读”准备内容栏目，把两个 Excalidraw 画板中的分散知识整理成一套以图片为主、文字解释为辅的大模型知识体系，覆盖 Transformer、现代模型架构、训练与后训练、Agent 和 JEV 决策模型。

**Architecture:** 保留当前单页应用和现有四个页面的内容不变，在左侧导航中把“面试轮次”和“准备内容”分成两组，并新增 `architecture` 轮次。模型架构正文单独维护在 `content/model-architecture.html`，构建时通过 `scripts/merge-content.mjs` 注入 `public/index.html` 的模板；画板图片提取到 `public/assets/model-architecture/`，正文中的每个知识单元先展示原图或重绘图，再提供围绕图片的结构化解释。右侧主题导航继续从最终渲染后的标题生成，不复制正文。

**Tech Stack:** 现有 HTML/CSS/Vanilla JavaScript 单页应用、Node.js 构建脚本、内联 SVG、PNG 画板资源、现有 iPad 阅读样式和主题导航；不引入前端框架，不把外部模型信息写成未经核验的确定事实。

---

## 内容边界与设计原则

- 这是长期知识整理页，不是面试问答页；不添加“面试怎么讲”“可能追问什么”“30 秒回答”或薪资、话术等内容。
- 两个 Excalidraw 是第一来源：`新架构解读讲解.excalidraw` 负责 Transformer 和模型架构卡片，`视频画板.excalidraw` 负责组件、训练、后训练和 Agent 相关知识。
- 图片优先级高于文字：每个章节先呈现原图或清晰的 SVG 重绘图，正文只解释图中的关系、计算流和设计取舍；文字不能替代已经存在的核心图。
- 原图保留，重绘图用于补足看不清的关系和适配 iPad；两者都要有来源说明，避免把用户画板和外部资料混在一起。
- 外部资料分为“官方资料”“用户画板”“第三方说明”“待核实”，尤其是 DeepSeek V4 系列、Kimi K3、GLM-5 等新模型，不以搜索摘要作为唯一依据。
- JEV 放在 Agent 的决策层，而不是 Transformer 组件列表中。JEV 的公开资料目前指向 TypeSafe AI 的 System One 决策模型；没有公开权重时只整理产品机制和系统定位，不声称它是开源模型。

### 章节结构

1. **Transformer 架构解析**：Encoder、Decoder、Encoder-Decoder、输入输出、Self-Attention、Cross-Attention、Mask、FFN、残差、RMSNorm、RoPE。
2. **现代架构组件**：MHA/MQA/GQA、MLA、DSA、SWA、Gated DeltaNet、Gated Attention、SiLU、SwiGLU、MoE、Router、Top-K、共享专家、负载均衡、KV Cache、QK-Norm、YaRN、Partial RoPE。
3. **新模型与架构演进**：DeepSeek V3/R1/V4/V4 Flash/V4.1、Kimi K2/K3、Qwen3 系列、Step 3.5 Flash、MiniMax、GLM 等；统一记录相对前代的结构变化。
4. **训练与后训练**：Pre-training、SFT、LoRA、PPO、DPO、GRPO、Prompt/Loss Masking、数据格式、梯度累计、学习率调度和评测反馈。
5. **Agent 与决策模型**：基础模型到 Agent 的系统演进、工具调用和工作流控制，以及 JEV 的类型化决策、概率、置信度和级联路由。

### 每个知识单元的固定版式

```text
原图 / 重绘图
→ 图中元素说明
→ 数据流或计算流
→ 为什么出现这个机制
→ 它解决了什么问题
→ 代价与边界
→ 和其他机制的关系
→ 来源与核验状态
```

## Task 1: 提取并登记两个画板的图片资产

**Files:**
- Create: `scripts/extract-architecture-assets.mjs`
- Create: `public/assets/model-architecture/manifest.json`
- Create: `public/assets/model-architecture/source-new-architecture-01.png` through the required numbered files
- Create: `public/assets/model-architecture/source-video-board-01.png` through the required numbered files

**Step 1: Write the extraction script**

The script must read the two absolute source paths, decode each embedded `files[*].dataURL`, and write PNG files without changing the source `.excalidraw` files. It must sort image elements by `(source, y, x)`, emit a stable filename, and write a manifest containing `sourceFile`, `fileId`, original canvas position, width, height, output filename, and source label.

**Step 2: Run the extractor**

Run:

```bash
node scripts/extract-architecture-assets.mjs
```

Expected: the command reports 9 assets from `新架构解读讲解.excalidraw` and 14 assets from `视频画板.excalidraw`, and `manifest.json` contains 23 entries. The script must fail clearly if an image has no embedded `dataURL`.

**Step 3: Inspect image dimensions and names**

Run:

```bash
node -e "const m=require('./public/assets/model-architecture/manifest.json'); console.log(m.length, m.map(x=>x.output).join('\\n'))"
```

Expected: all entries point to files under `public/assets/model-architecture/`, with no duplicate filenames or missing files.

## Task 2: Create the maintainable architecture content fragment

**Files:**
- Create: `content/model-architecture.html`
- Create: `content/model-architecture-sources.html`

**Step 1: Add the page shell and knowledge map**

Create a root `<section id="architecture" class="architecture-page">` with a title, a short statement that this is a system knowledge map, and an inline SVG overview map connecting:

```text
Transformer → Decoder-only / GPT → modern attention and MoE → training/post-training → Agent / JEV
```

The map must link to stable anchors `#architecture-transformer`, `#architecture-components`, `#architecture-models`, `#architecture-training`, and `#architecture-agent`.

**Step 2: Add the Transformer chapter**

Use the extracted new-architecture assets first, then add structured explanations for Encoder, Decoder, Encoder-Decoder, input embedding, positional information, attention, FFN, residual and normalization. Add one complete data-flow SVG that shows tensor movement through a Transformer block. Do not include implementation code in the default view.

**Step 3: Add the component chapter**

Use the video-board assets as visual anchors. Add separate figure blocks for RoPE/YaRN, RMSNorm/residual, attention variants, FFN/SwiGLU and MoE. For each block, explain the before/after data flow and the trade-off in compute, memory, context length or routing stability. Use tables only when they clarify a relation between mechanisms.

**Step 4: Add the model evolution chapter**

Add a visual timeline and model cards for the requested DeepSeek, Kimi, Qwen, Step, MiniMax and GLM families. Each card must have the same fields: model/version, source status, base architecture, attention, MoE/Dense status, positional encoding, notable innovation, and linked source. Unknown fields must display `待核实` rather than being guessed.

**Step 5: Add training and post-training**

Create a full-width pipeline SVG with feedback from evaluation back to data, reward or training strategy. Explain Pre-training, SFT, LoRA, PPO, DPO and GRPO as related but different concepts. Include the board material about JSONL, special tokens, prompt masking, loss masking, gradient accumulation and learning-rate scheduling.

**Step 6: Add Agent and JEV**

Add an Agent evolution diagram from base model to tool use, workflow state, Agent loop and decision layer. Add a JEV section based on TypeSafe's public documentation, clearly separating vendor claims from general architectural interpretation. Link the official TypeSafe page and System One documentation in `model-architecture-sources.html`.

## Task 3: Add the architecture template to the existing build pipeline

**Files:**
- Modify: `public/index.html:103-114` for grouped sidebar navigation and `architectureSource` template
- Modify: `scripts/merge-content.mjs:20-60` to inject `content/model-architecture.html`

**Step 1: Add grouped navigation**

Replace the current flat five-button navigation with two labeled groups:

```html
<div class="nav-group">
  <div class="side-title">面试轮次</div>
  <button data-round="technical">01 业务面</button>
  <button data-round="supervisor">02 主管面</button>
  <button data-round="hr">03 HR 面</button>
</div>
<div class="nav-group">
  <div class="side-title">准备内容</div>
  <button data-round="fundamentals">01 八股题库</button>
  <button data-round="handwriting">02 手撕</button>
  <button data-round="architecture">03 模型架构解读</button>
</div>
```

Keep the existing `data-round` selectors so topic-navigation and route handling can continue to query all buttons.

**Step 2: Add the canonical architecture template marker**

Add `<!-- ARCHITECTURE_SOURCE_START -->` and `<!-- ARCHITECTURE_SOURCE_END -->` around the architecture fragment, outside the existing project and supervisor markers. The source must be a template, not duplicated in the rendered `app` body.

**Step 3: Update the merge script**

Read `content/model-architecture.html`, validate that it starts with `<section id="architecture"` and ends with `</section>`, then replace the architecture marker block. Keep the existing school-project and supervisor merge behavior unchanged.

Run:

```bash
npm run build
```

Expected: the build reports that the school, supervisor and architecture fragments were embedded, and only the architecture marker region changes for this feature.

## Task 4: Wire the new `architecture` route and topic hierarchy

**Files:**
- Modify: `public/index.html:1314-1417`
- Modify: `public/topic-navigation.js:55-76`

**Step 1: Add route metadata**

Extend the current round title, description and map selection with `architecture`. The title should be `模型架构解读`, and the description should describe a system knowledge map rather than interview preparation.

**Step 2: Render the source fragment**

Add:

```js
if (current === 'architecture') {
  html += source('#architectureSource', '大模型架构与训练知识汇总');
}
```

Add `architecture` to the valid URL round list and preserve `?round=architecture#...` on refresh.

**Step 3: Add topic levels**

Teach `topicLevel()` to recognize `.architecture-page > h2`, `.architecture-section > h3`, `.architecture-subsection > h4`, and the model/algorithm cards as nested topics. The right rail should expose the five architecture chapters and their subsections, but must not create a directory item for every paragraph.

**Step 4: Add architecture-specific hero metadata**

Add a `body[data-round="architecture"]` label in `public/reading-design.css` and update the footer copy so the page no longer describes every section as an interview round.

## Task 5: Style the image-first knowledge page and grouped sidebar

**Files:**
- Create: `public/model-architecture.css`
- Modify: `public/index.html:90-94` to load the stylesheet
- Modify: `public/reading-design.css:435-495` and responsive blocks around `785-901`

**Step 1: Add image-first chapter styles**

Implement these layout primitives:

- `.architecture-overview`: full-width map with bounded height and horizontal scrolling on narrow screens.
- `.architecture-figure`: bordered figure with an image-first header and caption.
- `.architecture-figure img`: `display:block`, `width:100%`, `object-fit:contain`, `loading="lazy"`.
- `.architecture-explain-grid`: two-column explanation for diagrams that need a text companion.
- `.architecture-model-grid`: consistent model cards.
- `.architecture-compare-table`: horizontal scroll container for wide comparisons.
- `.architecture-source-note`: source and verification status styling.

**Step 2: Add iPad 9 behavior**

In `body.ipad-reading`, keep the architecture page readable in portrait and landscape: text cards become one column in portrait, diagrams keep their minimum readable width inside a local horizontal scroller, and no page-level horizontal overflow is introduced. Touch targets must remain at least 44px high.

**Step 3: Style navigation groups**

Give the two sidebar groups distinct labels and spacing while preserving the existing active-state appearance. On compact screens, keep both group labels and allow the six buttons to wrap cleanly; on iPad portrait, avoid hiding the architecture entry.

## Task 6: Add source status and content validation

**Files:**
- Create: `scripts/validate-model-architecture.mjs`
- Modify: `package.json` to add `check:architecture`

**Step 1: Validate required sections and figures**

The validator must read `content/model-architecture.html` and assert the presence of the five section IDs, at least one `<figure>` per section, the JEV section, and the source marker. It must also verify every image path in the fragment exists under `public/`.

**Step 2: Validate source labels**

Require each model card and each external algorithm source block to include one of `官方资料`, `用户画板`, `第三方说明`, or `待核实`. Fail with the missing heading or asset path.

**Step 3: Add the command**

Add:

```json
"check:architecture": "node scripts/validate-model-architecture.mjs"
```

Run:

```bash
npm run check:architecture
```

Expected: `Architecture content validation passed`.

## Task 7: Verify build, route behavior and visual reading modes

**Files:**
- Test: `public/index.html`, `public/topic-navigation.js`, `public/model-architecture.css`, generated assets

**Step 1: Run static checks**

Run:

```bash
npm run check
npm run check:architecture
npm run build
```

Expected: all commands exit with code 0, and the build does not remove the existing project, HR, supervisor or handwriting sources.

**Step 2: Run a local static server**

Run:

```bash
python3 -m http.server 4173 --directory public
```

Open `http://127.0.0.1:4173/?round=architecture#architecture-transformer` and verify that the correct section is visible after a refresh.

**Step 3: Verify navigation**

Check that:

- the three interview-round buttons still render the same content;
- the three preparation buttons switch to fundamentals, handwriting and architecture;
- the right topic rail lists the five architecture chapters;
- clicking a figure chapter updates the hash and scrolls below the sticky header;
- browser Back/Forward preserves `round` and hash;
- no interview-only labels appear on the architecture page.

**Step 4: Verify responsive reading**

Check at desktop, iPad 9 portrait-sized viewport, iPad 9 landscape-sized viewport, and a narrow mobile viewport. Confirm that diagrams scroll inside their own containers, text remains legible, and `document.documentElement.scrollWidth === document.documentElement.clientWidth` except for intentional local figure scrollers.

**Step 5: Inspect representative source hierarchy**

Verify manually that the page order is image → explanation → related concepts → source status, and that original board images appear before the explanatory prose in Transformer, MoE, PPO/DPO/GRPO and JEV sections.

## Task 8: Commit the implementation as reviewable slices

**Files:**
- Commit the extracted assets and script separately from the content and UI changes.

**Step 1: Commit assets**

```bash
git add scripts/extract-architecture-assets.mjs public/assets/model-architecture
git commit -m "feat: add model architecture source assets"
```

**Step 2: Commit knowledge content**

```bash
git add content/model-architecture.html content/model-architecture-sources.html scripts/validate-model-architecture.mjs package.json
git commit -m "docs: organize model architecture knowledge"
```

**Step 3: Commit UI integration**

```bash
git add public/index.html public/model-architecture.css public/reading-design.css public/topic-navigation.js scripts/merge-content.mjs
git commit -m "feat: add model architecture knowledge section"
```

Do not stage unrelated existing files such as the previously generated HR, school-project or Voyager artifacts.

## Completion criteria

- The left navigation visibly separates interview rounds from preparation content.
- “模型架构解读” is a first-class preparation section and survives direct URL refresh.
- The two Excalidraw boards are represented as image-first chapters, with extracted images and source labels.
- Transformer, modern components, new models, training/post-training, Agent and JEV are connected by a readable knowledge map.
- The page contains no interview-specific response scripts or question prompts.
- New model claims are traceable to an official or explicitly labeled secondary source.
- Desktop and iPad 9 reading modes preserve image clarity, local scrolling and topic navigation.
- `npm run check`, `npm run check:architecture` and `npm run build` pass before deployment.
