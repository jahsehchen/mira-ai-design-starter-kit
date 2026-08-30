import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** 分享链接表（token 化公开访问） */
@Entity('shares')
export class ShareEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'work_id', type: 'varchar', length: 36 })
  workId: string;

  @Index({ unique: true })
  @Column({ length: 64 })
  token: string;

  @Column({ name: 'created_by', type: 'varchar', length: 36 })
  createdBy: string;

  @Column({ name: 'expires_at', type: Date, nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'view_count', type: 'int', default: 0 })
  viewCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
