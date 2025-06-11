import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// テスト用の一時ディレクトリ
export const TEST_TEMP_DIR = path.join(os.tmpdir(), 'mcp-sync-test');

// テスト前のセットアップ
beforeEach(() => {
  // テスト用ディレクトリの作成
  if (!fs.existsSync(TEST_TEMP_DIR)) {
    fs.mkdirSync(TEST_TEMP_DIR, { recursive: true });
  }
});

// テスト後のクリーンアップ
afterEach(() => {
  // テスト用ディレクトリの削除
  if (fs.existsSync(TEST_TEMP_DIR)) {
    fs.rmSync(TEST_TEMP_DIR, { recursive: true, force: true });
  }
});

// グローバルなモック設定
jest.mock('../utils/Logger', () => ({
  Logger: {
    getInstance: jest.fn().mockReturnValue({
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      success: jest.fn(),
    }),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    success: jest.fn(),
  },
}));