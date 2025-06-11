/**
 * 統一されたエラーメッセージ
 */
export const ErrorMessages = {
  // ファイル関連
  FILE_NOT_FOUND: (path: string) => `ファイルが見つかりません: ${path}`,
  FILE_READ_ERROR: (path: string) => `ファイルの読み込みに失敗しました: ${path}`,
  FILE_WRITE_ERROR: (path: string) => `ファイルの書き込みに失敗しました: ${path}`,
  INVALID_JSON: (path: string) => `無効なJSON形式です: ${path}`,
  
  // 設定関連
  CONFIG_NOT_FOUND: (tool: string) => `${tool}の設定ファイルが見つかりません`,
  CONFIG_INVALID: (tool: string) => `${tool}の設定が無効です`,
  CONFIG_PARSE_ERROR: (tool: string) => `${tool}の設定の解析に失敗しました`,
  
  // 同期関連
  SYNC_FAILED: (tool: string) => `${tool}への同期に失敗しました`,
  SYNC_CONFLICT: (server: string) => `サーバー「${server}」の設定に競合があります`,
  NO_MASTER_CONFIG: 'マスター設定が初期化されていません。先に "mcp-sync init" を実行してください',
  
  // バックアップ関連
  BACKUP_FAILED: 'バックアップの作成に失敗しました',
  RESTORE_FAILED: 'バックアップの復元に失敗しました',
  NO_BACKUPS: 'バックアップが見つかりません',
  INVALID_BACKUP_ID: (id: string) => `無効なバックアップID: ${id}`,
  
  // 検証関連
  VALIDATION_FAILED: (errors: string[]) => 
    `設定の検証に失敗しました:\n${errors.map(e => `  - ${e}`).join('\n')}`,
  REQUIRED_FIELD_MISSING: (field: string) => `必須フィールドが不足しています: ${field}`,
  INVALID_FIELD_TYPE: (field: string, expected: string, actual: string) => 
    `${field}の型が不正です。期待: ${expected}、実際: ${actual}`,
  
  // コマンド関連
  INVALID_COMMAND: (command: string) => `無効なコマンド: ${command}`,
  MISSING_ARGUMENT: (arg: string) => `必須の引数が不足しています: ${arg}`,
  
  // 一般的なエラー
  UNKNOWN_ERROR: '予期しないエラーが発生しました',
  OPERATION_CANCELLED: '操作がキャンセルされました',
} as const;

/**
 * エラーコード
 */
export enum ErrorCode {
  // ファイル関連 (1xxx)
  FILE_NOT_FOUND = 1001,
  FILE_READ_ERROR = 1002,
  FILE_WRITE_ERROR = 1003,
  INVALID_JSON = 1004,
  
  // 設定関連 (2xxx)
  CONFIG_NOT_FOUND = 2001,
  CONFIG_INVALID = 2002,
  CONFIG_PARSE_ERROR = 2003,
  
  // 同期関連 (3xxx)
  SYNC_FAILED = 3001,
  SYNC_CONFLICT = 3002,
  NO_MASTER_CONFIG = 3003,
  
  // バックアップ関連 (4xxx)
  BACKUP_FAILED = 4001,
  RESTORE_FAILED = 4002,
  NO_BACKUPS = 4003,
  INVALID_BACKUP_ID = 4004,
  
  // 検証関連 (5xxx)
  VALIDATION_FAILED = 5001,
  REQUIRED_FIELD_MISSING = 5002,
  INVALID_FIELD_TYPE = 5003,
  
  // コマンド関連 (6xxx)
  INVALID_COMMAND = 6001,
  MISSING_ARGUMENT = 6002,
  
  // 一般的なエラー (9xxx)
  UNKNOWN_ERROR = 9999,
  OPERATION_CANCELLED = 9998,
}

/**
 * カスタムエラークラス
 */
export class MCPSyncError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'MCPSyncError';
  }
}

/**
 * エラーをユーザーフレンドリーなメッセージに変換
 */
export function formatError(error: unknown): string {
  if (error instanceof MCPSyncError) {
    return error.message;
  }
  
  if (error instanceof Error) {
    // 一般的なエラーパターンをチェック
    if (error.message.includes('ENOENT')) {
      return ErrorMessages.FILE_NOT_FOUND(error.message.split("'")[1] || 'unknown');
    }
    
    if (error.message.includes('EACCES')) {
      return 'ファイルへのアクセス権限がありません';
    }
    
    if (error.message.includes('ENOSPC')) {
      return 'ディスク容量が不足しています';
    }
    
    if (error.message.includes('JSON')) {
      return ErrorMessages.INVALID_JSON('設定ファイル');
    }
    
    return error.message;
  }
  
  return ErrorMessages.UNKNOWN_ERROR;
}

/**
 * エラーの詳細情報を取得
 */
export function getErrorDetails(error: unknown): {
  code: ErrorCode;
  message: string;
  stack?: string;
  details?: unknown;
} {
  if (error instanceof MCPSyncError) {
    return {
      code: error.code,
      message: error.message,
      stack: error.stack,
      details: error.details,
    };
  }
  
  if (error instanceof Error) {
    return {
      code: ErrorCode.UNKNOWN_ERROR,
      message: error.message,
      stack: error.stack,
    };
  }
  
  return {
    code: ErrorCode.UNKNOWN_ERROR,
    message: String(error),
  };
}