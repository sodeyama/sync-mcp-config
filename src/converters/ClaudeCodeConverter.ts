import { BaseConverter } from './BaseConverter';
import type {
  MasterConfig,
  ClaudeCodeConfig,
  MCPServerConfig,
  ValidationResult,
} from '../types';

/**
 * Claude Code用の変換器
 */
export class ClaudeCodeConverter extends BaseConverter {
  constructor() {
    super('claude-code');
  }

  /**
   * マスター設定からClaude Code設定に変換
   */
  convertFromMaster(masterConfig: MasterConfig): ClaudeCodeConfig {
    const claudeCodeConfig: ClaudeCodeConfig = {
      mcpServers: {},
    };

    // MCPサーバー設定を変換
    for (const [name, serverConfig] of Object.entries(masterConfig.mcpServers)) {
      // 無効化されているサーバーはスキップ
      if (serverConfig.disabled) {
        continue;
      }

      claudeCodeConfig.mcpServers[name] = this.normalizeMCPServerConfig(serverConfig);
    }

    return claudeCodeConfig;
  }

  /**
   * Claude Code設定からマスター設定に変換
   */
  convertToMaster(toolConfig: unknown): MasterConfig {
    const claudeCodeConfig = toolConfig as ClaudeCodeConfig;
    
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
    if (claudeCodeConfig.mcpServers) {
      for (const [name, serverConfig] of Object.entries(claudeCodeConfig.mcpServers)) {
        masterConfig.mcpServers[name] = {
          ...this.normalizeMCPServerConfig(serverConfig),
          metadata: {
            description: `Imported from Claude Code`,
          },
        };
      }
    }

    return masterConfig;
  }

  /**
   * デフォルト設定を取得
   */
  protected getDefaultConfig(): ClaudeCodeConfig {
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

    const claudeCodeConfig = config as Record<string, unknown>;

    // mcpServersフィールドの検証
    if (!claudeCodeConfig.mcpServers) {
      errors.push(this.createValidationError('mcpServers', 'mcpServers field is required'));
      return { valid: false, errors };
    }

    if (typeof claudeCodeConfig.mcpServers !== 'object' || claudeCodeConfig.mcpServers === null) {
      errors.push(this.createValidationError('mcpServers', 'mcpServers must be an object'));
      return { valid: false, errors };
    }

    // 各サーバー設定の検証
    const servers = claudeCodeConfig.mcpServers as Record<string, unknown>;
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
    const claudeCodeConfig = config as ClaudeCodeConfig;
    return claudeCodeConfig.mcpServers || {};
  }

  /**
   * 設定ファイルに書き込む（Claude Code固有の処理）
   */
  async writeConfig(config: unknown): Promise<void> {
    const claudeCodeConfig = config as ClaudeCodeConfig;
    
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
      mcpServers: claudeCodeConfig.mcpServers,
    };

    await super.writeConfig(mergedConfig);
  }
}