import { BaseConverter } from './BaseConverter';
import type {
  MasterConfig,
  CursorConfig,
  MCPServerConfig,
  ValidationResult,
} from '../types';

/**
 * Cursor用の変換器
 */
export class CursorConverter extends BaseConverter {
  constructor() {
    super('cursor');
  }

  /**
   * マスター設定からCursor設定に変換
   */
  convertFromMaster(masterConfig: MasterConfig): CursorConfig {
    const cursorConfig: CursorConfig = {
      mcpServers: {},
    };

    // MCPサーバー設定を変換
    for (const [name, serverConfig] of Object.entries(masterConfig.mcpServers)) {
      // 無効化されているサーバーはスキップ
      if (serverConfig.disabled) {
        continue;
      }

      if (cursorConfig.mcpServers) {
        cursorConfig.mcpServers[name] = this.normalizeMCPServerConfig(serverConfig);
      }
    }

    return cursorConfig;
  }

  /**
   * Cursor設定からマスター設定に変換
   */
  convertToMaster(toolConfig: unknown): MasterConfig {
    const cursorConfig = toolConfig as CursorConfig;
    
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
    if (cursorConfig.mcpServers) {
      for (const [name, serverConfig] of Object.entries(cursorConfig.mcpServers)) {
        masterConfig.mcpServers[name] = {
          ...this.normalizeMCPServerConfig(serverConfig),
          metadata: {
            description: `Imported from Cursor`,
          },
        };
      }
    }

    return masterConfig;
  }

  /**
   * デフォルト設定を取得
   */
  protected getDefaultConfig(): CursorConfig {
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

    const cursorConfig = config as Record<string, unknown>;

    // mcpServersフィールドは必須ではない（Cursorは他の設定も含む可能性があるため）
    if (cursorConfig.mcpServers !== undefined) {
      if (typeof cursorConfig.mcpServers !== 'object' || cursorConfig.mcpServers === null) {
        errors.push(this.createValidationError('mcpServers', 'mcpServers must be an object'));
        return { valid: false, errors };
      }

      // 各サーバー設定の検証
      const servers = cursorConfig.mcpServers as Record<string, unknown>;
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
    const cursorConfig = config as CursorConfig;
    return cursorConfig.mcpServers || {};
  }

  /**
   * 設定ファイルに書き込む（Cursor固有の処理）
   */
  async writeConfig(config: unknown): Promise<void> {
    const cursorConfig = config as CursorConfig;
    
    // 既存の設定を読み込む
    let existingConfig: Record<string, unknown> = {};
    try {
      existingConfig = await this.readConfig() as Record<string, unknown>;
    } catch {
      // ファイルが存在しない場合は空のオブジェクトを使用
    }

    // 他の設定を保持しながらMCP設定を更新
    const mergedConfig = {
      ...existingConfig,
      mcpServers: cursorConfig.mcpServers,
    };

    await super.writeConfig(mergedConfig);
  }
}