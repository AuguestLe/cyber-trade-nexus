# NEXUS CONTINUE / 交接笔记

> 目的：任何新会话读这份文件即可无缝接管本项目，避免依赖上一篇会话的上下文。
> 最后更新：2026-11-12（补齐 README 与各 tab 整页截图；顺带清零 lint error）。

## 1. 项目一句话

`cyber-trade-nexus` — React 18 + TS(strict) + Vite + Zustand + ECharts 的赛博 HUD 全球交易态势大屏（演示系统），Node Express 轻量 Mock 后端 + SSE 实时流。文档齐全（`docs/01~08*.md` + `docs/PRD.md`）。

## 2. 当前完成度

- 全量需求 **I-01 ~ I-42** 已落地（见 `docs/PRD.md` 需求矩阵）。
- 6 页面：登录 / 大屏 `/` / 地图 `/map` / 交易明细 `/trades` / 控制台 `/admin` / 403。
- 单测 **150/150 通过**，`tsc --noEmit`、`npm run build`、`eslint`（0 error）全绿。
- 设计评审 `docs/design/review.md` R-01~R-12 已实现闭环。

## 3. 验收命令

```bash
npx vitest run          # 单测（150 全绿）
npx tsc --noEmit        # 类型检查
npm run build           # 生产构建（tsc+vite）
npm run dev:server      # 后端 Mock 服务（另开终端）
npm run dev:web         # Vite 前端
```

## 4. 最近一次改动（首页动画收敛）

未提交，`git status` 主要变动：

| 文件 | 改动 |
|---|---|
| `src/charts/EChart.tsx` | 仅挂载后第一次 `setOption` 入场动画；轮询/流式更新静默落值。`ResizeObserver` 尺寸未变时跳过 `chart.resize()`（否则会中断入场动画） |
| `src/charts/animation.ts` | 新增纯函数 `withUpdateMotion(option, animate)`，更新帧覆盖 `animation:false` 且不改原 option |
| `src/hooks/useCountUp.ts` | 仅在挂载（首屏 / tab 切回）时 0→目标值滚动一次；数据更新直接落值；抽出纯函数 `countUpValue` |
| `src/pages/dashboard/MiniWorldMap.tsx` | 删除「按成交额增长重播」脉冲；弧线/节点环只随页面挂载播一次 |
| `src/styles/dashboard.module.css` | 节点环 3 次→1 次、缩短 stagger；删除 `tapeRowNew` 行入场动画 |
| `src/pages/dashboard/AssetPanel.tsx` | 过滤结果移入 `useMemo`，避免父级每次渲染重建 option 打断入场动画 |
| `src/hooks/useAnimationPulse.ts` + 测试 | 删除（旧方案会在数据增长时反复重播） |

动画策略一句话：**所有首页动效只跟「页面挂载」走**。首屏加载与顶部 tab 切回都会重新挂载页面，因此各自播放一次；SSE / 2s 轮询只更新数值与图形，不再触发动画。

## 4.1 本轮追加（README + 截图）

| 文件 | 改动 |
|---|---|
| `README.md` | 重写为完整项目说明：界面预览（6 张整页图 + 3 张交互补充）、功能总览、快速开始、演示账号、技术栈、架构、目录、接口表、关键设计（视觉/动效/权限/自适应）、测试与验证、文档索引、已知限制、安全声明 |
| `docs/screenshots/readme/*.jpg` | 9 张 1600×900 截图：登录、态势总览、全球地图、交易明细、控制台、403、交易抽屉、琥珀主题控制台、地图热力 |
| `scripts/readme-shots.mjs` | 新增，一键重生成上述截图（前置 `npm run dev`） |
| `src/pages/LoginPage.tsx` | 页脚 `SCREEN 1920×1080` → `FLUID VIEWPORT`（与流式布局一致） |
| `eslint.config.js` | `scripts/**/*.mjs` 补 browser globals；`server/**` 补 `@typescript-eslint/no-unused-vars` 忽略规则 |
| `server/app.js`、`server/routes/admin.js`、`scripts/gen-world-outline.mjs`、`src/pages/TradeMapPage.tsx` | 清理无效 eslint-disable、未使用导入、控制字符正则、`useMemo` 依赖告警 |

当前质量门：`npm run lint` **0 error / 0 warning**，`npm test` **150/150**，`npm run typecheck` 0 error，`npm run build` 通过。

## 5. 已验证项（E2E，through Vite 5173）

- 首页稳定后 `document.getAnimations()` 无 running 的 CSS 动画；连续 220ms 截图的图表区域像素差为 0。
- 首屏与 tab 切回（`/map` → `/`）时，ECharts canvas 在约 1s 内逐帧变化（入场动画），KPI 数字从 0 滚动到目标值。
- 稳定后 750ms 内各图表 canvas DataURL 完全一致（无持续重绘动画）。
- 交易明细页：行点击 → 详情抽屉打开 ✅
- 「在地图定位」：跳转 `/map` ✅ → 抽屉重新打开 ✅ → `?trade=` 参数正确清除（不悬挂）✅
- `SELECTED 00` 为预期降级路径：若该交易的弧线不在当前地图 top-N 弧线/筛选内，退化为聚焦卖家节点 + toast，不强行误定位。弧线高亮命中路径由 `findArcForTrade` 单测覆盖。
- 注：地图 `SELECTED 01` 命中依赖该交易弧线出现在地图当前窗口的 top-80 聚合弧线中（数据驱动，无法对任意交易保证）；已验证降级路径与纯函数命中两分支。

## 6. 已知注意点 / 技术决策

- 深链竞态：`?trade=` 首次进入时底图 `geo` 是异步加载的，适配器尚未 mount，故用 `pendingDeepRef` 暂存目标，等 `setNodes` 效应触发时消费。
- 地图弧线按 `fromNodeId|toNodeId|assetClass` 三元组聚合，定位交易需用同一键。
- 交易所在弧线可能不在当前筛选/时间窗内：此时退化为聚焦卖家节点 + toast 提示，不强行开抽屉定位失败。
- 动画边界：ECharts 只在图表实例创建后的第一次 `setOption` 开头动画；之后所有更新都带 `animation:false`。`ResizeObserver` 首次回调必须跳过无尺寸变化的 `chart.resize()`，否则 ECharts 会立即跳到末帧，表现为「没有入场动画」。
- 禁止再从数据变化里触发动画：旧的 `useAnimationPulse`（成交额增长>15% 重播）已删除。需要重播入场动画时，靠路由重挂载页面，不要在 store 里加脉冲。
- 共享层契约（`src/api/*`、`src/store/*`、`src/App.tsx`、全局样式）有边界，改需求先用现有 API 适配，勿改契约。
- 全部金额统一 USD（设计评审 R-02/R-09），节点用真实经纬度，权限动作按角色显隐。

## 7. 建议下一步（未做）

- `scripts/.tmp/` 临时脚本已清理；如需动画回归，可把本轮验证逻辑整理为 `scripts/verify-animations.mjs` 并纳入版本控制。
- README 截图会随 UI 变化过期，改版后请重跑 `node scripts/readme-shots.mjs`。
- `docs/07-测试计划与用例.md` 若标注了未执行的用例，可补齐。
- 若你有更多打磨需求，按需求矩阵在对应页面/组件内扩展即可。

## 8. 会话状态

- 当前文件策略：workspace-write；审批策略：ask。
- 工作目录：`/Users/le/Desktop/project`，项目根 `/Users/le/Desktop/project/cyber-trade-nexus`。