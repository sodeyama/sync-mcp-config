import { ClaudeDesktopConverter } from '../ClaudeDesktopConverter';
import { ClineConverter } from '../ClineConverter';
import { RooCodeConverter } from '../RooCodeConverter';
import { CursorConverter } from '../CursorConverter';
import { VSCodeConverter } from '../VSCodeConverter';
import type { MasterConfig } from '../../types';

describe('Bidirectional Conversion Tests', () => {
  const converters = [
    { name: 'ClaudeDesktop', converter: new ClaudeDesktopConverter() },
    { name: 'Cline', converter: new ClineConverter() },
    { name: 'RooCode', converter: new RooCodeConverter() },
    { name: 'Cursor', converter: new CursorConverter() },
    { name: 'VSCode', converter: new VSCodeConverter() },
  ];

  const testMasterConfig: MasterConfig = {
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    mcpServers: {
      'test-server': {
        command: 'node',
        args: ['test.js'],
        env: { TEST_VAR: 'value' },
      },
      'python-server': {
        command: 'python',
        args: ['-m', 'server'],
        disabled: false,
      },
      'disabled-server': {
        command: 'ruby',
        args: ['server.rb'],
        disabled: true,
      },
      'sse-server': {
        command: 'node',
        args: ['sse-server.js'],
        transport: 'sse',
        url: 'http://localhost:3000',
      },
    },
    globalSettings: {
      backupEnabled: true,
      syncOnChange: true,
    },
  };

  describe.each(converters)('$name converter', ({ converter }) => {
    it('should maintain data integrity through bidirectional conversion', () => {
      // マスター設定 → ツール固有設定
      const toolConfig = converter.convertFromMaster(testMasterConfig);
      
      // ツール固有設定 → マスター設定
      const convertedBack = converter.convertToMaster(toolConfig);
      
      // 元のマスター設定と変換後のマスター設定を比較
      // 注意: 無効化されたサーバーは一部のツールでは保持されない
      const originalServers = Object.entries(testMasterConfig.mcpServers)
        .filter(([_, config]) => !config.disabled)
        .reduce((acc, [name, config]) => {
          acc[name] = config;
          return acc;
        }, {} as typeof testMasterConfig.mcpServers);
      
      const convertedServers = Object.entries(convertedBack.mcpServers)
        .filter(([_, config]) => !config.disabled)
        .reduce((acc, [name, config]) => {
          // metadataフィールドを除外して比較
          const configCopy = { ...config };
          if ('metadata' in configCopy) {
            delete configCopy.metadata;
          }
          acc[name] = configCopy;
          return acc;
        }, {} as typeof testMasterConfig.mcpServers);
      
      expect(Object.keys(convertedServers)).toEqual(Object.keys(originalServers));
      
      for (const [name, originalConfig] of Object.entries(originalServers)) {
        const convertedConfig = convertedServers[name];
        expect(convertedConfig).toBeDefined();
        
        // 基本的なフィールドを比較
        expect(convertedConfig.command).toBe(originalConfig.command);
        expect(convertedConfig.args).toEqual(originalConfig.args);
        expect(convertedConfig.env).toEqual(originalConfig.env);
        expect(convertedConfig.transport).toBe(originalConfig.transport);
        expect(convertedConfig.url).toBe(originalConfig.url);
      }
    });

    it('should handle empty configurations', () => {
      const emptyMasterConfig: MasterConfig = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        mcpServers: {},
        globalSettings: {
          backupEnabled: true,
          syncOnChange: true,
        },
      };

      const toolConfig = converter.convertFromMaster(emptyMasterConfig);
      const convertedBack = converter.convertToMaster(toolConfig);

      expect(Object.keys(convertedBack.mcpServers)).toHaveLength(0);
    });

    it('should validate converted configurations', () => {
      const toolConfig = converter.convertFromMaster(testMasterConfig);
      const validationResult = converter.validateConfig(toolConfig);

      expect(validationResult.valid).toBe(true);
      expect(validationResult.errors).toHaveLength(0);
    });
  });

  describe('Cross-converter compatibility', () => {
    it('should allow data exchange between different converters', () => {
      const claudeConverter = new ClaudeDesktopConverter();
      const clineConverter = new ClineConverter();

      // Claude → Master → Cline
      const claudeConfig = claudeConverter.convertFromMaster(testMasterConfig);
      const masterFromClaude = claudeConverter.convertToMaster(claudeConfig);
      const clineConfig = clineConverter.convertFromMaster(masterFromClaude);
      const masterFromCline = clineConverter.convertToMaster(clineConfig);

      // 基本的なサーバー設定が保持されていることを確認
      const enabledServers = Object.entries(testMasterConfig.mcpServers)
        .filter(([_, config]) => !config.disabled)
        .map(([name]) => name);

      for (const serverName of enabledServers) {
        expect(masterFromCline.mcpServers).toHaveProperty(serverName);
        
        const original = testMasterConfig.mcpServers[serverName];
        const final = masterFromCline.mcpServers[serverName];
        
        expect(final.command).toBe(original.command);
        expect(final.args).toEqual(original.args);
      }
    });
  });

  describe('Edge cases', () => {
    it('should handle servers with minimal configuration', () => {
      const minimalConfig: MasterConfig = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        mcpServers: {
          'minimal': {
            command: 'echo',
          },
        },
        globalSettings: {
          backupEnabled: true,
          syncOnChange: true,
        },
      };

      for (const { converter } of converters) {
        const toolConfig = converter.convertFromMaster(minimalConfig);
        const convertedBack = converter.convertToMaster(toolConfig);
        
        expect(convertedBack.mcpServers.minimal).toBeDefined();
        expect(convertedBack.mcpServers.minimal.command).toBe('echo');
      }
    });

    it('should handle special characters in server names', () => {
      const specialConfig: MasterConfig = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        mcpServers: {
          'server-with-dash': { command: 'node' },
          'server_with_underscore': { command: 'python' },
          'server.with.dots': { command: 'ruby' },
        },
        globalSettings: {
          backupEnabled: true,
          syncOnChange: true,
        },
      };

      for (const { converter } of converters) {
        const toolConfig = converter.convertFromMaster(specialConfig);
        const convertedBack = converter.convertToMaster(toolConfig);
        
        expect(Object.keys(convertedBack.mcpServers)).toHaveLength(3);
        expect(convertedBack.mcpServers).toHaveProperty('server-with-dash');
        expect(convertedBack.mcpServers).toHaveProperty('server_with_underscore');
        expect(convertedBack.mcpServers).toHaveProperty(['server.with.dots']);
      }
    });
  });
});