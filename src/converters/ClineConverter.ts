import { BaseConverter } from './BaseConverter';
import type {
  MasterConfig,
  ClineConfig,
  MCPServerConfig,
  ValidationResult,
} from '../types';

/**
 * Cline用の変換器
 */
export class ClineConverter extends BaseConverter {
  constructor() {
    super('cline');
  }

  /**
   * マスター設定からCline設定に変換
   */
  convertFromMaster(masterConfig: MasterConfig): ClineConfig {
    const clineConfig: ClineConfig = {
      mcpServers: {},
    };

    // MCPサーバー設定を変換
    for (const [name, serverConfig] of Object.entries(masterConfig.mcpServers)) {
      // 無効化されているサーバーはスキップ
      if (serverConfig.disabled) {
        continue;
      }

      clineConfig.mcpServers[name] = this.normalizeMCPServerConfig(serverConfig);
    }

    return clineConfig;
  }

  /**
   * Cline設定からマスター設定に変換
   */
  convertToMaster(toolConfig: unknown): MasterConfig {
    const clineConfig = toolConfig as ClineConfig;
    
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
    if (clineConfig.mcpServers) {
      for (const [name, serverConfig] of Object.entries(clineConfig.mcpServers)) {
        masterConfig.mcpServers[name] = {
          ...this.normalizeMCPServerConfig(serverConfig),
          metadata: {
            description: `Imported from Cline`,
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

    const clineConfig = config as Record<string, unknown>;

    // mcpServersフィールドの検証
    if (!clineConfig.mcpServers) {
      errors.push(this.createValidationError('mcpServers', 'mcpServers field is required'));
      return { valid: false, errors };
    }

    if (typeof clineConfig.mcpServers !== 'object' || clineConfig.mcpServers === null) {
      errors.push(this.createValidationError('mcpServers', 'mcpServers must be an object'));
      return { valid: false, errors };
    }

    // 各サーバー設定の検証
    const servers = clineConfig.mcpServers as Record<string, unknown>;
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
    const clineConfig = config as ClineConfig;
    return clineConfig.mcpServers || {};
  }
}