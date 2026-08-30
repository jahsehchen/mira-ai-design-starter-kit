import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** 导出任务表（进程内队列执行） */
@Entity('export_jobs')
export class ExportJobEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'owner_id', type: 'varchar', length: 36 })
  ownerId: string;

  @Column({ name: 'work_id', type: 'varchar', length: 36 })
  workId: string;

  @Column({ length: 8 })
  format: string;

  @Column({ type: 'simple-json' })
  sizes: { key: string; width: number; height: number; label: string }[];

  @Column({ length: 16, default: 'pending' })
  status: string;

  @Column({ type: 'int', default: 0 })
  progress: number;

  @Column({ name: 'stage_text', length: 64, default: '等待处理' })
  stageText: string;

  @Column({ type: 'simple-json', nullable: true })
  files: { fileId: string; sizeKey: string; format: string; url: string; fileName: string; byteSize: number }[] | null;

  @Column({ name: 'error_code', type: 'varchar', length: 64, nullable: true })
  errorCode: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @Column({ name: 'finished_at', type: Date, nullable: true })
  finishedAt: Date | null;
}
