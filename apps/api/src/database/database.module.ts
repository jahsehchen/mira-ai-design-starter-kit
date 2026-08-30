import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { entities } from './entities';

/**
 * 数据库模块：按 DB_TYPE 环境变量选择驱动。
 * - postgres：默认（生产 / docker-compose）
 * - sqlite：开发降级（本地文件，零 Docker 依赖）
 * 同一实体双驱动，仅改 env 零代码改动。
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const db = config.get<{
          type: 'postgres' | 'sqlite';
          host: string;
          port: number;
          username: string;
          password: string;
          database: string;
          sync: boolean;
        }>('db');

        if (!db) throw new Error('数据库配置缺失（config/db）');

        if (db.type === 'sqlite') {
          return {
            type: 'sqlite' as const,
            database: `${db.database}.sqlite`,
            entities,
            synchronize: db.sync,
            // 开发期便于观察
            logging: false,
          };
        }

        return {
          type: 'postgres' as const,
          host: db.host,
          port: db.port,
          username: db.username,
          password: db.password,
          database: db.database,
          entities,
          synchronize: db.sync,
          logging: false,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
