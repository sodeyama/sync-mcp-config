import winston from 'winston';
import path from 'path';
import * as fs from 'fs';
import { PathResolver } from './PathResolver';
import { getErrorDetails } from './ErrorMessages';

/**
 * ログレベル
 */
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

/**
 * ロガー設定
 */
interface LoggerConfig {
  level?: LogLevel;
  logToFile?: boolean;
  logDir?: string;
  consoleColors?: boolean;
}

/**
 * ログユーティリティ
 */
export class Logger {
  private static instance: winston.Logger;
  private static config: LoggerConfig = {
    level: 'info',
    logToFile: false,
    consoleColors: true,
  };

  /**
   * ロガーを初期化
   */
  static initialize(config?: LoggerConfig): void {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    const transports: winston.transport[] = [
      new winston.transports.Console({
        format: winston.format.combine(
          this.config.consoleColors
            ? winston.format.colorize()
            : winston.format.uncolorize(),
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.printf((info) => {
            const { timestamp, level, message, ...meta } = info as {
              timestamp: string;
              level: string;
              message: string;
              [key: string]: unknown;
            };
            const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
            return `[${timestamp}] ${level}: ${message}${metaStr}`;
          }),
        ),
      }),
    ];

    if (this.config.logToFile) {
      const logDir = this.config.logDir || PathResolver.expand('~/.mcp/logs');
      transports.push(
        new winston.transports.File({
          filename: path.join(logDir, 'error.log'),
          level: 'error',
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
        new winston.transports.File({
          filename: path.join(logDir, 'combined.log'),
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      );
    }

    this.instance = winston.createLogger({
      level: this.config.level,
      transports,
    });
  }

  /**
   * ロガーインスタンスを取得
   */
  private static getInstance(): winston.Logger {
    if (!this.instance) {
      this.initialize();
    }
    return this.instance;
  }

  /**
   * エラーログ
   */
  static error(message: string, error?: unknown): void {
    const logger = this.getInstance();
    if (error) {
      const errorDetails = getErrorDetails(error);
      logger.error(message, {
        code: errorDetails.code,
        details: errorDetails.details,
        stack: errorDetails.stack,
      });
    } else {
      logger.error(message);
    }
  }

  /**
   * 警告ログ
   */
  static warn(message: string, meta?: Record<string, unknown>): void {
    this.getInstance().warn(message, meta);
  }

  /**
   * 情報ログ
   */
  static info(message: string, meta?: Record<string, unknown>): void {
    this.getInstance().info(message, meta);
  }

  /**
   * デバッグログ
   */
  static debug(message: string, meta?: Record<string, unknown>): void {
    this.getInstance().debug(message, meta);
  }

  /**
   * ログレベルを設定
   */
  static setLevel(level: LogLevel): void {
    this.config.level = level;
    if (this.instance) {
      this.instance.level = level;
    }
  }

  /**
   * 進捗ログ
   */
  static progress(current: number, total: number, message: string): void {
    const percentage = Math.round((current / total) * 100);
    this.info(`[${percentage}%] ${message}`, { current, total });
  }

  /**
   * 成功ログ
   */
  static success(message: string, meta?: Record<string, unknown>): void {
    this.info(`✅ ${message}`, meta);
  }

  /**
   * 失敗ログ
   */
  static failure(message: string, error?: Error | Record<string, unknown>): void {
    this.error(`❌ ${message}`, error);
  }

  /**
   * タスク開始ログ
   */
  static startTask(taskName: string): void {
    this.info(`🚀 Starting: ${taskName}`);
  }

  /**
   * タスク完了ログ
   */
  static endTask(taskName: string, success = true): void {
    if (success) {
      this.success(`Completed: ${taskName}`);
    } else {
      this.failure(`Failed: ${taskName}`);
    }
  }

  /**
   * 設定ダンプ
   */
  static dumpConfig(config: unknown, label = 'Configuration'): void {
    this.debug(`${label}:`, { config });
  }

  /**
   * パフォーマンス測定開始
   */
  static startTimer(label: string): () => void {
    const start = Date.now();
    this.debug(`Timer started: ${label}`);
    
    return () => {
      const duration = Date.now() - start;
      this.debug(`Timer ended: ${label}`, { duration: `${duration}ms` });
    };
  }

  /**
   * エラーログファイルのパスを取得
   */
  static getErrorLogPath(): string {
    const logDir = this.config.logDir || PathResolver.expand('~/.mcp/logs');
    return path.join(logDir, 'error.log');
  }

  /**
   * 全ログファイルのパスを取得
   */
  static getCombinedLogPath(): string {
    const logDir = this.config.logDir || PathResolver.expand('~/.mcp/logs');
    return path.join(logDir, 'combined.log');
  }

  /**
   * 最近のエラーログを取得
   */
  static async getRecentErrors(lines = 50): Promise<string[]> {
    try {
      const errorLogPath = this.getErrorLogPath();
      if (!fs.existsSync(errorLogPath)) {
        return [];
      }

      const content = await fs.promises.readFile(errorLogPath, 'utf-8');
      const allLines = content.trim().split('\n');
      return allLines.slice(-lines);
    } catch {
      return [];
    }
  }

  /**
   * ログファイルをクリア
   */
  static async clearLogs(): Promise<void> {
    try {
      const errorLogPath = this.getErrorLogPath();
      const combinedLogPath = this.getCombinedLogPath();
      
      if (fs.existsSync(errorLogPath)) {
        await fs.promises.writeFile(errorLogPath, '');
      }
      if (fs.existsSync(combinedLogPath)) {
        await fs.promises.writeFile(combinedLogPath, '');
      }
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  }
}