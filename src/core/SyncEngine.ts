import type { ConfigManager } from './ConfigManager';
import type { BackupManager } from './BackupManager';
import { ClaudeDesktopConverter } from '../converters/ClaudeDesktopConverter';
import { ClineConverter } from '../converters/ClineConverter';
import { RooCodeConverter } from '../converters/RooCodeConverter';
import { CursorConverter } from '../converters/CursorConverter';
import { VSCodeConverter } from '../converters/VSCodeConverter';
import type { BaseConverter } from '../converters/BaseConverter';
import { Logger } from '../utils/Logger';
import type {
  MasterConfig,
  ToolType,
  SyncOptions,
  SyncResult,
} from '../types';

/**
 * 同期エンジン
 */
export class SyncEngine {
  private configManager: ConfigManager;
  private backupManager: BackupManager;
  private converters: Map<ToolType, BaseConverter>;

  constructor(configManager: ConfigManager, backupManager: BackupManager) {
    this.configManager = configManager;
    this.backupManager = backupManager;
    
    // 変換器を初期化
    this.converters = new Map<ToolType, BaseConverter>();
    this.converters.set('claude', new ClaudeDesktopConverter());
    this.converters.set('cline', new ClineConverter());
    this.converters.set('roo', new RooCodeConverter());
    this.converters.set('cursor', new CursorConverter());
    this.converters.set('vscode', new VSCodeConverter());
  }

  /**
   * マスター設定から各ツールに同期
   */
  async syncFromMaster(options: SyncOptions = {}): Promise<SyncResult[]> {
    Logger.startTask('Syncing from master config');
    
    const results: SyncResult[] = [];
    const masterConfig = await this.configManager.loadConfig();
    
    // 同期対象のツールを決定
    const tools = options.tools || this.getEnabledTools(masterConfig);
    
    for (const tool of tools) {
      const result = await this.syncToolFromMaster(tool, masterConfig, options);
      results.push(result);
    }
    
    Logger.endTask('Syncing from master config', results.every(r => r.success));
    return results;
  }

  /**
   * 特定のツールから他のツールに同期
   */
  async syncFromTool(sourceTool: ToolType, options: SyncOptions = {}): Promise<SyncResult[]> {
    Logger.startTask(`Syncing from ${sourceTool}`);
    
    const results: SyncResult[] = [];
    const converter = this.converters.get(sourceTool);
    
    if (!converter) {
      throw new Error(`Unknown tool: ${sourceTool}`);
    }
    
    try {
      // ソースツールの設定を読み込み
      const toolConfig = await converter.readConfig();
      const masterConfig = converter.convertToMaster(toolConfig);
      
      // マスター設定を保存
      await this.configManager.saveConfig(masterConfig);
      
      // 他のツールに同期
      const targetTools = (options.tools || Array.from(this.converters.keys()))
        .filter(tool => tool !== sourceTool);
      
      for (const tool of targetTools) {
        const result = await this.syncToolFromMaster(tool, masterConfig, options);
        results.push(result);
      }
    } catch (error) {
      Logger.error(`Failed to sync from ${sourceTool}`, error as Error);
      results.push({
        success: false,
        tool: sourceTool,
        error: (error as Error).message,
      });
    }
    
    Logger.endTask(`Syncing from ${sourceTool}`, results.every(r => r.success));
    return results;
  }

  /**
   * 単一のツールをマスター設定から同期
   */
  private async syncToolFromMaster(
    tool: ToolType,
    masterConfig: MasterConfig,
    options: SyncOptions,
  ): Promise<SyncResult> {
    const converter = this.converters.get(tool);
    
    if (!converter) {
      return {
        success: false,
        tool,
        error: `Unknown tool: ${tool}`,
      };
    }
    
    try {
      // ドライランモード
      if (options.dryRun) {
        Logger.info(`[DRY RUN] Would sync ${tool}`);
        const toolConfig = converter.convertFromMaster(masterConfig);
        const existingConfig = await converter.readConfig();
        const changes = converter.detectChanges(existingConfig, toolConfig);
        
        return {
          success: true,
          tool,
          addedServers: changes.added.length,
          modifiedServers: changes.modified.length,
          removedServers: changes.removed.length,
        };
      }
      
      // バックアップを作成
      if (!options.skipBackup && masterConfig.globalSettings.backupEnabled) {
        await this.backupManager.createBackup(tool, converter.getConfigPath());
      }
      
      // 既存の設定を読み込み
      const existingConfig = await converter.readConfig();
      
      // マスター設定から変換
      const newConfig = converter.convertFromMaster(masterConfig);
      
      // 変更を検出
      const changes = converter.detectChanges(existingConfig, newConfig);
      
      // 設定を書き込み
      await converter.writeConfig(newConfig);
      
      Logger.success(`Synced ${tool}`, {
        added: changes.added.length,
        modified: changes.modified.length,
        removed: changes.removed.length,
      });
      
      return {
        success: true,
        tool,
        addedServers: changes.added.length,
        modifiedServers: changes.modified.length,
        removedServers: changes.removed.length,
      };
    } catch (error) {
      Logger.error(`Failed to sync ${tool}`, error as Error);
      return {
        success: false,
        tool,
        error: (error as Error).message,
      };
    }
  }

  /**
   * 設定の差分を検出
   */
  async detectDifferences(tool?: ToolType): Promise<Map<ToolType, {
    added: string[];
    modified: string[];
    removed: string[];
  }>> {
    const masterConfig = await this.configManager.loadConfig();
    const differences = new Map<ToolType, {
      added: string[];
      modified: string[];
      removed: string[];
    }>();
    
    const tools = tool ? [tool] : Array.from(this.converters.keys());
    
    for (const t of tools) {
      const converter = this.converters.get(t);
      if (!converter) continue;
      
      try {
        const existingConfig = await converter.readConfig();
        const newConfig = converter.convertFromMaster(masterConfig);
        const changes = converter.detectChanges(existingConfig, newConfig);
        differences.set(t, changes);
      } catch (error) {
        Logger.warn(`Failed to detect differences for ${t}`, { error });
      }
    }
    
    return differences;
  }

  /**
   * 設定を検証
   */
  async validateConfigs(): Promise<Map<ToolType, boolean>> {
    const validationResults = new Map<ToolType, boolean>();
    
    for (const [tool, converter] of this.converters) {
      try {
        const config = await converter.readConfig();
        const result = converter.validateConfig(config);
        validationResults.set(tool, result.valid);
        
        if (!result.valid) {
          Logger.warn(`Invalid config for ${tool}`, { errors: result.errors });
        }
      } catch (error) {
        Logger.error(`Failed to validate ${tool}`, error as Error);
        validationResults.set(tool, false);
      }
    }
    
    return validationResults;
  }

  /**
   * 競合を検出
   */
  async detectConflicts(): Promise<Map<string, ToolType[]>> {
    const serverOwnership = new Map<string, ToolType[]>();
    
    for (const [tool, converter] of this.converters) {
      try {
        const config = await converter.readConfig();
        const servers = converter.extractMCPServers(config);
        
        for (const serverName of Object.keys(servers)) {
          if (!serverOwnership.has(serverName)) {
            serverOwnership.set(serverName, []);
          }
          serverOwnership.get(serverName)?.push(tool);
        }
      } catch (error) {
        Logger.debug(`Failed to read config for ${tool}`, { error });
      }
    }
    
    // 複数のツールで定義されているサーバーのみを返す
    const conflicts = new Map<string, ToolType[]>();
    for (const [serverName, tools] of serverOwnership) {
      if (tools.length > 1) {
        conflicts.set(serverName, tools);
      }
    }
    
    return conflicts;
  }

  /**
   * 有効なツールを取得
   */
  private getEnabledTools(masterConfig: MasterConfig): ToolType[] {
    const allTools = Array.from(this.converters.keys());
    const excludedTools = masterConfig.globalSettings.excludeTools || [];
    return allTools.filter(tool => !excludedTools.includes(tool));
  }

  /**
   * 同期状態を取得
   */
  async getSyncStatus(): Promise<{
    inSync: boolean;
    tools: Map<ToolType, {
      exists: boolean;
      valid: boolean;
      serverCount: number;
      lastModified?: Date;
    }>;
  }> {
    const masterConfig = await this.configManager.loadConfig();
    const toolStatus = new Map<ToolType, {
      exists: boolean;
      valid: boolean;
      serverCount: number;
      lastModified?: Date;
    }>();
    
    let allInSync = true;
    
    for (const [tool, converter] of this.converters) {
      try {
        const config = await converter.readConfig();
        const validation = converter.validateConfig(config);
        const servers = converter.extractMCPServers(config);
        const expectedConfig = converter.convertFromMaster(masterConfig);
        const changes = converter.detectChanges(config, expectedConfig);
        
        const hasChanges = changes.added.length > 0 || 
                          changes.modified.length > 0 || 
                          changes.removed.length > 0;
        
        if (hasChanges) {
          allInSync = false;
        }
        
        toolStatus.set(tool, {
          exists: true,
          valid: validation.valid,
          serverCount: Object.keys(servers).length,
        });
      } catch (error) {
        allInSync = false;
        toolStatus.set(tool, {
          exists: false,
          valid: false,
          serverCount: 0,
        });
      }
    }
    
    return {
      inSync: allInSync,
      tools: toolStatus,
    };
  }
}