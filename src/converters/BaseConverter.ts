import { FileUtils } from '../utils/FileUtils';
import { PathResolver } from '../utils/PathResolver';
import { Logger } from '../utils/Logger';
import type { 
  MasterConfig, 
  MCPServerConfig, 
  ToolType, 
  ValidationResult,
  ValidationError 
} from '../types';

/**
 * 変換器の基底クラス
 */
export abstract class BaseConverter {
  protected tool: ToolType;
  protected configPath: string;

  constructor(tool: ToolType) {
    this.tool = tool;
    this.configPath = PathResolver.getToolConfigPath(tool);
  }

  /**
   * マスター設定からツール固有の設定に変換
   */
  abstract convertFromMaster(masterConfig: MasterConfig): unknown;

  /**
   * ツール固有の設定からマスター設定に変換
   */
  abstract convertToMaster(toolConfig: unknown): MasterConfig;

  /**
   * 設定ファイルを読み込む
   */
  async readConfig(): Promise<unknown> {
    try {
      const expandedPath = PathResolver.expand(this.configPath);
      
      if (!(await FileUtils.exists(expandedPath))) {
        Logger.warn(`Config file not found for ${this.tool}`, { path: expandedPath });
        return this.getDefaultConfig();
      }

      const config = await FileUtils.readJson(expandedPath);
      Logger.debug(`Config loaded for ${this.tool}`, { path: expandedPath });
      return config;
    } catch (error) {
      Logger.error(`Failed to read config for ${this.tool}`, error as Error);
      throw error;
    }
  }

  /**
   * 設定ファイルに書き込む
   */
  async writeConfig(config: unknown): Promise<void> {
    try {
      const expandedPath = PathResolver.expand(this.configPath);
      await FileUtils.writeJson(expandedPath, config);
      Logger.success(`Config saved for ${this.tool}`, { path: expandedPath });
    } catch (error) {
      Logger.error(`Failed to write config for ${this.tool}`, error as Error);
      throw error;
    }
  }

  /**
   * デフォルト設定を取得
   */
  protected abstract getDefaultConfig(): unknown;

  /**
   * 設定を検証
   */
  abstract validateConfig(config: unknown): ValidationResult;

  /**
   * MCPサーバー設定を正規化
   */
  protected normalizeMCPServerConfig(config: MCPServerConfig): MCPServerConfig {
    const normalized: MCPServerConfig = {
      command: config.command,
    };

    // オプションフィールドを追加
    if (config.args) normalized.args = config.args;
    if (config.env) normalized.env = config.env;
    if (config.disabled !== undefined) normalized.disabled = config.disabled;
    if (config.alwaysAllow) normalized.alwaysAllow = config.alwaysAllow;
    if (config.autoApprove) normalized.autoApprove = config.autoApprove;
    if (config.transport) normalized.transport = config.transport;
    if (config.type) normalized.type = config.type;
    if (config.url) normalized.url = config.url;

    return normalized;
  }

  /**
   * 設定の差分を検出
   */
  detectChanges(oldConfig: unknown, newConfig: unknown): {
    added: string[];
    modified: string[];
    removed: string[];
  } {
    const oldServers = this.extractMCPServers(oldConfig);
    const newServers = this.extractMCPServers(newConfig);

    const oldKeys = new Set(Object.keys(oldServers));
    const newKeys = new Set(Object.keys(newServers));

    const added = Array.from(newKeys).filter(key => !oldKeys.has(key));
    const removed = Array.from(oldKeys).filter(key => !newKeys.has(key));
    const modified = Array.from(oldKeys)
      .filter(key => newKeys.has(key))
      .filter(key => JSON.stringify(oldServers[key]) !== JSON.stringify(newServers[key]));

    return { added, modified, removed };
  }

  /**
   * MCPサーバー設定を抽出
   */
  abstract extractMCPServers(config: unknown): Record<string, MCPServerConfig>;

  /**
   * 設定をマージ
   */
  protected mergeMCPServers(
    base: Record<string, MCPServerConfig>,
    override: Record<string, MCPServerConfig>,
  ): Record<string, MCPServerConfig> {
    const merged: Record<string, MCPServerConfig> = { ...base };

    for (const [key, value] of Object.entries(override)) {
      merged[key] = this.normalizeMCPServerConfig(value);
    }

    return merged;
  }

  /**
   * 検証エラーを作成
   */
  protected createValidationError(path: string, message: string): ValidationError {
    return { path, message };
  }

  /**
   * 設定が有効かチェック
   */
  protected isValidMCPServerConfig(config: unknown): config is MCPServerConfig {
    if (typeof config !== 'object' || config === null) {
      return false;
    }

    const serverConfig = config as Record<string, unknown>;
    
    // 必須フィールドのチェック
    if (typeof serverConfig.command !== 'string' || !serverConfig.command) {
      return false;
    }

    // オプションフィールドのチェック
    if (serverConfig.args !== undefined && !Array.isArray(serverConfig.args)) {
      return false;
    }

    if (serverConfig.env !== undefined && 
        (typeof serverConfig.env !== 'object' || serverConfig.env === null)) {
      return false;
    }

    if (serverConfig.disabled !== undefined && typeof serverConfig.disabled !== 'boolean') {
      return false;
    }

    if (serverConfig.alwaysAllow !== undefined && !Array.isArray(serverConfig.alwaysAllow)) {
      return false;
    }

    if (serverConfig.autoApprove !== undefined && !Array.isArray(serverConfig.autoApprove)) {
      return false;
    }

    if (serverConfig.transport !== undefined && 
        !['stdio', 'sse', 'http'].includes(serverConfig.transport as string)) {
      return false;
    }

    return true;
  }

  /**
   * 環境変数をサニタイズ
   */
  protected sanitizeEnvVars(env?: Record<string, string>): Record<string, string> | undefined {
    if (!env) return undefined;

    const sanitized: Record<string, string> = {};
    for (const [key, value] of Object.entries(env)) {
      // 環境変数名は大文字とアンダースコアのみ許可
      if (/^[A-Z_][A-Z0-9_]*$/.test(key)) {
        sanitized[key] = String(value);
      } else {
        Logger.warn(`Invalid environment variable name: ${key}`);
      }
    }

    return Object.keys(sanitized).length > 0 ? sanitized : undefined;
  }

  /**
   * ツール名を取得
   */
  getToolName(): ToolType {
    return this.tool;
  }

  /**
   * 設定ファイルパスを取得
   */
  getConfigPath(): string {
    return this.configPath;
  }
}