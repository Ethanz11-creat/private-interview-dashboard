# Personal Interview Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把现有两份面试 HTML 重构成一个可持续使用的个人求职面试网站：按“业务面／主管面／HR 面”进入，以思维导图式层级引导复习，按面试邀约贴入 JD 和现场记录，并支持网页内编辑、本地保存、导入导出和私密部署。

**Architecture:** 使用无构建步骤的 Vanilla HTML/CSS/JavaScript 静态应用。页面壳、内容数据和渲染逻辑分离；固定面试轮次模板作为复用内容，某一场面试邀约只保存公司/JD/轮次/便利贴/复盘等实例数据。主项目的完整资料继续作为同源 HTML 内容资产，同时在轮次导图中提供上下文入口，避免复制事实导致版本不一致。浏览器 `localStorage` 保存用户编辑，Cloudflare Worker 在静态资源前执行 Basic Auth。

**Tech Stack:** HTML5、CSS（白底、左右分栏、响应式）、原生 JavaScript（无框架）、`localStorage` + JSON 备份、Cloudflare Workers Static Assets、GitHub 私有仓库、Playwright 浏览器验收测试。

---

### Task 1: 建立可维护的静态应用骨架

**Files:**
- Create: `public/styles.css`
- Create: `public/content.js`
- Create: `public/app.js`
- Create: `package.json`
- Create: `playwright.config.js`
- Modify: `public/index.html`
- Test: `tests/smoke.spec.js`

**Step 1: Write the failing browser smoke test**

在 `tests/smoke.spec.js` 写最小验收：打开首页后必须看到站点标题、三个轮次入口和“新建面试邀约”按钮。先创建 `package.json`，把 `@playwright/test` 作为开发依赖，并将 `npm test` 定义为 `playwright test`；`playwright.config.js` 启动本地静态服务器（例如 `npx http-server public -p 4173`）并设置 `baseURL`。

```js
import { test, expect } from '@playwright/test';

test('dashboard shell exposes the three interview rounds', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '求职面试准备' })).toBeVisible();
  await expect(page.getByRole('button', { name: '业务面' })).toBeVisible();
  await expect(page.getByRole('button', { name: '主管面' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'HR 面' })).toBeVisible();
  await expect(page.getByRole('button', { name: /新建面试邀约/ })).toBeVisible();
});
```

**Step 2: Run it to verify it fails**

Run: `npm test -- --grep "dashboard shell"`

Expected: FAIL because the current page is not wired as the new app shell and no test runner exists yet.

**Step 3: Implement the shell**

将 `index.html` 改为语义化壳：顶部标题与当前邀约信息，左侧轮次/邀约导航，中央导图内容区，右侧详情/便利贴区；通过 `<link rel="stylesheet" href="styles.css">` 和经典 `defer` 脚本加载 `content.js`、`app.js`，避免 ES module 在 `file://` 下无法读取。将原来内联 CSS/JS 移出，不再让页面数据和渲染逻辑混在一行。

定义最小状态接口：

```js
const state = {
  activeView: 'business',
  activeInviteId: null,
  expanded: {},
  invites: []
};
```

**Step 4: Run the test to verify it passes**

Run: `npm test -- --grep "dashboard shell"`

Expected: PASS; 页面在桌面和窄屏均能加载，无控制台异常。

**Step 5: Commit**

```bash
git add public/index.html public/styles.css public/content.js public/app.js tests/smoke.spec.js package.json playwright.config.js
git commit -m "feat: create interview dashboard shell"
```

### Task 2: 抽取并登记现有面试内容资产

**Files:**
- Modify: `public/content.js`
- Preserve/Modify: `public/二面/联想主管面思维导图.html`
- Preserve/Modify: `public/二面/业务信息查询Agent-项目追问导图.html`
- Create: `public/library/index.html`
- Test: `tests/content.spec.js`

**Step 1: Write the failing content test**

测试固定内容必须登记三个轮次、主项目和两个完整 HTML 资源 URL，并且不能把 Markdown 原文塞进 `<pre>` 作为伪渲染。

```js
test('content registry has reusable rounds and project assets', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-round="business"]')).toBeVisible();
  await page.getByRole('button', { name: '主管面' }).click();
  await expect(page.getByText('主项目：业务信息查询 Agent')).toBeVisible();
  await expect(page.locator('a[href*="业务信息查询Agent-项目追问导图.html"]')).toHaveCount(1);
});
```

**Step 2: Run it to verify it fails**

Run: `npm test -- tests/content.spec.js`

Expected: FAIL because the current prototype only has abbreviated strings and no content registry.

**Step 3: Implement the content registry**

在 `content.js` 建立 `window.INTERVIEW_CONTENT`，每个节点至少包含：`id`、`title`、`summary`、`detail`、`sourceUrl`、`defaultOpen`、`moduleKey`。迁移现有主管面页面中的中文/英文介绍、主项目追问、个人复盘、反问和对外输出摘要；迁移业务信息查询 Agent 页面中三个项目的导航和原文入口。不要重新改写用户要求“一个字不差”的项目原文；完整内容继续由现有渲染版 HTML 提供，新增的摘要只作为导图提示。为两个 HTML 资源加稳定的相对链接和“打开完整资料”入口。

**Step 4: Run the test to verify it passes**

Run: `npm test -- tests/content.spec.js`

Expected: PASS; 三轮内容可切换，主项目链接在同源路径可打开，原文页没有出现未渲染 Markdown。

**Step 5: Commit**

```bash
git add public/content.js public/library/index.html public/二面 tests/content.spec.js
git commit -m "feat: register reusable interview content"
```

### Task 3: 实现三种面试轮次的导图式阅读体验

**Files:**
- Modify: `public/content.js`
- Modify: `public/app.js`
- Modify: `public/styles.css`
- Test: `tests/rounds.spec.js`

**Step 1: Write the failing interaction tests**

覆盖三个轮次、从上到下的主线、提纲/话术折叠和“展开全部/收起全部”。

```js
test('rounds keep the outline visible and expand details in place', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '业务面' }).click();
  await expect(page.getByRole('heading', { name: '面试思维导图' })).toBeVisible();
  await expect(page.locator('details')).not.toHaveAttribute('open', '');
  await page.getByRole('button', { name: '展开全部话术' }).click();
  await expect(page.locator('details[open]')).not.toHaveCount(0);
  await page.getByRole('button', { name: '收起全部话术' }).click();
  await expect(page.locator('details[open]')).toHaveCount(0);
});
```

**Step 2: Run it to verify it fails**

Run: `npm test -- tests/rounds.spec.js`

Expected: FAIL because the current page renders one hard-coded list and does not keep active round state consistently.

**Step 3: Implement round rendering**

用同一个 `renderRound(roundKey)` 渲染业务面、主管面、HR 面；每个节点显示编号、标题和一行提纲，完整回答在原位置的 `<details>` 中展开，不跳转新页面。点击主项目节点时，在同一页面的详情阅读区加载对应的同源 HTML（`iframe` 或受控的 `fetch` 阅读器），同时保留“新窗口打开完整资料”备用链接，不能退化为只有一个外链。默认显示完整的导图骨架；话术默认收起。左侧保留轮次导航，右侧显示当前节点详情。提供“展开全部话术”“收起全部话术”“回到本轮顶部”，并把展开状态写入内存而不是 URL，避免刷新后 URL 被污染。

英文介绍/英文总结、全球化业务理解、公司团队资料作为可挂载模块，通过“显示模块”设置控制是否进入当前视图；默认不占主线，界面只提供显示开关，不在正文里反复标注或提醒。隐藏模块不删除数据。模块显示状态既可以有全局默认值，也可以被单个面试邀约覆盖。

**Step 4: Run the test to verify it passes**

Run: `npm test -- tests/rounds.spec.js`

Expected: PASS; 三种轮次结构清晰一致，用户无需层层点击即可看到整条准备路径。

**Step 5: Commit**

```bash
git add public/content.js public/app.js public/styles.css tests/rounds.spec.js
git commit -m "feat: add interview round mindmap views"
```

### Task 4: 建立“面试邀约”工作区与便利贴

**Files:**
- Modify: `public/app.js`
- Modify: `public/content.js`
- Modify: `public/styles.css`
- Test: `tests/invitations.spec.js`

**Step 1: Write the failing invitation test**

测试只有收到邀约才新增记录；一个邀约可以包含多个轮次，而不是当前原型里一个邀约只能绑定一个轮次。

```js
test('an invitation owns multiple rounds and editable sticky notes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /新建面试邀约/ }).click();
  await page.getByLabel('公司').fill('联想');
  await page.getByLabel('岗位').fill('AI 知识管理工程师');
  await page.getByLabel('JD').fill('服务 AI 与知识管理');
  await page.getByRole('button', { name: '保存邀约' }).click();
  await expect(page.getByText('联想｜AI 知识管理工程师')).toBeVisible();
  await expect(page.getByRole('tab', { name: '业务面' })).toBeVisible();
  await expect(page.getByRole('tab', { name: '主管面' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'HR 面' })).toBeVisible();
});
```

**Step 2: Run it to verify it fails**

Run: `npm test -- tests/invitations.spec.js`

Expected: FAIL because当前弹窗只有单个轮次和一个合并文本框，没有可编辑邀约页面。

**Step 3: Implement the invitation model and editor**

使用以下稳定数据模型，不把完整固定话术复制进每场邀约：

```js
{
  id: 'invite-<timestamp>', company: '', role: '', jd: '',
  interviewer: '', scheduledAt: '', status: '待准备', notes: '',
  visibleModules: {},
  rounds: {
    business: { status: '待准备', focus: '', actualQuestions: '', answer: '', feedback: '', nextActions: '' },
    supervisor: { status: '待准备', focus: '', actualQuestions: '', answer: '', feedback: '', nextActions: '' },
    hr: { status: '待准备', focus: '', actualQuestions: '', answer: '', feedback: '', nextActions: '' }
  }
}
```

新建表单收集公司、岗位、JD、面试官、时间和便利贴；保存后进入该邀约工作区，顶部展示便利贴，下方以三个轮次标签切换固定导图与本场字段。支持编辑、删除邀约，删除必须二次确认。面试状态使用固定选项：待准备、已准备、已完成、通过、未通过。

**Step 4: Run the test to verify it passes**

Run: `npm test -- tests/invitations.spec.js`

Expected: PASS;一个邀约下可切换三种轮次，JD 与临时提醒保留在本场，不污染通用模板。

**Step 5: Commit**

```bash
git add public/app.js public/content.js public/styles.css tests/invitations.spec.js
git commit -m "feat: add interview invitation workspace"
```

### Task 5: 加入面试后复盘与固定内容编辑

**Files:**
- Modify: `public/app.js`
- Modify: `public/styles.css`
- Test: `tests/review.spec.js`

**Step 1: Write the failing review test**

```js
test('round review fields persist after reload', async ({ page }) => {
  await page.goto('/');
  await page.getByText('联想｜AI 知识管理工程师').click();
  await page.getByRole('tab', { name: '主管面' }).click();
  await page.getByLabel('实际问题').fill('为什么不用更强模型？');
  await page.getByLabel('下次改进').fill('补充权限、时效和证据链取舍');
  await page.getByRole('button', { name: '保存复盘' }).click();
  await page.reload();
  await page.getByText('联想｜AI 知识管理工程师').click();
  await page.getByRole('tab', { name: '主管面' }).click();
  await expect(page.getByLabel('下次改进')).toHaveValue('补充权限、时效和证据链取舍');
});
```

**Step 2: Run it to verify it fails**

Run: `npm test -- tests/review.spec.js`

Expected: FAIL because当前没有按轮次保存真实问题、回答和改进动作。

**Step 3: Implement review and content editing**

在每个邀约轮次的导图下添加复盘区：实际问题、我的回答、面试官反馈、下次行动。提供“保存复盘”按钮，保存后显示最近更新时间。允许编辑本场便利贴和复盘文本；固定模板内容仍由 `content.js` 管理，避免把单场复盘误写入通用话术。对可编辑字段使用 `input`/`textarea` 的 `aria-label`，保存前 trim，空内容允许保存以支持清空。

**Step 4: Run the test to verify it passes**

Run: `npm test -- tests/review.spec.js`

Expected: PASS;刷新后邀约与复盘字段仍在，保存动作不会改变固定模板。

**Step 5: Commit**

```bash
git add public/app.js public/styles.css tests/review.spec.js
git commit -m "feat: add interview review workflow"
```

### Task 6: 实现本地持久化、导入导出与数据校验

**Files:**
- Modify: `public/app.js`
- Create: `public/storage.js`
- Modify: `public/index.html`
- Test: `tests/storage.spec.js`

**Step 1: Write the failing persistence tests**

覆盖自动保存、JSON 导出、非法导入拒绝和旧版本迁移。

```js
test('invite data survives reload and exports a versioned backup', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /新建面试邀约/ }).click();
  await page.getByLabel('公司').fill('测试公司');
  await page.getByLabel('岗位').fill('测试岗位');
  await page.getByRole('button', { name: '保存邀约' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出备份' }).click();
  const file = await downloadPromise;
  expect(file.suggestedFilename()).toBe('求职面试备份.json');
  await page.reload();
  await expect(page.getByText('测试公司｜测试岗位')).toBeVisible();
});
```

**Step 2: Run it to verify it fails**

Run: `npm test -- tests/storage.spec.js`

Expected: FAIL because当前使用的 localStorage 结构没有版本号、校验和可恢复错误提示。

**Step 3: Implement versioned storage**

统一使用 `job-interview-dashboard-v2`，保存格式为 `{ schemaVersion: 2, savedAt, invites }`。`storage.js` 提供 `loadState`、`saveState`、`exportState`、`validateImport`、`migrateState`。导入前检查 JSON、版本号、`invites` 数组和每个邀约必要字段；失败时只提示错误，不覆盖现有数据。导出使用 Blob 下载；导入完成后重新渲染当前视图。页面首次加载显示“本数据保存在当前浏览器”一次性提示，并提供“清空本机数据”按钮和二次确认。

**Step 4: Run the test to verify it passes**

Run: `npm test -- tests/storage.spec.js`

Expected: PASS;刷新、导出、导入和错误恢复均可验证，旧版原型数据可迁移或明确提示需要重新导入。

**Step 5: Commit**

```bash
git add public/app.js public/index.html public/storage.js tests/storage.spec.js
git commit -m "feat: add versioned local storage and backups"
```

### Task 7: 完成私密部署与访问保护

**Files:**
- Modify: `worker.js`
- Modify: `wrangler.jsonc`
- Modify: `README.md`
- Create: `.github/workflows/deploy.yml`
- Test: `tests/deployment.spec.js`

**Step 1: Write the failing deployment checks**

部署检查必须验证：未认证请求返回 `401`；正确 Basic Auth 才能取得首页；静态 HTML 不被公开缓存、不被搜索引擎索引。

```js
test('deployment requires basic authentication', async ({ request }) => {
  const denied = await request.get(process.env.SITE_URL);
  expect(denied.status()).toBe(401);
  const allowed = await request.get(process.env.SITE_URL, {
    headers: { Authorization: `Basic ${Buffer.from('yiheng:11').toString('base64')}` }
  });
  expect(allowed.status()).toBe(200);
  expect(allowed.headers()['x-robots-tag']).toContain('noindex');
  expect(allowed.headers()['cache-control']).toContain('private');
});
```

**Step 2: Run it to verify it fails against the current deployment**

Run: `SITE_URL=https://private-interview-dashboard.ethanz11-private.workers.dev npm test -- tests/deployment.spec.js`

Expected: 当前部署若仍超时或未正确返回认证响应则 FAIL；先记录实际状态，不把部署“成功上传”当成可访问性证明。

**Step 3: Implement and document deployment**

让 Worker 对 `/`、`/二面/*` 及所有静态资源统一执行 Basic Auth；使用 `crypto.subtle` 或明确的 header 比对，避免把密码写进仓库。保留 `SITE_PASSWORD` secret，通过 `wrangler secret put SITE_PASSWORD` 设置。为 GitHub Actions 添加 Cloudflare 部署工作流，凭据使用 GitHub Secrets，不把 token 或密码提交到仓库。README 写清：GitHub 仓库为 Private；网站也有独立认证；面试邀约数据仍在浏览器 localStorage，换设备前必须导出备份。

**Step 4: Run the test to verify it passes**

Run:

```bash
wrangler secret put SITE_PASSWORD
wrangler deploy
SITE_URL=https://private-interview-dashboard.ethanz11-private.workers.dev npm test -- tests/deployment.spec.js
```

Expected: 未认证 `401`，认证后 `200`，首页和两个项目页都能打开；浏览器实际弹出登录框并能进入导图。

**Step 5: Commit**

```bash
git add worker.js wrangler.jsonc README.md .github/workflows/deploy.yml tests/deployment.spec.js
git commit -m "chore: secure and automate private deployment"
```

### Task 8: 全量验收、内容一致性和交付检查

**Files:**
- Modify: `README.md`
- Test: `tests/*.spec.js`

**Step 1: Run static and browser checks**

```bash
node --check public/app.js
node --check public/storage.js
npm test
wrangler dev
```

Expected: 无 JavaScript 语法错误；测试覆盖首页、三轮导图、邀约、复盘、备份和认证。

**Step 2: Manually verify the actual user path**

按以下路径检查：打开网站 → 登录 → 进入业务面 → 查看主项目导图 → 新建一场邀约 → 填 JD/便利贴 → 切主管面 → 隐藏英文模块 → 填实际问题与复盘 → 刷新 → 导出备份 → 用备份导入恢复。

**Step 3: Check content boundaries**

核对：

- 主项目事实、数字和个人贡献边界没有被模板重写；
- 完整项目 HTML 仍可独立打开，且不是 raw Markdown；
- 英文/全球化/联想团队模块可隐藏但数据仍保留；
- 本场 JD 和复盘不会写回固定模板；
- 删除邀约前有明确确认；
- 移动端没有横向溢出，长话术不会遮挡导航。

**Step 4: Commit final verification**

```bash
git add README.md
git commit -m "docs: document dashboard usage and verification"
```

**Step 5: Final handoff**

输出本地文件路径、GitHub 私有仓库链接、需要登录的站点 URL、浏览器本地数据边界、导入导出方法和已执行的验证命令；明确说明没有服务端同步，避免用户误以为换设备后数据自动出现。
