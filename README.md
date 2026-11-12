# NEXUS · 全球交易态势大屏

> **DEMO / 模拟数据**：本项目是面向展厅、汇报与演示场景的数据可视化产品，不含真实行情、真实下单、真实清算与真实用户体系。所有金额、节点、告警均为本地 Mock 服务生成的模拟数据。

NEXUS 以赛博 HUD 视觉呈现全球交易态势：登录与角色权限、首页大屏（D-01~D-10）、独立全球交易地图（M-01~M-12）、交易明细、管理员控制台。前端 React 18 + TypeScript + Vite，数据由 Node.js 轻量 Mock 服务提供，已做 KPI / 时序 / 占比 / 排行 / 弧线束 / 盘口 / 健康度的服务端聚合，后续接真实数据只需替换 Provider。

## 快速开始

```bash
# 1. 安装（首次）
npm install

# 2. 开发模式：Mock API 8787 + Vite 5173
npm run dev

# 3. 打开浏览器
open http://127.0.0.1:5173
```

生产构建与单进程启动：

```bash
npm run build      # tsc --noEmit + vite build → dist/
npm start          # 8787 同源托管 dist 与 /api
open http://127.0.0.1:8787
```

**离线要求**：运行时零外部网络请求。世界 GeoJSON、图标、字体全部本地；不依赖地图 token、CDN 字体与在线瓦片。

## 演示账号

| 角色 | 账号 | 密码 | 权限 |
| --- | --- | --- | --- |
| 管理员 | `admin` | `admin123` | 全部页面、数据流控制、注入、用户管理、系统设置 |
| 普通用户 | `viewer` | `viewer123` | 大屏 / 地图 / 明细只读 |

另有 4 个演示用户（`trader_li`、`risk_chen`、`ops_wang`、`analyst_zhao`，密码 `demo123`），可在控制台切换身份，用于现场演示权限差异。

> 登录页图形验证码为本地生成与本地校验。演示鉴权将密码保存在本地 Mock 服务内存，**不具备真实安全性**，禁止用于生产或真实交易场景。

## 架构

```text
浏览器 SPA
  ├─ REST  /api/*        ← 页面数据与聚合
  └─ SSE   /api/stream   ← 交易 / 告警 / KPI / 行情 / 连接状态
                  │
Node.js Mock 服务（Express 4，单进程内存）
  ├─ routes/auth|data|admin
  ├─ middleware/auth     ← 演示 token 与角色校验
  ├─ providers/mockProvider
  ├─ core/generator      ← seeded PRNG 历史 1200 笔 + 实时 1.5s/笔 + 三类注入
  ├─ core/store          ← 环形上限：交易 6000 / 告警 400
  └─ core/aggregator     ← KPI / 时序 / 占比 / 排行 / 弧线束 / 健康度 / 盘口
```

- **同 seed 可复现**：`mulberry32` + 派生种子，同一 `DEMO_SEED` 得到相同历史。
- **数据聚合**：页面只消费聚合后的 DTO；聚合层是纯函数，全部有单测。
- **可替换数据源**：`DataProvider` 接口已定义；接入真实行情时新增 `providers/realProvider.js`，设置 `DATA_PROVIDER=real`，路由与前端不改。
- **地图适配层**：`MapAdapter` 固定 `mount / setNodes / setArcs / setLayers / setHeat / setSelected / focusNode / resetView`；当前实现为 ECharts geo + lines（PRD 10.1 方案 D），可替换为 L7/OpenLayers。
- **响应式舞台**：1920×1080 设计坐标 + `transform: scale`，覆盖 1366×768 / 2560×1440 / 3840×2160，单屏无滚动条。

## 目录

```text
cyber-trade-nexus/
├── docs/                      # PRD、01~08 文档、design/ 设计稿与评审、screenshots/ 实现截图
├── public/geo/world.geo.json  # 本地世界国界（离线）
├── scripts/
│   ├── dev.mjs                # 双进程开发编排
│   ├── gen-world-outline.mjs  # 生成首页简化地图轮廓
│   ├── screenshot.mjs         # 浏览器实机截图与验证
│   └── verify-interactions.mjs
├── server/                    # Mock 服务（Express、SSE、聚合、Provider）
├── src/
│   ├── api/                   # 唯一网络出口 + SSE 客户端
│   ├── charts/                # ECharts 封装与 option 构建
│   ├── components/            # HUD 卡、按钮、抽屉、Toast、状态组件
│   ├── hooks/                 # 权限、快捷键、缩放、数字滚动、资源请求
│   ├── layouts/ pages/        # 布局与页面
│   ├── lib/                   # 纯函数（格式化/过滤/弧线/聚合/权限/存储）
│   ├── map/                   # MapAdapter + ECharts 适配器 + 世界轮廓
│   ├── store/                 # auth / stream / filters / config / ui
│   └── styles/                # tokens + CSS Modules
└── package.json
```

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 同时启动 Mock API 8787 与 Vite 5173 |
| `npm run dev:server` | 仅启动 Mock API |
| `npm run dev:web` | 仅启动 Vite |
| `npm run build` | `tsc --noEmit` + 生产构建 |
| `npm start` | 生产模式（8787 同源托管 dist 与 API） |
| `npm test` | Vitest 全量单元/接口测试 |
| `npm run test:coverage` | 覆盖率报告（v8） |
| `npm run typecheck` | TypeScript 严格检查 |
| `npm run lint` | ESLint |
| `npm run gen:world` | 由 GeoJSON 重新生成首页地图轮廓 |

环境变量：`PORT`（默认 8787）、`DATA_PROVIDER`（默认 mock）、`DEMO_SEED`（默认 20261112）。

## 数据与接口

接口契约见 [`docs/05-接口设计文档.md`](docs/05-接口设计文档.md)。核心接口：

- `POST /api/auth/login`、`GET /api/auth/session`、`POST /api/auth/logout`、`POST /api/auth/impersonate`
- `GET /api/trades`（搜索/筛选/排序/分页）、`GET /api/trades/:id`
- `GET /api/nodes`、`GET /api/kpis`、`GET /api/timeseries`
- `GET /api/aggregations/assets|regions|depth|health|arcs`
- `GET /api/markets`、`GET /api/alerts`
- `GET /api/stream`（SSE：hello / trade / alert / kpi / market / status / heartbeat）
- `GET/PATCH/POST /api/admin/users|stream|inject|reset|clear|alerts`

统一响应信封 `{ data, serverTime }`，错误 `{ error: { code, message, details, requestId } }`。错误码含 `VALIDATION_ERROR`、`INVALID_CREDENTIALS`、`UNAUTHORIZED`、`TOKEN_EXPIRED`、`FORBIDDEN`、`USER_DISABLED`、`NOT_FOUND`、`INTERNAL_ERROR`。

## 测试与验证

已执行的证据：

| 项 | 命令 | 结果 |
| --- | --- | --- |
| 单元/接口测试 | `npm test` | 15 个文件、139 个测试全部通过 |
| 类型检查 | `npm run typecheck` | 0 error |
| 生产构建 | `npm run build` | 2227 modules，gzip 约 500KB（含 ECharts） |
| 浏览器实机 | `node scripts/screenshot.mjs` | 登录、大屏、地图、明细、抽屉、控制台、403 截图；控制台错误 0 |
| 交互验证 | `node scripts/verify-interactions.mjs` | 验证码校验、viewer 无导出、地图热力/回放/节点筛选 |
| 地图命中 | 使用 ECharts `convertToPixel` 计算弧线中点并点击 | 节点筛选与弧线抽屉实际打开 |
| 4× 长跑压测 | `node scripts/soak.mjs`（10.6 分钟、4× 速率） | 首尾堆内存 14.4→14.8 MB（峰值 26.5 MB，无增长），结束 60 FPS，0 错误，数据流全程在线 |

截图见 [`docs/screenshots/`](docs/screenshots/)：

- `01-login.png` 登录页
- `02-dashboard.png` 首页大屏
- `03-map.png` 全球交易地图
- `04-trades.png` 交易明细（虚拟滚动）
- `05-trades-drawer.png` 交易详情抽屉
- `06-admin.png` 管理员控制台
- `07-admin-amber.png` 琥珀主题
- `08-viewer-403.png` viewer 越权
- `09-map-heat.png` 热力模式
- `10-map-replay.png` 时间回放
- `11-map-drawer.png` 地图弧线详情

## 文档

| 编号 | 文档 |
| --- | --- |
| — | [`docs/PRD.md`](docs/PRD.md) 产品需求 |
| 01 | [`docs/01-需求分析说明书.md`](docs/01-需求分析说明书.md) |
| 02 | [`docs/02-概要设计说明书.md`](docs/02-概要设计说明书.md) |
| 03 | [`docs/03-详细设计说明书.md`](docs/03-详细设计说明书.md) |
| 04 | [`docs/04-数据库设计说明书.md`](docs/04-数据库设计说明书.md) |
| 05 | [`docs/05-接口设计文档.md`](docs/05-接口设计文档.md) |
| 06 | [`docs/06-原型设计说明书.md`](docs/06-原型设计说明书.md) |
| 07 | [`docs/07-测试计划与用例.md`](docs/07-测试计划与用例.md) |
| 08 | [`docs/08-部署与运维手册.md`](docs/08-部署与运维手册.md) |

设计过程：Codex 生成 5 页 1920×1080 高保真 mockup → Chrome headless 逐页渲染评审 → 首版登录页阻断退回 → 修订版通过 → 实现落地。评审记录见 [`docs/design/review.md`](docs/design/review.md)，设计 token 见 [`docs/design/design-system.md`](docs/design/design-system.md)。

## 已知限制

1. **PRD P1 未交付项**：导出当前视图快照、演示巡演模式未实现；交易明细提供 admin 的 CSV 导出，替代“快照导出”中的表格场景。
2. **地图线束聚合开关**：当前仅按服务端聚合弧线束展示，未提供“逐笔/线束”切换（I-35 的 P1 子项）。
3. **节点离线注入**：注入仅 3 类（大额/延迟/风控），与 05 契约一致；节点离线告警只在历史流中出现。
4. **真实数据**：`DATA_PROVIDER=real` 为预留路径，尚未实现 RealProvider；历史数据为内存态，进程重启按 seed 重建。
5. **内存与长跑**：前端数组上限 1500 交易/200 告警，后端 6000/400。已做 10.6 分钟、4× 速率压测（堆内存稳定、60 FPS、0 错误），真实硬件长时间重负载仍建议按部署环境复核。
6. **移动端 / 多语言 / 真实鉴权**：均不在范围。
7. **演示身份切换**：服务端生成新 token 并持久化到浏览器；旧 token 保留到过期，`viewer` 切换后访问 `/admin` 由路由守卫拦截。

## 安全声明

- 演示 token 存于服务端内存、浏览器 localStorage；密码为本地常量，仅用于比对，**不是真实认证**。
- 服务端对管理接口做角色中间件校验；前端做路由守卫与组件级能力判断；三者只构成演示边界。
- 界面、文档、README 均显式标注 DEMO / 模拟数据，所有数字不代表真实市场。
