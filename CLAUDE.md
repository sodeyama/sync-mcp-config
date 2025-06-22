# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MCP Sync is a TypeScript CLI tool that synchronizes Model Context Protocol (MCP) settings across multiple AI coding tools (Claude Desktop, Claude Code, Cline, Roo Code, Cursor, VS Code). It maintains a master configuration at `~/.mcp/mcp_settings.json` and converts between different tool-specific formats.

## Development Commands

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Development (watch mode)
npm run dev

# Run tests
npm test
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report

# Run a single test file
npm test -- path/to/test.spec.ts

# Linting and formatting
npm run lint              # ESLint
npm run format            # Prettier
```

## Architecture

The codebase follows a converter pattern with these key components:

1. **Core System** (`/src/core/`)
   - `ConfigManager`: Manages master configuration file
   - `BackupManager`: Handles automatic backups before changes
   - `SyncEngine`: Orchestrates synchronization between tools

2. **Converters** (`/src/converters/`)
   - Each tool has its own converter (e.g., `ClaudeDesktopConverter`, `ClineConverter`)
   - All extend `BaseConverter` abstract class
   - Handle bidirectional conversion between tool-specific and master formats

3. **Master Configuration Format**
   - Located at `~/.mcp/mcp_settings.json`
   - Contains `mcpServers` object with server configurations
   - Each server has: command, args, env, disabled, alwaysAllow, transport, metadata

## Key Development Patterns

1. **Adding a New Converter**
   - Create new class extending `BaseConverter` in `/src/converters/`
   - Implement `readConfig()`, `writeConfig()`, and `getDefaultConfigPath()`
   - Add to `SUPPORTED_TOOLS` in `/src/types/index.ts`
   - Register in `ConverterFactory` (`/src/converters/ConverterFactory.ts`)
   - Add tests in `/src/converters/__tests__/`

2. **Error Handling**
   - Use custom error classes from `/src/utils/errors.ts`
   - Always provide user-friendly error messages
   - Log errors with appropriate levels (debug, info, warn, error)

3. **File Operations**
   - Use utilities from `/src/utils/file.ts` for all file I/O
   - Always create backups before modifying configurations
   - Handle platform-specific paths properly

4. **Testing**
   - Mock file system operations in tests
   - Test bidirectional conversion for each converter
   - Use Jest's coverage tools to ensure comprehensive testing

## CLI Command Structure

The CLI uses Commander.js with these main commands:
- `init`: Initialize master configuration
- `sync [tool]`: Sync configurations (with --from, --to, --all options)
- `backup`: Create manual backup
- `restore`: Restore from backup
- `status`: Show current configuration status
- `edit`: Open master config in default editor

## Important Considerations

1. **Path Resolution**: Always use `resolveConfigPath()` from utils for handling home directory expansion
2. **Validation**: Use Zod schemas for runtime validation of configurations
3. **Backwards Compatibility**: Maintain compatibility with existing tool configuration formats
4. **Atomic Operations**: Ensure file writes are atomic to prevent corruption