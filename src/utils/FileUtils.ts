import fs from 'fs-extra';
import path from 'path';
import { glob } from 'glob';

/**
 * ファイル操作ユーティリティ
 */
export class FileUtils {
  /**
   * ファイルが存在するかチェック
   */
  static async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * JSONファイルを読み込む
   */
  static async readJson<T>(filePath: string): Promise<T> {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  }

  /**
   * JSONファイルを書き込む
   */
  static async writeJson<T>(filePath: string, data: T, pretty = true): Promise<void> {
    const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content, 'utf-8');
  }

  /**
   * ファイルをコピー
   */
  static async copy(src: string, dest: string): Promise<void> {
    await fs.ensureDir(path.dirname(dest));
    await fs.copy(src, dest);
  }

  /**
   * ファイルを移動
   */
  static async move(src: string, dest: string): Promise<void> {
    await fs.ensureDir(path.dirname(dest));
    await fs.move(src, dest);
  }

  /**
   * ファイルを削除
   */
  static async remove(filePath: string): Promise<void> {
    await fs.remove(filePath);
  }

  /**
   * ディレクトリを作成
   */
  static async ensureDir(dirPath: string): Promise<void> {
    await fs.ensureDir(dirPath);
  }

  /**
   * ファイル情報を取得
   */
  static async stat(filePath: string): Promise<fs.Stats> {
    return fs.stat(filePath);
  }

  /**
   * ディレクトリ内のファイルを検索
   */
  static async findFiles(pattern: string, options?: Record<string, unknown>): Promise<string[]> {
    return glob(pattern, options || {});
  }

  /**
   * ファイルの内容を読み込む
   */
  static async readFile(filePath: string): Promise<string> {
    return fs.readFile(filePath, 'utf-8');
  }

  /**
   * ファイルに内容を書き込む
   */
  static async writeFile(filePath: string, content: string): Promise<void> {
    await fs.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content, 'utf-8');
  }

  /**
   * ファイルのバックアップを作成
   */
  static async createBackup(filePath: string, backupPath: string): Promise<void> {
    if (await this.exists(filePath)) {
      await this.copy(filePath, backupPath);
    }
  }

  /**
   * 一時ファイルを作成
   */
  static async createTempFile(prefix: string, content: string): Promise<string> {
    const tempDir = path.join(process.cwd(), '.mcp-sync', 'temp');
    await this.ensureDir(tempDir);
    const tempPath = path.join(tempDir, `${prefix}-${Date.now()}.json`);
    await this.writeFile(tempPath, content);
    return tempPath;
  }

  /**
   * ファイルの権限をチェック
   */
  static async isWritable(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath, fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * ファイルの権限を設定
   */
  static async chmod(filePath: string, mode: string | number): Promise<void> {
    await fs.chmod(filePath, mode);
  }
}