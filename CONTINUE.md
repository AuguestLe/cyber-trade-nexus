# NEXUS CONTINUE / 交接笔记

> 目的：任何新会话读这份文件即可无缝接管本项目，避免依赖上一篇会话的上下文。
> 最后更新：2026-11-12（交易明细页 + 地图深链定位）。

## 1. 项目一句话

`cyber-trade-nexus` — React 18 + TS(strict) + Vite + Zustand + ECharts 的赛博 HUD 全球交易态势大屏（演示系统），Node Express 轻量 Mock 后端 + SSE 实时流。文档齐全（`docs/01~08*.md` + `docs/PRD.md`）。

## 2. 当前完成度

- 全量需求 **I-01 ~ I-42** 已落地（见 `docs/PRD.md` 需求矩阵）。
- 6 页面：登录 / 大屏 `/` / 地图 `/map` / 交易明细 `/trades` / 控制台 `/admin` / 403。
- 单测 **143/143 通过**，`tsc --noEmit`、`npm run build`、`eslint`（0 error）全绿。
- 设计评审 `docs/design/review.md` R-01~R-12 已实现闭环。

## 3. 验收命令

```bash
npx vitest run          # 单测（143 全绿）
npx tsc --noEmit        # 类型检查
npm run build           # 生产构建（tsc+vite）
npm run dev:server      # 后端 Mock 服务（另开终端）
npm run dev:web         # Vite 前端
```

## 4. 最近一次改动（本笔记生成所在会话）

未提交，`git status` 有 3 个文件：

| 文件 | 改动 |
|---|---|
| `src/lib/arc.ts` | 新增 `findArcForTrade(trade, arcs)` 纯函数，按 `from|to|assetClass` 三元组定位交易所在弧线 |
| `src/lib/__tests__/arc.test.ts` | 为上述函数补 4 条单测（命中/异类/无匹配/空列表） |
| `src/pages/TradeMapPage.tsx` | 消费深链 `?trade=<id>`（来自交易明细抽屉「在地图定位」）：找到交易→高亮所在弧线→聚焦卖家节点→打开交易抽屉→清除参数。含防底图异步挂载竞态的 `pendingDeepRef` 机制 |
| `scripts/e2e-deeplink.mjs` | 端到端验证脚本（登录 admin → 明细页点行 → 抽屉 → 在地图定位 → 断言 `/map` 导航/抽屉恢复/参数清除） |

## 5. 已验证项（E2E，through Vite 5173）

- 交易明细页：行点击 → 详情抽屉打开 ✅
- 「在地图定位」：跳转 `/map` ✅ → 抽屉重新打开 ✅ → `?trade=` 参数正确清除（不悬挂）✅
- `SELECTED 00` 为预期降级路径：若该交易的弧线不在当前地图 top-N 弧线/筛选内，退化为聚焦卖家节点 + toast，不强行误定位。弧线高亮命中路径由 `findArcForTrade` 单测覆盖。
- 注：地图 `SELECTED 01` 命中依赖该交易弧线出现在地图当前窗口的 top-80 聚合弧线中（数据驱动，无法对任意交易保证）；已验证降级路径与纯函数命中两分支。

## 6. 已知注意点 / 技术决策

- 深链竞态：`?trade=` 首次进入时底图 `geo` 是异步加载的，适配器尚未 mount，故用 `pendingDeepRef` 暂存目标，等 `setNodes` 效应触发时消费。
- 地图弧线按 `fromNodeId|toNodeId|assetClass` 三元组聚合，定位交易需用同一键。
- 交易所在弧线可能不在当前筛选/时间窗内：此时退化为聚焦卖家节点 + toast 提示，不强行开抽屉定位失败。
- 共享层契约（`src/api/*`、`src/store/*`、`src/App.tsx`、全局样式）有边界，改需求先用现有 API 适配，勿改契约。
- 全部金额统一 USD（设计评审 R-02/R-09），节点用真实经纬度，权限动作按角色显隐。

## 7. 建议下一步（未做）

- 深链定位的浏览器端到端验证（`scripts/screenshot.mjs` / `verify-interactions.mjs` 体系可复用）。
- `docs/07-测试计划与用例.md` 若标注了未执行的用例，可补齐。
- 若你有更多打磨需求，按需求矩阵在对应页面/组件内扩展即可。

## 8. 会话状态

- 当前文件策略：workspace-write；审批策略：ask。
- 工作目录：`/Users/le/Desktop/project`，项目根 `/Users/le/Desktop/project/cyber-trade-nexus`。