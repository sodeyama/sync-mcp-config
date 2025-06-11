import { BaseConverter } from './BaseConverter';
import type {
  MasterConfig,
  ClineConfig,
  MCPServerConfig,
  ValidationResult,
} from '../types';

/**
 * Roo Code用の変換器
 * 注: Roo CodeはClineと同じ設定形式を使用
 */
export class RooCodeConverter extends BaseConverter {
  constructor() {
    super('roo');
  }

  /**
   * マスター設定からRoo Code設定に変換
   */
  convertFromMaster(masterConfig: MasterConfig): ClineConfig {
    const rooConfig: ClineConfig = {
      mcpServers: {},
    };

    // MCPサーバー設定を変換
    for (const [name, serverConfig] of Object.entries(masterConfig.mcpServers)) {
      // 無効化されているサーバーはスキップ
      if (serverConfig.disabled) {
        continue;
      }

      rooConfig.mcpServers[name] = this.normalizeMCPServerConfig(serverConfig);
    }

    return rooConfig;
  }

  /**
   * Roo Code設定からマスター設定に変換
   */
  convertToMaster(toolConfig: unknown): MasterConfig {
    const rooConfig = toolConfig as ClineConfig;
    
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
    if (rooConfig.mcpServers) {
      for (const [name, serverConfig] of Object.entries(rooConfig.mcpServers)) {
        masterConfig.mcpServers[name] = {
          ...this.normalizeMCPServerConfig(serverConfig),
          metadata: {
            description: `Imported from Roo Code`,
          },
        };
      }
    }

    return masterConfig;
  }

  /**
   * デフォルト設定を取得
   */
  protected getDefaultConfig(): ClineConfig {
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

    const rooConfig = config as Record<string, unknown>;

    // mcpServersフィールドの検証
    if (!rooConfig.mcpServers) {
      errors.push(this.createValidationError('mcpServers', 'mcpServers field is required'));
      return { valid: false, errors };
    }

    if (typeof rooConfig.mcpServers !== 'object' || rooConfig.mcpServers === null) {
      errors.push(this.createValidationError('mcpServers', 'mcpServers must be an object'));
      return { valid: false, errors };
    }

    // 各サーバー設定の検証
    const servers = rooConfig.mcpServers as Record<string, unknown>;
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
    const rooConfig = config as ClineConfig;
    return rooConfig.mcpServers || {};
  }
}