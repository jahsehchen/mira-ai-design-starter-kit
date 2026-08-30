import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** 模板表（种子数据 ≥12 条） */
@Entity('templates')
export class TemplateEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 64 })
  name: string;

  @Column({ length: 16 })
  category: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({ name: 'thumbnail_url', type: 'varchar', length: 512, nullable: true })
  thumbnailUrl: string | null;

  @Column({ name: 'gradient_from', length: 16 })
  gradientFrom: string;

  @Column({ name: 'gradient_to', length: 16 })
  gradientTo: string;

  @Column({ name: 'display_text', length: 64 })
  displayText: string;

  @Column({ name: 'canvas_json', type: 'simple-json', nullable: true })
  canvasJson: Record<string, unknown> | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
