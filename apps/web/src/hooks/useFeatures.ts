/**
 * MIRA·弥画 L3 功能开关消费 hook（Starter Kit）
 *
 * 四开关统一入口：
 *   - useCasesEnabled()：案例库是否启用（'builtin' | 'custom' → true；'off' → false）。
 *     4 处消费点（首页案例精选 / 案例页 / 生成器案例选择器 / 模板页案例入口）统一走它。
 *   - payments / sharing / registration 为 boolean，直接读 FEATURES.xxx 即可。
 */
import { FEATURES } from '../config';

/** 案例库是否启用 */
export const useCasesEnabled = (): boolean => FEATURES.cases !== 'off';
