#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { ConfigManager } from '../core/ConfigManager';
import { BackupManager } from '../core/BackupManager';
import { SyncEngine } from '../core/SyncEngine';
import { Logger } from '../utils/Logger';
import { PathResolver } from '../utils/PathResolver';
import { formatError } from '../utils/ErrorMessages';
import type { ToolType, SyncOptions } from '../types';

const program = new Command();

// バージョン情報
program
  .name('mcp-sync')
  .description('Sync MCP settings across multiple AI coding tools')
  .version('0.1.0');

// 初期化コマンド
program
  .command('init')
  .description('Initialize MCP sync configuration')
  .option('-f, --force', 'Force initialization even if config exists')
  .action(async (options: { force?: boolean }) => {
    try {
      const configManager = new ConfigManager();
      
      if (await configManager.exists() && !options.force) {
        console.log(chalk.yellow('Configuration already exists. Use --force to reinitialize.'));
        return;
      }
      
      await configManager.initialize();
      console.log(chalk.green('✅ MCP sync initialized successfully'));
      console.log(chalk.gray(`Configuration file: ${PathResolver.getMasterConfigPath()}`));
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize:'), error);
      process.exit(1);
    }
  });

// 同期コマンド
program
  .command('sync')
  .description('Sync MCP settings to all or specific tools')
  .option('-t, --tool <tools...>', 'Sync only specific tools (claude, claude-code, cline, roo, cursor, vscode)')
  .option('-s, --source <tool>', 'Use specific tool as source instead of master config')
  .option('-d, --dry-run', 'Show what would be changed without making actual changes')
  .option('--skip-backup', 'Skip creating backups before sync')
  .option('-f, --force', 'Force sync even if there are conflicts')
  .action(async (options: {
    tool?: string[];
    source?: string;
    dryRun?: boolean;
    skipBackup?: boolean;
    force?: boolean;
  }) => {
    try {
      const configManager = new ConfigManager();
      const backupManager = new BackupManager();
      const syncEngine = new SyncEngine(configManager, backupManager);
      
      await configManager.initialize();
      await backupManager.initialize();
      
      const syncOptions: SyncOptions = {
        tools: options.tool as ToolType[] | undefined,
        dryRun: options.dryRun || false,
        skipBackup: options.skipBackup || false,
        force: options.force || false,
      };
      
      let results;
      if (options.source) {
        console.log(chalk.blue(`🔄 Syncing from ${options.source}...`));
        results = await syncEngine.syncFromTool(options.source as ToolType, syncOptions);
      } else {
        console.log(chalk.blue('🔄 Syncing from master config...'));
        results = await syncEngine.syncFromMaster(syncOptions);
      }
      
      // 結果を表示
      for (const result of results) {
        if (result.success) {
          console.log(chalk.green(`✅ ${result.tool}: Success`));
          if (result.addedServers) {
            console.log(chalk.gray(`   Added: ${result.addedServers} servers`));
          }
          if (result.modifiedServers) {
            console.log(chalk.gray(`   Modified: ${result.modifiedServers} servers`));
          }
          if (result.removedServers) {
            console.log(chalk.gray(`   Removed: ${result.removedServers} servers`));
          }
        } else {
          console.log(chalk.red(`❌ ${result.tool}: ${result.error}`));
        }
      }
      
      if (options.dryRun) {
        console.log(chalk.yellow('\n⚠️  This was a dry run. No changes were made.'));
      }
    } catch (error) {
      console.error(chalk.red('❌ Sync failed:'), error);
      process.exit(1);
    }
  });

// バックアップコマンド
program
  .command('backup')
  .description('Create backups of current configurations')
  .option('-t, --tool <tools...>', 'Backup only specific tools')
  .action(async (options: { tool?: string[] }) => {
    try {
      const backupManager = new BackupManager();
      await backupManager.initialize();
      
      const tools = options.tool as ToolType[] || ['claude', 'claude-code', 'cline', 'roo', 'cursor', 'vscode'] as ToolType[];
      
      console.log(chalk.blue('📦 Creating backups...'));
      
      for (const tool of tools) {
        try {
          const backupInfo = await backupManager.createBackup(tool, PathResolver.getToolConfigPath(tool));
          if (backupInfo) {
            console.log(chalk.green(`✅ ${tool}: Backup created`));
          } else {
            console.log(chalk.gray(`⏭️  ${tool}: No config file found`));
          }
        } catch (error) {
          console.log(chalk.red(`❌ ${tool}: Failed to backup`));
        }
      }
    } catch (error) {
      console.error(chalk.red('❌ Backup failed:'), error);
      process.exit(1);
    }
  });

// 復元コマンド
program
  .command('restore')
  .description('Restore configuration from backup')
  .requiredOption('-t, --tool <tool>', 'Tool to restore')
  .option('-i, --id <backupId>', 'Specific backup ID to restore')
  .option('-l, --list', 'List available backups')
  .action(async (options: {
    tool: string;
    id?: string;
    list?: boolean;
  }) => {
    try {
      const backupManager = new BackupManager();
      await backupManager.initialize();
      
      const tool = options.tool as ToolType;
      
      if (options.list) {
        const backups = await backupManager.listBackups(tool);
        if (backups.length === 0) {
          console.log(chalk.yellow(`No backups found for ${tool}`));
          return;
        }
        
        console.log(chalk.blue(`Available backups for ${tool}:`));
        for (const backup of backups) {
          const date = new Date(backup.timestamp).toLocaleString();
          console.log(`  ${backup.id} - ${date} (${backup.size} bytes)`);
        }
        return;
      }
      
      let backupToRestore;
      if (options.id) {
        backupToRestore = await backupManager.getBackup(tool, options.id);
        if (!backupToRestore) {
          console.error(chalk.red(`Backup not found: ${options.id}`));
          process.exit(1);
        }
      } else {
        const backups = await backupManager.listBackups(tool);
        if (backups.length === 0) {
          console.error(chalk.red(`No backups found for ${tool}`));
          process.exit(1);
        }
        backupToRestore = backups[0]; // 最新のバックアップ
      }
      
      await backupManager.restoreBackup(backupToRestore);
      console.log(chalk.green(`✅ Restored ${tool} from backup: ${backupToRestore.id}`));
    } catch (error) {
      console.error(chalk.red('❌ Restore failed:'), error);
      process.exit(1);
    }
  });

// ステータスコマンド
program
  .command('status')
  .description('Show sync status and configuration info')
  .action(async () => {
    try {
      const configManager = new ConfigManager();
      const backupManager = new BackupManager();
      const syncEngine = new SyncEngine(configManager, backupManager);
      
      await configManager.initialize();
      
      // マスター設定の統計
      const stats = configManager.getStats();
      console.log(chalk.blue('📊 Master Configuration:'));
      console.log(`   Total servers: ${stats.serverCount}`);
      console.log(`   Enabled: ${stats.enabledServerCount}`);
      console.log(`   Disabled: ${stats.disabledServerCount}`);
      
      // 同期状態
      const syncStatus = await syncEngine.getSyncStatus();
      console.log(chalk.blue('\n🔄 Sync Status:'));
      console.log(`   In sync: ${syncStatus.inSync ? chalk.green('Yes') : chalk.yellow('No')}`);
      
      console.log(chalk.blue('\n📱 Tool Status:'));
      for (const [tool, status] of syncStatus.tools) {
        const statusIcon = status.exists ? (status.valid ? '✅' : '⚠️ ') : '❌';
        console.log(`   ${statusIcon} ${tool}:`);
        console.log(`      Exists: ${status.exists ? 'Yes' : 'No'}`);
        if (status.exists) {
          console.log(`      Valid: ${status.valid ? 'Yes' : 'No'}`);
          console.log(`      Servers: ${status.serverCount}`);
        }
      }
      
      // 競合検出
      const conflicts = await syncEngine.detectConflicts();
      if (conflicts.size > 0) {
        console.log(chalk.yellow('\n⚠️  Conflicts detected:'));
        for (const [serverName, tools] of conflicts) {
          console.log(`   ${serverName}: defined in ${tools.join(', ')}`);
        }
      }
      
      // バックアップ統計
      const backupStats = await backupManager.getBackupStats();
      console.log(chalk.blue('\n💾 Backup Statistics:'));
      console.log(`   Total backups: ${backupStats.totalCount}`);
      console.log(`   Total size: ${(backupStats.totalSize / 1024).toFixed(2)} KB`);
    } catch (error) {
      console.error(chalk.red('❌ Failed to get status:'), error);
      process.exit(1);
    }
  });

// 編集コマンド
program
  .command('edit')
  .description('Open master config file in default editor')
  .action(async () => {
    try {
      const configPath = PathResolver.getMasterConfigPath();
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);
      
      // エディタを開く
      const editor = process.env.EDITOR || 'nano';
      console.log(chalk.blue(`Opening ${configPath} in ${editor}...`));
      
      await execAsync(`${editor} "${configPath}"`);
      console.log(chalk.green('✅ Editor closed'));
    } catch (error) {
      console.error(chalk.red('❌ Failed to open editor:'), error);
      process.exit(1);
    }
  });

// ログレベル設定
program.option('-v, --verbose', 'Enable verbose logging');
program.option('-q, --quiet', 'Suppress all but error messages');

// パース前にログレベルを設定
program.hook('preAction', (thisCommand) => {
  const options = thisCommand.opts();
  if (options.verbose) {
    Logger.setLevel('debug');
  } else if (options.quiet) {
    Logger.setLevel('error');
  } else {
    Logger.setLevel('info');
  }
});

// エラーハンドリング
program.exitOverride();

try {
  program.parse(process.argv);
} catch (error) {
  if (error instanceof Error) {
    const errorWithCode = error as Error & { code?: string };
    if (errorWithCode.code === 'commander.help') {
      process.exit(0);
    }
    Logger.error('Command execution failed', error);
    console.error(chalk.red('Error:'), formatError(error));
  } else {
    Logger.error('Command execution failed', error);
    console.error(chalk.red('Error:'), formatError(error));
  }
  process.exit(1);
}

// 引数がない場合はヘルプを表示
if (!process.argv.slice(2).length) {
  program.outputHelp();
}