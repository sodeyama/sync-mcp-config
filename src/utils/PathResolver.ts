import path from 'path';
import os from 'os';

/**
 * パス解決ユーティリティ
 */
export class PathResolver {
  /**
   * ホームディレクトリを展開
   */
  static expandHome(filePath: string): string {
    if (filePath.startsWith('~/')) {
      return path.join(os.homedir(), filePath.slice(2));
    }
    return filePath;
  }

  /**
   * 環境変数を展開
   */
  static expandEnv(filePath: string): string {
    return filePath.replace(/\$([A-Z_]+[A-Z0-9_]*)/g, (match, envVar: string) => {
      return process.env[envVar] || match;
    });
  }

  /**
   * パスを完全に展開（ホームディレクトリと環境変数）
   */
  static expand(filePath: string): string {
    return this.expandEnv(this.expandHome(filePath));
  }

  /**
   * 絶対パスに変換
   */
  static toAbsolute(filePath: string, basePath?: string): string {
    const expandedPath = this.expand(filePath);
    if (path.isAbsolute(expandedPath)) {
      return expandedPath;
    }
    return path.resolve(basePath || process.cwd(), expandedPath);
  }

  /**
   * 相対パスに変換
   */
  static toRelative(filePath: string, basePath?: string): string {
    const absolutePath = this.toAbsolute(filePath);
    return path.relative(basePath || process.cwd(), absolutePath);
  }

  /**
   * パスを正規化
   */
  static normalize(filePath: string): string {
    return path.normalize(this.expand(filePath));
  }

  /**
   * ツール設定ファイルのパスを取得
   */
  static getToolConfigPath(tool: string): string {
    const configPaths: Record<string, string> = {
      claude: '~/Library/Application Support/Claude/claude_desktop_config.json',
      cline: '~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json',
      roo: '~/Library/Application Support/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/mcp_settings.json',
      cursor: '~/.cursor/mcp.json',
      vscode: '~/Library/Application Support/Code/User/settings.json',
      'claude-code': '~/.claude.json',
    };

    const configPath = configPaths[tool];
    if (!configPath) {
      throw new Error(`Unknown tool: ${tool}`);
    }

    return this.expand(configPath);
  }

  /**
   * マスター設定ファイルのパスを取得
   */
  static getMasterConfigPath(): string {
    return this.expand('~/.mcp/mcp_settings.json');
  }

  /**
   * バックアップディレクトリのパスを取得
   */
  static getBackupDir(): string {
    return this.expand('~/.mcp/backups');
  }

  /**
   * 一時ディレクトリのパスを取得
   */
  static getTempDir(): string {
    return path.join(os.tmpdir(), 'mcp-sync');
  }

  /**
   * プラットフォーム固有のパスを取得
   */
  static getPlatformPath(paths: { darwin?: string; win32?: string; linux?: string }): string {
    const platform = os.platform();
    const platformPath = paths[platform as keyof typeof paths];
    
    if (!platformPath) {
      throw new Error(`No path defined for platform: ${platform}`);
    }

    return this.expand(platformPath);
  }

  /**
   * ファイル名から拡張子を除去
   */
  static removeExtension(filePath: string): string {
    const parsed = path.parse(filePath);
    return path.join(parsed.dir, parsed.name);
  }

  /**
   * タイムスタンプ付きファイル名を生成
   */
  static generateTimestampedPath(basePath: string, extension?: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const parsed = path.parse(basePath);
    const ext = extension || parsed.ext;
    return path.join(parsed.dir, `${parsed.name}-${timestamp}${ext}`);
  }

  /**
   * パスが特定のディレクトリ内にあるかチェック
   */
  static isInDirectory(filePath: string, directory: string): boolean {
    const absolutePath = this.toAbsolute(filePath);
    const absoluteDir = this.toAbsolute(directory);
    const relative = path.relative(absoluteDir, absolutePath);
    return !relative.startsWith('..') && !path.isAbsolute(relative);
  }
}