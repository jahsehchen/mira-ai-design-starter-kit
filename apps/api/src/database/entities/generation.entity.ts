import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/** AI 生成任务表（三态状态机载体） */
@Entity('generations')
export class GenerationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'owner_id', type: 'varchar', length: 36 })
  ownerId: string;

  @Column({ type: 'text' })
  prompt: string;

  @Column({ name: 'style_preset', type: 'varchar', length: 32, nullable: true })
  stylePreset: string | null;

  @Column({ name: 'options', type: 'simple-json', nullable: true })
  options: Record<string, unknown> | null;

  @Column({ name: 'status', length: 16, default: 'pending' })
  status: string;

  @Column({ type: 'int', default: 0 })
  step: number;

  @Column({ type: 'simple-json', nullable: true })
  steps: { key: string; label: string; state: string }[] | null;

  @Column({ length: 32, default: 'mock' })
  provider: string;

  @Column({ type: 'simple-json', nullable: true })
  result: Record<string, unknown> | null;

  @Column({ name: 'error_code', type: 'varchar', length: 64, nullable: true })
  errorCode: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'finished_at', type: Date, nullable: true })
  finishedAt: Date | null;
}
