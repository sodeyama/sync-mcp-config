import { BaseConverter } from './BaseConverter';
import type {
  MasterConfig,
  ClaudeDesktopConfig,
  MCPServerConfig,
  ValidationResult,
} from '../types';

/**
 * Claude Desktop用の変換器
 */
export class ClaudeDesktopConverter extends BaseConverter {
  constructor() {
    super('claude');
  }

  /**
   * マスター設定からClaude Desktop設定に変換
   */
  convertFromMaster(masterConfig: MasterConfig): ClaudeDesktopConfig {
    const claudeConfig: ClaudeDesktopConfig = {
      mcpServers: {},
    };

    // MCPサーバー設定を変換
    for (const [name, serverConfig] of Object.entries(masterConfig.mcpServers)) {
      // 無効化されているサーバーはスキップ
      if (serverConfig.disabled) {
        continue;
      }

      claudeConfig.mcpServers[name] = this.normalizeMCPServerConfig(serverConfig);
    }

    return claudeConfig;
  }

  /**
   * Claude Desktop設定からマスター設定に変換
   */
  convertToMaster(toolConfig: unknown): MasterConfig {
    const claudeConfig = toolConfig as ClaudeDesktopConfig;
    
    const masterConfig: MasterConfig = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      mcpServers: {},
      globalSettings: {
        backupEnabled: true,
        syncOnChange: true,
      },
    };

    // MCPサーバー設定を変換
    if (claudeConfig.mcpServers) {
      for (const [name, serverConfig] of Object.entries(claudeConfig.mcpServers)) {
        masterConfig.mcpServers[name] = {
          ...this.normalizeMCPServerConfig(serverConfig),
          metadata: {
            description: `Imported from Claude Desktop`,
          },
        };
      }
    }

    return masterConfig;
  }

  /**
   * デフォルト設定を取得
   */
  protected getDefaultConfig(): ClaudeDesktopConfig {
    return {
      mcpServers: {},
    };
  }

  /**
   * 設定を検証
   */
  validateConfig(config: unknown): ValidationResult {
    const errors: ValidationResult['errors'] = [];

    if (typeof config !== 'object' || config === null) {
      errors.push(this.createValidationError('', 'Config must be an object'));
      return { valid: false, errors };
    }

    const claudeConfig = config as Record<string, unknown>;

    // mcpServersフィールドの検証
    if (!claudeConfig.mcpServers) {
      errors.push(this.createValidationError('mcpServers', 'mcpServers field is required'));
      return { valid: false, errors };
    }

    if (typeof claudeConfig.mcpServers !== 'object' || claudeConfig.mcpServers === null) {
      errors.push(this.createValidationError('mcpServers', 'mcpServers must be an object'));
      return { valid: false, errors };
    }

    // 各サーバー設定の検証
    const servers = claudeConfig.mcpServers as Record<string, unknown>;
    for (const [name, serverConfig] of Object.entries(servers)) {
      if (!this.isValidMCPServerConfig(serverConfig)) {
        errors.push(
          this.createValidationError(
            `mcpServers.${name}`,
            'Invalid server configuration',
          ),
        );
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * MCPサーバー設定を抽出
   */
  extractMCPServers(config: unknown): Record<string, MCPServerConfig> {
    const claudeConfig = config as ClaudeDesktopConfig;
    return claudeConfig.mcpServers || {};
  }

  /**
   * 設定ファイルに書き込む（Claude Desktop固有の処理）
   */
  async writeConfig(config: unknown): Promise<void> {
    const claudeConfig = config as ClaudeDesktopConfig;
    
    // 既存の設定を読み込む
    let existingConfig: Record<string, unknown> = {};
    try {
      existingConfig = await this.readConfig() as Record<string, unknown>;
    } catch {
      // ファイルが存在しない場合は空のオブジェクトを使用
    }

    // globalShortcutなど他の設定を保持
    const mergedConfig = {
      ...existingConfig,
      mcpServers: claudeConfig.mcpServers,
    };

    await super.writeConfig(mergedConfig);
  }
}