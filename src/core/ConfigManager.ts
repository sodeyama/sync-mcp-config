import { FileUtils } from '../utils/FileUtils';
import { PathResolver } from '../utils/PathResolver';
import { Logger } from '../utils/Logger';
import { z } from 'zod';
import type { MasterConfig, GlobalSettings, MasterMCPServerConfig } from '../types';

/**
 * MCPサーバー設定のスキーマ
 */
const MCPServerConfigSchema = z.object({
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  disabled: z.boolean().optional(),
  alwaysAllow: z.array(z.string()).optional(),
  autoApprove: z.array(z.string()).optional(),
  transport: z.enum(['stdio', 'sse', 'http']).optional(),
  type: z.enum(['sse', 'http', 'stdio']).optional(),
  url: z.string().optional(),
  metadata: z.object({
    description: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }).optional(),
});

/**
 * グローバル設定のスキーマ
 */
const GlobalSettingsSchema = z.object({
  backupEnabled: z.boolean(),
  syncOnChange: z.boolean(),
  backupRetentionCount: z.number().int().positive().optional(),
  excludeTools: z.array(z.string()).optional(),
});

/**
 * マスター設定のスキーマ
 */
const MasterConfigSchema = z.object({
  version: z.string(),
  lastUpdated: z.string(),
  mcpServers: z.record(MCPServerConfigSchema),
  globalSettings: GlobalSettingsSchema,
});

/**
 * 設定管理クラス
 */
export class ConfigManager {
  private configPath: string;
  private config: MasterConfig | null = null;

  constructor(configPath?: string) {
    this.configPath = configPath || PathResolver.getMasterConfigPath();
  }

  /**
   * 設定を初期化
   */
  async initialize(): Promise<void> {
    const configDir = PathResolver.expand('~/.mcp');
    await FileUtils.ensureDir(configDir);
    
    if (!(await this.exists())) {
      await this.createDefaultConfig();
    }
  }

  /**
   * 設定ファイルが存在するかチェック
   */
  async exists(): Promise<boolean> {
    return FileUtils.exists(this.configPath);
  }

  /**
   * デフォルト設定を作成
   */
  private async createDefaultConfig(): Promise<void> {
    const defaultConfig: MasterConfig = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      mcpServers: {},
      globalSettings: {
        backupEnabled: true,
        syncOnChange: true,
        backupRetentionCount: 10,
        excludeTools: [],
      },
    };

    await this.saveConfig(defaultConfig);
    Logger.info('Default master config created', { path: this.configPath });
  }

  /**
   * 設定を読み込む
   */
  async loadConfig(): Promise<MasterConfig> {
    try {
      const rawConfig = await FileUtils.readJson(this.configPath);
      const validatedConfig = this.validateConfig(rawConfig);
      this.config = validatedConfig;
      Logger.debug('Master config loaded', { path: this.configPath });
      return validatedConfig;
    } catch (error) {
      Logger.error('Failed to load master config', error as Error);
      throw error;
    }
  }

  /**
   * 設定を保存
   */
  async saveConfig(config: MasterConfig): Promise<void> {
    try {
      // 設定を検証
      const validatedConfig = this.validateConfig(config);
      
      // 最終更新日時を更新
      validatedConfig.lastUpdated = new Date().toISOString();
      
      // ファイルに保存
      await FileUtils.writeJson(this.configPath, validatedConfig);
      this.config = validatedConfig;
      
      Logger.success('Master config saved', { path: this.configPath });
    } catch (error) {
      Logger.error('Failed to save master config', error as Error);
      throw error;
    }
  }

  /**
   * 設定を検証
   */
  private validateConfig(config: unknown): MasterConfig {
    try {
      return MasterConfigSchema.parse(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const issues = error.issues.map(issue => ({
          path: issue.path.join('.'),
          message: issue.message,
        }));
        Logger.error('Invalid master config', { issues });
        throw new Error(`Invalid master config: ${JSON.stringify(issues)}`);
      }
      throw error;
    }
  }

  /**
   * 現在の設定を取得
   */
  getConfig(): MasterConfig | null {
    return this.config;
  }

  /**
   * MCPサーバーを追加
   */
  async addServer(name: string, server: MasterMCPServerConfig): Promise<void> {
    if (!this.config) {
      await this.loadConfig();
    }

    if (!this.config) {
      throw new Error('Config not loaded');
    }

    if (this.config.mcpServers[name]) {
      throw new Error(`Server '${name}' already exists`);
    }

    this.config.mcpServers[name] = server;
    await this.saveConfig(this.config);
    Logger.info(`Server '${name}' added to master config`);
  }

  /**
   * MCPサーバーを更新
   */
  async updateServer(name: string, server: Partial<MasterMCPServerConfig>): Promise<void> {
    if (!this.config) {
      await this.loadConfig();
    }

    if (!this.config) {
      throw new Error('Config not loaded');
    }

    if (!this.config.mcpServers[name]) {
      throw new Error(`Server '${name}' not found`);
    }

    this.config.mcpServers[name] = {
      ...this.config.mcpServers[name],
      ...server,
    };
    await this.saveConfig(this.config);
    Logger.info(`Server '${name}' updated in master config`);
  }

  /**
   * MCPサーバーを削除
   */
  async removeServer(name: string): Promise<void> {
    if (!this.config) {
      await this.loadConfig();
    }

    if (!this.config) {
      throw new Error('Config not loaded');
    }

    if (!this.config.mcpServers[name]) {
      throw new Error(`Server '${name}' not found`);
    }

    delete this.config.mcpServers[name];
    await this.saveConfig(this.config);
    Logger.info(`Server '${name}' removed from master config`);
  }

  /**
   * グローバル設定を更新
   */
  async updateGlobalSettings(settings: Partial<GlobalSettings>): Promise<void> {
    if (!this.config) {
      await this.loadConfig();
    }

    if (!this.config) {
      throw new Error('Config not loaded');
    }

    this.config.globalSettings = {
      ...this.config.globalSettings,
      ...settings,
    };
    await this.saveConfig(this.config);
    Logger.info('Global settings updated');
  }

  /**
   * 設定をエクスポート
   */
  async exportConfig(outputPath: string): Promise<void> {
    if (!this.config) {
      await this.loadConfig();
    }

    if (!this.config) {
      throw new Error('Config not loaded');
    }

    await FileUtils.writeJson(outputPath, this.config);
    Logger.success(`Config exported to ${outputPath}`);
  }

  /**
   * 設定をインポート
   */
  async importConfig(inputPath: string, merge = false): Promise<void> {
    try {
      const importedConfig = await FileUtils.readJson(inputPath);
      const validatedConfig = this.validateConfig(importedConfig);

      if (merge && this.config) {
        // 既存の設定とマージ
        validatedConfig.mcpServers = {
          ...this.config.mcpServers,
          ...validatedConfig.mcpServers,
        };
      }

      await this.saveConfig(validatedConfig);
      Logger.success(`Config imported from ${inputPath}`);
    } catch (error) {
      Logger.error('Failed to import config', error as Error);
      throw error;
    }
  }

  /**
   * 設定の統計情報を取得
   */
  getStats(): {
    serverCount: number;
    enabledServerCount: number;
    disabledServerCount: number;
    toolsWithServers: string[];
  } {
    if (!this.config) {
      return {
        serverCount: 0,
        enabledServerCount: 0,
        disabledServerCount: 0,
        toolsWithServers: [],
      };
    }

    const servers = Object.values(this.config.mcpServers);
    const enabledServers = servers.filter(s => !s.disabled);
    const disabledServers = servers.filter(s => s.disabled);

    return {
      serverCount: servers.length,
      enabledServerCount: enabledServers.length,
      disabledServerCount: disabledServers.length,
      toolsWithServers: [], // これは同期後に更新される
    };
  }
}