import type { TemplateCategory } from '@mira/contracts';

export interface TemplateSeedItem {
  name: string;
  category: TemplateCategory;
  description: string;
  gradientFrom: string;
  gradientTo: string;
  displayText: string;
  sortOrder: number;
}

/**
 * 模板种子数据（复用原型 12 条渐变占位）
 * 覆盖 海报/社媒/电商/品牌 四类。
 */
export const TEMPLATE_SEED: TemplateSeedItem[] = [
  { name: '周末市集海报', category: 'poster', description: '暖橙色手绘风，适合活动/市集宣传', gradientFrom: '#F2A65A', gradientTo: '#E86A33', displayText: '周末市集', sortOrder: 1 },
  { name: '新品发布图', category: 'social', description: '极简浅色调，适合新品官宣', gradientFrom: '#F3F1EE', gradientTo: '#DDE3FF', displayText: '焕新登场', sortOrder: 2 },
  { name: '春日大促主图', category: 'ecommerce', description: '清新绿色系，适合大促促销', gradientFrom: '#7CC576', gradientTo: '#3E8E5A', displayText: '春日焕新', sortOrder: 3 },
  { name: '咖啡馆名片', category: 'brand', description: '复古米色纸感，适合品牌小物料', gradientFrom: '#C8B295', gradientTo: '#8F7A5D', displayText: 'COFFEE', sortOrder: 4 },
  { name: '音乐节海报', category: 'poster', description: '紫蓝渐变霓虹感，适合演出宣传', gradientFrom: '#7A5CF0', gradientTo: '#2B4CFF', displayText: '夏夜声浪', sortOrder: 5 },
  { name: '知识封面', category: 'social', description: '深蓝大字排版，适合知识博主', gradientFrom: '#1A33B8', gradientTo: '#0D0F12', displayText: '效率技巧', sortOrder: 6 },
  { name: '烘焙开业海报', category: 'poster', description: '奶油色暖调，适合新店开业', gradientFrom: '#F7D9C4', gradientTo: '#E8A87C', displayText: '新店开业', sortOrder: 7 },
  { name: '详情页头图', category: 'ecommerce', description: '深蓝信任感，适合商品详情', gradientFrom: '#1630A6', gradientTo: '#0D0F12', displayText: '放心购', sortOrder: 8 },
  { name: '工作室视觉', category: 'brand', description: '黑白极简衬线，适合独立工作室', gradientFrom: '#F3F1EE', gradientTo: '#E9E5E0', displayText: 'STUDIO', sortOrder: 9 },
  { name: '夏日柠檬茶', category: 'poster', description: '柠檬黄清爽调，适合饮品海报', gradientFrom: '#F7D774', gradientTo: '#F5B84B', displayText: '冰爽一夏', sortOrder: 10 },
  { name: '直播预告', category: 'social', description: '橙红醒目调，适合直播预热', gradientFrom: '#E86A33', gradientTo: '#B3322C', displayText: '今晚 8 点', sortOrder: 11 },
  { name: '会员日海报', category: 'ecommerce', description: '蓝紫会员感，适合会员日活动', gradientFrom: '#7A5CF0', gradientTo: '#1630A6', displayText: '会员日', sortOrder: 12 },
];
