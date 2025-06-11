import { BaseConverter } from './BaseConverter';
import type {
  MasterConfig,
  VSCodeConfig,
  MCPServerConfig,
  ValidationResult,
} from '../types';

/**
 * VS Code用の変換器
 */
export class VSCodeConverter extends BaseConverter {
  constructor() {
    super('vscode');
  }

  /**
   * マスター設定からVS Code設定に変換
   */
  convertFromMaster(masterConfig: MasterConfig): VSCodeConfig {
    const vscodeConfig: VSCodeConfig = {};

    // MCPサーバー設定を変換
    const mcpServers: Record<string, MCPServerConfig> = {};
    
    for (const [name, serverConfig] of Object.entries(masterConfig.mcpServers)) {
      // 無効化されているサーバーはスキップ
      if (serverConfig.disabled) {
        continue;
      }

      mcpServers[name] = this.normalizeMCPServerConfig(serverConfig);
    }

    // VS Codeの設定形式に合わせる
    if (Object.keys(mcpServers).length > 0) {
      vscodeConfig['mcp.servers'] = mcpServers;
    }

    return vscodeConfig;
  }

  /**
   * VS Code設定からマスター設定に変換
   */
  convertToMaster(toolConfig: unknown): MasterConfig {
    const vscodeConfig = toolConfig as VSCodeConfig;
    
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
    const mcpServers = vscodeConfig['mcp.servers'];
    if (mcpServers && typeof mcpServers === 'object') {
      for (const [name, serverConfig] of Object.entries(mcpServers)) {
        if (this.isValidMCPServerConfig(serverConfig)) {
          masterConfig.mcpServers[name] = {
            ...this.normalizeMCPServerConfig(serverConfig),
            metadata: {
              description: `Imported from VS Code`,
            },
          };
        }
      }
    }

    return masterConfig;
  }

  /**
   * デフォルト設定を取得
   */
  protected getDefaultConfig(): VSCodeConfig {
    return {};
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

    const vscodeConfig = config as Record<string, unknown>;

    // mcp.serversフィールドの検証（オプション）
    if (vscodeConfig['mcp.servers'] !== undefined) {
      if (typeof vscodeConfig['mcp.servers'] !== 'object' || vscodeConfig['mcp.servers'] === null) {
        errors.push(this.createValidationError('mcp.servers', 'mcp.servers must be an object'));
        return { valid: false, errors };
      }

      // 各サーバー設定の検証
      const servers = vscodeConfig['mcp.servers'] as Record<string, unknown>;
      for (const [name, serverConfig] of Object.entries(servers)) {
        if (!this.isValidMCPServerConfig(serverConfig)) {
          errors.push(
            this.createValidationError(
              `mcp.servers.${name}`,
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
    const vscodeConfig = config as VSCodeConfig;
    const mcpServers = vscodeConfig['mcp.servers'];
    
    if (mcpServers && typeof mcpServers === 'object') {
      const servers: Record<string, MCPServerConfig> = {};
      for (const [name, serverConfig] of Object.entries(mcpServers)) {
        if (this.isValidMCPServerConfig(serverConfig)) {
          servers[name] = serverConfig;
        }
      }
      return servers;
    }
    
    return {};
  }

  /**
   * 設定ファイルに書き込む（VS Code固有の処理）
   */
  async writeConfig(config: unknown): Promise<void> {
    const vscodeConfig = config as VSCodeConfig;
    
    // 既存の設定を読み込む
    let existingConfig: Record<string, unknown> = {};
    try {
      existingConfig = await this.readConfig() as Record<string, unknown>;
    } catch {
      // ファイルが存在しない場合は空のオブジェクトを使用
    }

    // MCP設定を更新または削除
    if (vscodeConfig['mcp.servers'] && Object.keys(vscodeConfig['mcp.servers']).length > 0) {
      existingConfig['mcp.servers'] = vscodeConfig['mcp.servers'];
    } else {
      // サーバーがない場合は設定を削除
      delete existingConfig['mcp.servers'];
    }

    await super.writeConfig(existingConfig);
  }
}