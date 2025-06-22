import path from 'path';
import { FileUtils } from '../utils/FileUtils';
import { PathResolver } from '../utils/PathResolver';
import { Logger } from '../utils/Logger';
import type { BackupInfo, ToolType } from '../types';

/**
 * バックアップマネージャー
 */
export class BackupManager {
  private backupDir: string;
  private maxBackups: number;

  constructor(backupDir?: string, maxBackups = 10) {
    this.backupDir = backupDir || PathResolver.getBackupDir();
    this.maxBackups = maxBackups;
  }

  /**
   * バックアップディレクトリを初期化
   */
  async initialize(): Promise<void> {
    await FileUtils.ensureDir(this.backupDir);
    Logger.debug('Backup directory initialized', { backupDir: this.backupDir });
  }

  /**
   * バックアップファイル名を生成
   */
  private generateBackupFileName(tool: ToolType, originalPath: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseName = path.basename(originalPath, path.extname(originalPath));
    return `${tool}-${baseName}-${timestamp}.json`;
  }

  /**
   * バックアップを作成
   */
  async createBackup(tool: ToolType, filePath: string): Promise<BackupInfo | null> {
    try {
      const expandedPath = PathResolver.expand(filePath);
      
      // ファイルが存在しない場合はバックアップ不要
      if (!(await FileUtils.exists(expandedPath))) {
        Logger.debug('File does not exist, skipping backup', { filePath: expandedPath });
        return null;
      }

      // バックアップファイル名を生成
      const backupFileName = this.generateBackupFileName(tool, expandedPath);
      const backupPath = path.join(this.backupDir, tool, backupFileName);

      // バックアップディレクトリを作成
      await FileUtils.ensureDir(path.dirname(backupPath));

      // ファイルをコピー
      await FileUtils.copy(expandedPath, backupPath);

      // ファイル情報を取得
      const stats = await FileUtils.stat(backupPath);

      const backupInfo: BackupInfo = {
        id: backupFileName,
        timestamp: new Date().toISOString(),
        tool,
        originalPath: expandedPath,
        backupPath,
        size: stats.size,
      };

      Logger.success(`Backup created for ${tool}`, { backupPath });
      
      // 古いバックアップを削除
      await this.cleanupOldBackups(tool);

      return backupInfo;
    } catch (error) {
      Logger.error(`Failed to create backup for ${tool}`, error as Error);
      throw error;
    }
  }

  /**
   * バックアップを復元
   */
  async restoreBackup(backupInfo: BackupInfo): Promise<void> {
    try {
      // バックアップファイルが存在するか確認
      if (!(await FileUtils.exists(backupInfo.backupPath))) {
        throw new Error(`Backup file not found: ${backupInfo.backupPath}`);
      }

      // 元のファイルのディレクトリを作成
      await FileUtils.ensureDir(path.dirname(backupInfo.originalPath));

      // ファイルを復元
      await FileUtils.copy(backupInfo.backupPath, backupInfo.originalPath);

      Logger.success(`Backup restored for ${backupInfo.tool}`, {
        from: backupInfo.backupPath,
        to: backupInfo.originalPath,
      });
    } catch (error) {
      Logger.error(`Failed to restore backup for ${backupInfo.tool}`, error as Error);
      throw error;
    }
  }

  /**
   * バックアップ一覧を取得
   */
  async listBackups(tool?: ToolType): Promise<BackupInfo[]> {
    try {
      const backups: BackupInfo[] = [];
      const tools = tool ? [tool] : ['claude', 'cline', 'roo', 'cursor', 'vscode', 'claude-code'] as ToolType[];

      for (const t of tools) {
        const toolBackupDir = path.join(this.backupDir, t);
        
        if (!(await FileUtils.exists(toolBackupDir))) {
          continue;
        }

        const files = await FileUtils.findFiles(path.join(toolBackupDir, '*.json'));
        
        for (const file of files) {
          const stats = await FileUtils.stat(file);
          const fileName = path.basename(file);
          
          // ファイル名からタイムスタンプを抽出
          const timestampMatch = fileName.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/);
          const timestamp = timestampMatch
            ? timestampMatch[1].replace(/-/g, ':').replace('T', 'T').replace('Z', 'Z')
            : stats.mtime.toISOString();

          backups.push({
            id: fileName,
            timestamp,
            tool: t,
            originalPath: this.getOriginalPath(t),
            backupPath: file,
            size: stats.size,
          });
        }
      }

      // タイムスタンプで降順ソート
      return backups.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    } catch (error) {
      Logger.error('Failed to list backups', error as Error);
      throw error;
    }
  }

  /**
   * 特定のバックアップを取得
   */
  async getBackup(tool: ToolType, backupId: string): Promise<BackupInfo | null> {
    const backupPath = path.join(this.backupDir, tool, backupId);
    
    if (!(await FileUtils.exists(backupPath))) {
      return null;
    }

    const stats = await FileUtils.stat(backupPath);
    const timestampMatch = backupId.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/);
    const timestamp = timestampMatch
      ? timestampMatch[1].replace(/-/g, ':').replace('T', 'T').replace('Z', 'Z')
      : stats.mtime.toISOString();

    return {
      id: backupId,
      timestamp,
      tool,
      originalPath: this.getOriginalPath(tool),
      backupPath,
      size: stats.size,
    };
  }

  /**
   * バックアップを削除
   */
  async deleteBackup(backupInfo: BackupInfo): Promise<void> {
    try {
      await FileUtils.remove(backupInfo.backupPath);
      Logger.info(`Backup deleted: ${backupInfo.id}`);
    } catch (error) {
      Logger.error('Failed to delete backup', error as Error);
      throw error;
    }
  }

  /**
   * 古いバックアップをクリーンアップ
   */
  private async cleanupOldBackups(tool: ToolType): Promise<void> {
    try {
      const backups = await this.listBackups(tool);
      
      if (backups.length <= this.maxBackups) {
        return;
      }

      // 古い順にソート
      const sortedBackups = backups.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      
      // 削除対象のバックアップ
      const toDelete = sortedBackups.slice(0, backups.length - this.maxBackups);
      
      for (const backup of toDelete) {
        await this.deleteBackup(backup);
      }

      Logger.info(`Cleaned up ${toDelete.length} old backups for ${tool}`);
    } catch (error) {
      Logger.warn('Failed to cleanup old backups', { tool, error });
    }
  }

  /**
   * ツールの元の設定ファイルパスを取得
   */
  private getOriginalPath(tool: ToolType): string {
    return PathResolver.getToolConfigPath(tool);
  }

  /**
   * すべてのバックアップを削除
   */
  async clearAllBackups(): Promise<void> {
    try {
      await FileUtils.remove(this.backupDir);
      await this.initialize();
      Logger.info('All backups cleared');
    } catch (error) {
      Logger.error('Failed to clear all backups', error as Error);
      throw error;
    }
  }

  /**
   * バックアップの統計情報を取得
   */
  async getBackupStats(): Promise<{
    totalCount: number;
    totalSize: number;
    byTool: Record<ToolType, { count: number; size: number }>;
  }> {
    const backups = await this.listBackups();
    const stats: Record<string, { count: number; size: number }> = {};

    for (const backup of backups) {
      if (!stats[backup.tool]) {
        stats[backup.tool] = { count: 0, size: 0 };
      }
      stats[backup.tool].count++;
      stats[backup.tool].size += backup.size;
    }

    const totalSize = backups.reduce((sum, b) => sum + b.size, 0);

    return {
      totalCount: backups.length,
      totalSize,
      byTool: stats as Record<ToolType, { count: number; size: number }>,
    };
  }
}