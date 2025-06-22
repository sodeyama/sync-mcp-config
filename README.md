# MCP Sync - MCP設定同期ツール

複数のAIコーディングツール間でMCP（Model Context Protocol）設定を同期するためのCLIツールです。

## 対応ツール

- **Claude Desktop**
- **Claude Code**
- **Cline**
- **Roo Code**
- **Cursor**
- **VS Code**

## 特徴

- 🔄 双方向同期：マスター設定から各ツールへ、または特定のツールから他のツールへ同期
- 💾 自動バックアップ：変更前に自動的にバックアップを作成
- 🔍 差分検出：変更内容を事前に確認できるドライラン機能
- ⚡ 簡単操作：シンプルなCLIコマンドで操作
- 🛡️ 安全性：設定の検証とエラーハンドリング

## インストール

```bash
# npmでインストール
npm install -g mcp-sync

# または、リポジトリをクローンして直接使用
git clone https://github.com/yourusername/sync-mcp-config.git
cd sync-mcp-config
npm install
npm link
```

## 使い方

### 初期化

最初に、MCP同期の設定を初期化します：

```bash
mcp-sync init
```

これにより、`~/.mcp/mcp_settings.json`にマスター設定ファイルが作成されます。

### 同期

#### マスター設定から全ツールに同期

```bash
mcp-sync sync
```

#### 特定のツールのみ同期

```bash
mcp-sync sync --tool claude cline roo
```

#### 特定のツールから他のツールに同期

```bash
mcp-sync sync --source claude
```

#### ドライラン（変更内容の確認）

```bash
mcp-sync sync --dry-run
```

### バックアップ

#### 全ツールの設定をバックアップ

```bash
mcp-sync backup
```

#### 特定のツールのみバックアップ

```bash
mcp-sync backup --tool claude cline
```

### 復元

#### 最新のバックアップから復元

```bash
mcp-sync restore --tool claude
```

#### 特定のバックアップから復元

```bash
mcp-sync restore --tool claude --id claude-claude_desktop_config-2025-01-11T08-30-00-000Z.json
```

#### 利用可能なバックアップを確認

```bash
mcp-sync restore --tool claude --list
```

### ステータス確認

現在の同期状態と設定情報を表示：

```bash
mcp-sync status
```

### 設定編集

マスター設定ファイルをエディタで開く：

```bash
mcp-sync edit
```

## 設定ファイルの場所

- **マスター設定**: `~/.mcp/mcp_settings.json`
- **バックアップ**: `~/.mcp/backups/`
- **各ツールの設定**:
  - Claude Desktop: `~/Library/Application Support/Claude/claude_desktop_config.json`
  - Claude Code: `~/.claude.json` (mcpServersセクション)
  - Cline: `~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`
  - Roo Code: `~/Library/Application Support/Code/User/globalStorage/rooveterinaryinc.roo-cline/settings/mcp_settings.json`
  - Cursor: `~/.cursor/mcp.json`
  - VS Code: `~/Library/Application Support/Code/User/settings.json`

## マスター設定ファイルの形式

```json
{
  "version": "1.0.0",
  "lastUpdated": "2025-01-11T08:40:00Z",
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-example"],
      "env": {
        "API_KEY": "your-api-key"
      },
      "disabled": false,
      "alwaysAllow": ["tool1", "tool2"],
      "metadata": {
        "description": "Example MCP server",
        "tags": ["example", "demo"]
      }
    }
  },
  "globalSettings": {
    "backupEnabled": true,
    "syncOnChange": true,
    "backupRetentionCount": 10,
    "excludeTools": []
  }
}
```

## 高度な使用方法

### プログラマティックAPI

```typescript
import { createSyncEngine, syncAll, syncFrom } from 'mcp-sync';

// 全ツールに同期
await syncAll({ dryRun: false });

// 特定のツールから同期
await syncFrom('claude', {
  tools: ['cline', 'roo'],
  skipBackup: false
});
```

## トラブルシューティング

### 権限エラー

設定ファイルへの書き込み権限がない場合は、以下を確認してください：

```bash
# 権限を確認
ls -la ~/Library/Application\ Support/Claude/

# 必要に応じて権限を変更
chmod 644 ~/Library/Application\ Support/Claude/claude_desktop_config.json
```

### 設定ファイルが見つからない

ツールがインストールされていても設定ファイルが存在しない場合があります。その場合は、該当ツールを一度起動してから再試行してください。

### 同期の競合

複数のツールで異なる設定がある場合、`--force`オプションを使用して強制的に同期できます：

```bash
mcp-sync sync --force
```

## 開発

### ビルド

```bash
npm run build
```

### テスト

```bash
npm test
```

### 開発モード

```bash
npm run dev
```

## ライセンス

MIT License

## 貢献

プルリクエストを歓迎します！バグ報告や機能リクエストは[Issues](https://github.com/yourusername/sync-mcp-config/issues)までお願いします。