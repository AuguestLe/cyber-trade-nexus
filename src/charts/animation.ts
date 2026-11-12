import type { EChartsCoreOption } from 'echarts/core';

/**
 * 控制图表更新时的动效：
 * - 首次挂载（首次加载 / tab 切回）保留入场动画；
 * - 后续轮询、流式数据更新时关闭动画，避免图表每 2 秒重播一次「正在加载」的观感。
 *
 * ECharts 的动画开关是 option 的顶层字段，因此只需要在更新时克隆并覆盖它，
 * 不改动调用方构造的 option（保持 option 纯函数可测试）。
 */
export function withUpdateMotion(option: EChartsCoreOption, animate: boolean): EChartsCoreOption {
  if (animate) return option;
  return { ...option, animation: false };
}
