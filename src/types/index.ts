/**
 * MCP設定同期システムの型定義
 */

/**
 * MCPサーバーの基本設定
 */
export interface MCPServerConfig {
  /** 実行コマンド */
  command: string;
  /** コマンド引数 */
  args?: string[];
  /** 環境変数 */
  env?: Record<string, string>;
  /** 無効化フラグ */
  disabled?: boolean;
  /** 常に許可するツール */
  alwaysAllow?: string[];
  /** 自動承認するツール */
  autoApprove?: string[];
  /** トランスポートタイプ */
  transport?: 'stdio' | 'sse' | 'http';
  /** サーバータイプ（SSE用） */
  type?: 'sse' | 'http' | 'stdio';
  /** URL（SSE/HTTP用） */
  url?: string;
}

/**
 * マスター設定ファイルのメタデータ
 */
export interface MCPServerMetadata {
  /** サーバーの説明 */
  description?: string;
  /** タグ */
  tags?: string[];
}

/**
 * マスター設定ファイルのサーバー設定
 */
export interface MasterMCPServerConfig extends MCPServerConfig {
  /** メタデータ */
  metadata?: MCPServerMetadata;
}

/**
 * グローバル設定
 */
export interface GlobalSettings {
  /** バックアップ有効化 */
  backupEnabled: boolean;
  /** 変更時の自動同期 */
  syncOnChange: boolean;
  /** バックアップ保持世代数 */
  backupRetentionCount?: number;
  /** 同期除外ツール */
  excludeTools?: string[];
}

/**
 * マスター設定ファイル
 */
export interface MasterConfig {
  /** バージョン */
  version: string;
  /** 最終更新日時 */
  lastUpdated: string;
  /** MCPサーバー設定 */
  mcpServers: Record<string, MasterMCPServerConfig>;
  /** グローバル設定 */
  globalSettings: GlobalSettings;
}

/**
 * ツールタイプ
 */
export type ToolType = 'claude' | 'cline' | 'roo' | 'cursor' | 'vscode' | 'claude-code';

/**
 * ツール情報
 */
export interface ToolInfo {
  /** ツール名 */
  name: ToolType;
  /** 表示名 */
  displayName: string;
  /** 設定ファイルパス */
  configPath: string;
  /** ローカル設定ファイルパス（オプション） */
  localConfigPath?: string;
}

/**
 * Claude Desktop設定
 */
export interface ClaudeDesktopConfig {
  mcpServers: Record<string, MCPServerConfig>;
  globalShortcut?: string;
}

/**
 * Cline/Roo Code設定
 */
export interface ClineConfig {
  mcpServers: Record<string, MCPServerConfig>;
}

/**
 * Claude Code設定（Claude Desktopと同じフォーマット）
 */
export type ClaudeCodeConfig = ClaudeDesktopConfig;

/**
 * Cursor設定
 */
export interface CursorConfig {
  mcpServers?: Record<string, MCPServerConfig>;
  // Cursorは他の設定も含む可能性があるため、追加フィールドを許可
  [key: string]: unknown;
}

/**
 * VS Code設定
 */
export interface VSCodeConfig {
  // VS Codeの設定は他の多くの設定を含むため、MCP設定は特定のキーに格納される
  'mcp.servers'?: Record<string, MCPServerConfig>;
  [key: string]: unknown;
}

/**
 * バックアップ情報
 */
export interface BackupInfo {
  /** バックアップID */
  id: string;
  /** タイムスタンプ */
  timestamp: string;
  /** ツール名 */
  tool: ToolType;
  /** 元のファイルパス */
  originalPath: string;
  /** バックアップファイルパス */
  backupPath: string;
  /** ファイルサイズ */
  size: number;
}

/**
 * 同期結果
 */
export interface SyncResult {
  /** 成功フラグ */
  success: boolean;
  /** ツール名 */
  tool: ToolType;
  /** エラーメッセージ */
  error?: string;
  /** 変更されたサーバー数 */
  modifiedServers?: number;
  /** 追加されたサーバー数 */
  addedServers?: number;
  /** 削除されたサーバー数 */
  removedServers?: number;
}

/**
 * 同期オプション
 */
export interface SyncOptions {
  /** 特定のツールのみ同期 */
  tools?: ToolType[];
  /** ドライラン（実際には変更しない） */
  dryRun?: boolean;
  /** バックアップをスキップ */
  skipBackup?: boolean;
  /** 強制同期（競合を無視） */
  force?: boolean;
}

/**
 * 設定検証エラー
 */
export interface ValidationError {
  /** フィールドパス */
  path: string;
  /** エラーメッセージ */
  message: string;
}

/**
 * 設定検証結果
 */
export interface ValidationResult {
  /** 有効フラグ */
  valid: boolean;
  /** エラー一覧 */
  errors: ValidationError[];
}