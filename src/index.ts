/**
 * MCP設定同期システム
 * 
 * このモジュールは、複数のAIコーディングツール間でMCP（Model Context Protocol）設定を
 * 同期するためのAPIを提供します。
 */

// Core exports
export { ConfigManager } from './core/ConfigManager';
export { BackupManager } from './core/BackupManager';
export { SyncEngine } from './core/SyncEngine';

// Converter exports
export { BaseConverter } from './converters/BaseConverter';
export { ClaudeDesktopConverter } from './converters/ClaudeDesktopConverter';
export { ClaudeCodeConverter } from './converters/ClaudeCodeConverter';
export { ClineConverter } from './converters/ClineConverter';
export { RooCodeConverter } from './converters/RooCodeConverter';
export { CursorConverter } from './converters/CursorConverter';
export { VSCodeConverter } from './converters/VSCodeConverter';

// Utility exports
export { FileUtils } from './utils/FileUtils';
export { PathResolver } from './utils/PathResolver';
export { Logger } from './utils/Logger';

// Type exports
export type {
  // Core types
  MCPServerConfig,
  MasterMCPServerConfig,
  MCPServerMetadata,
  GlobalSettings,
  MasterConfig,
  ToolType,
  ToolInfo,
  
  // Tool-specific configs
  ClaudeDesktopConfig,
  ClaudeCodeConfig,
  ClineConfig,
  CursorConfig,
  VSCodeConfig,
  
  // Operation types
  BackupInfo,
  SyncResult,
  SyncOptions,
  ValidationError,
  ValidationResult,
} from './types';

// Import classes for use in factory functions
import { ConfigManager as CM } from './core/ConfigManager';
import { BackupManager as BM } from './core/BackupManager';
import { SyncEngine as SE } from './core/SyncEngine';
import type { ToolType as TT, SyncResult } from './types';

/**
 * デフォルトの設定マネージャーを作成
 */
export function createConfigManager(configPath?: string): CM {
  return new CM(configPath);
}

/**
 * デフォルトのバックアップマネージャーを作成
 */
export function createBackupManager(backupDir?: string, maxBackups?: number): BM {
  return new BM(backupDir, maxBackups);
}

/**
 * デフォルトの同期エンジンを作成
 */
export function createSyncEngine(
  configManager?: CM,
  backupManager?: BM,
): SE {
  const cm = configManager || createConfigManager();
  const bm = backupManager || createBackupManager();
  return new SE(cm, bm);
}

/**
 * 簡易同期関数
 * マスター設定から全ツールに同期
 */
export async function syncAll(options?: {
  dryRun?: boolean;
  skipBackup?: boolean;
}): Promise<void> {
  const syncEngine = createSyncEngine();
  const results = await syncEngine.syncFromMaster(options);
  
  const failed = results.filter((r: SyncResult) => !r.success);
  if (failed.length > 0) {
    throw new Error(`Sync failed for: ${failed.map((r: SyncResult) => r.tool).join(', ')}`);
  }
}

/**
 * 特定のツールから同期
 */
export async function syncFrom(
  sourceTool: TT,
  options?: {
    tools?: TT[];
    dryRun?: boolean;
    skipBackup?: boolean;
  },
): Promise<void> {
  const syncEngine = createSyncEngine();
  const results = await syncEngine.syncFromTool(sourceTool, options);
  
  const failed = results.filter((r: SyncResult) => !r.success);
  if (failed.length > 0) {
    throw new Error(`Sync failed for: ${failed.map((r: SyncResult) => r.tool).join(', ')}`);
  }
}