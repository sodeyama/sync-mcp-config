import * as fs from 'fs';
import * as path from 'path';
import { ClaudeCodeConverter } from '../ClaudeCodeConverter';
import type { MasterConfig, ClaudeCodeConfig } from '../../types';
import { TEST_TEMP_DIR } from '../../__tests__/setup';

describe('ClaudeCodeConverter', () => {
  let converter: ClaudeCodeConverter;

  beforeEach(() => {
    converter = new ClaudeCodeConverter();
  });

  describe('convertToMaster', () => {
    it('should convert Claude Code config to Master config', () => {
      const claudeCodeConfig: ClaudeCodeConfig = {
        mcpServers: {
          'test-server': {
            command: 'node',
            args: ['test.js'],
            env: { TEST: 'value' },
          },
          'disabled-server': {
            command: 'python',
            args: ['script.py'],
            disabled: true,
          },
        },
      };

      const result = converter.convertToMaster(claudeCodeConfig);

      expect(Object.keys(result.mcpServers)).toHaveLength(2);
      expect(result.mcpServers['test-server']).toMatchObject({
        command: 'node',
        args: ['test.js'],
        env: { TEST: 'value' },
      });
      expect(result.mcpServers['disabled-server']).toMatchObject({
        command: 'python',
        args: ['script.py'],
        disabled: true,
      });
    });

    it('should handle empty config', () => {
      const claudeCodeConfig: ClaudeCodeConfig = {
        mcpServers: {},
      };

      const result = converter.convertToMaster(claudeCodeConfig);

      expect(Object.keys(result.mcpServers)).toHaveLength(0);
    });

    it('should handle config without mcpServers', () => {
      const claudeCodeConfig = {} as ClaudeCodeConfig;

      const result = converter.convertToMaster(claudeCodeConfig);

      expect(Object.keys(result.mcpServers)).toHaveLength(0);
    });
  });

  describe('convertFromMaster', () => {
    it('should convert Master config to Claude Code config', () => {
      const masterConfig: MasterConfig = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        mcpServers: {
          'test-server': {
            command: 'node',
            args: ['test.js'],
            env: { TEST: 'value' },
          },
          'disabled-server': {
            command: 'python',
            args: ['script.py'],
            disabled: true,
          },
        },
        globalSettings: {
          backupEnabled: true,
          syncOnChange: true,
        },
      };

      const result = converter.convertFromMaster(masterConfig);

      expect(result.mcpServers).toHaveProperty('test-server');
      expect(result.mcpServers['test-server']).toEqual({
        command: 'node',
        args: ['test.js'],
        env: { TEST: 'value' },
      });
      // disabled サーバーは含まれない
      expect(result.mcpServers).not.toHaveProperty('disabled-server');
    });

    it('should handle empty Master config', () => {
      const masterConfig: MasterConfig = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        mcpServers: {},
        globalSettings: {
          backupEnabled: true,
          syncOnChange: true,
        },
      };

      const result = converter.convertFromMaster(masterConfig);

      expect(result.mcpServers).toEqual({});
    });
  });

  describe('validateConfig', () => {
    it('should validate valid config', () => {
      const validConfig: ClaudeCodeConfig = {
        mcpServers: {
          'test-server': {
            command: 'node',
            args: ['test.js'],
          },
        },
      };

      const result = converter.validateConfig(validConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid config', () => {
      const invalidConfig = {
        mcpServers: {
          'invalid-server': {
            // commandが欠けている
            args: ['test.js'],
          },
        },
      };

      const result = converter.validateConfig(invalidConfig);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject non-object config', () => {
      const result = converter.validateConfig('not an object');

      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('must be an object');
    });

    it('should reject config without mcpServers', () => {
      const result = converter.validateConfig({});

      expect(result.valid).toBe(false);
      expect(result.errors[0].path).toBe('mcpServers');
    });
  });

  describe('extractMCPServers', () => {
    it('should extract MCP servers from config', () => {
      const config: ClaudeCodeConfig = {
        mcpServers: {
          'server1': { command: 'node' },
          'server2': { command: 'python' },
        },
      };

      const result = converter.extractMCPServers(config);

      expect(Object.keys(result)).toHaveLength(2);
      expect(result).toHaveProperty('server1');
      expect(result).toHaveProperty('server2');
    });

    it('should return empty object for config without mcpServers', () => {
      const config = {} as ClaudeCodeConfig;

      const result = converter.extractMCPServers(config);

      expect(result).toEqual({});
    });
  });

  describe('getToolName', () => {
    it('should return correct tool name', () => {
      expect(converter.getToolName()).toBe('claude-code');
    });
  });

  describe('integration tests', () => {
    it('should handle read/write cycle', async () => {
      const testConfigPath = path.join(TEST_TEMP_DIR, 'claude_code_settings.json');
      const testConfig: ClaudeCodeConfig = {
        mcpServers: {
          'test-server': {
            command: 'node',
            args: ['test.js'],
          },
        },
      };

      // 設定ファイルを作成
      fs.mkdirSync(path.dirname(testConfigPath), { recursive: true });
      fs.writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2));

      // BaseConverterのconfigPathをモック
      Object.defineProperty(converter, 'configPath', {
        get: () => testConfigPath,
        configurable: true,
      });

      const readConfig = await converter.readConfig();
      expect(readConfig).toEqual(testConfig);

      // 新しい設定を書き込む
      const newConfig: ClaudeCodeConfig = {
        mcpServers: {
          'new-server': {
            command: 'python',
          },
        },
      };

      await converter.writeConfig(newConfig);

      // 書き込まれた内容を確認
      const writtenContent = fs.readFileSync(testConfigPath, 'utf-8');
      const parsedContent = JSON.parse(writtenContent) as ClaudeCodeConfig;

      expect(parsedContent.mcpServers).toEqual(newConfig.mcpServers);
    });
  });
});