import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { entities } from './entities';
import { assertProductionSecret } from '../config/production-security';

const dbPassword = process.env.DB_PASSWORD || 'mira_secret_change_me';
assertProductionSecret('DB_PASSWORD', dbPassword, 16);

/**
 * TypeORM CLI 数据源（migration 生成/运行）。
 * 迁移目标：PostgreSQL（生产/部署用）；开发 SQLite 用 DB_SYNC=true 快速建表。
 */
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'mira',
  password: dbPassword,
  database: process.env.DB_NAME || 'mira',
  entities,
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
});
