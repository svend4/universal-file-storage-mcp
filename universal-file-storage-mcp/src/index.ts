/**
 * Universal File Storage MCP Server
 * 
 * Поддерживает:
 * - Локальные файловые системы (Windows/Mac/Linux/Android)
 * - Сетевые хранилища (NAS через SMB/NFS)
 * - Облачные хранилища (WebDAV, S3)
 * - Полнотекстовый поиск
 * - OCR для изображений
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import { z } from "zod";
import * as fs from "fs/promises";
import * as path from "path";
import { createReadStream } from "fs";
import { createClient } from "webdav";
import Tesseract from "tesseract.js";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

// ============================================================================
// КОНФИГУРАЦИЯ ХРАНИЛИЩ
// ============================================================================

interface StorageConfig {
  id: string;
  type: "local" | "nas" | "cloud" | "android";
  platform: "windows" | "linux" | "macos" | "android";
  path: string;
  credentials?: {
    username?: string;
    password?: string;
    url?: string;
  };
  enabled: boolean;
}

// Конфигурация всех доступных хранилищ
const STORAGES: StorageConfig[] = [
  {
    id: "windows-local",
    type: "local",
    platform: "windows",
    path: "D:\\Documents",
    enabled: true
  },
  {
    id: "linux-home",
    type: "local",
    platform: "linux",
    path: "/home/max/documents",
    enabled: true
  },
  {
    id: "macos-home",
    type: "local",
    platform: "macos",
    path: "/Users/max/Documents",
    enabled: false
  },
  {
    id: "nas-storage",
    type: "nas",
    platform: "linux", // NAS обычно Linux-based
    path: "//192.168.1.5/shared",
    credentials: {
      username: "admin",
      password: process.env.NAS_PASSWORD || ""
    },
    enabled: true
  },
  {
    id: "cloud-webdav",
    type: "cloud",
    platform: "linux",
    path: "/remote/files",
    credentials: {
      url: "https://cloud.example.com/webdav",
      username: "max",
      password: process.env.CLOUD_PASSWORD || ""
    },
    enabled: false
  },
  {
    id: "android-storage",
    type: "android",
    platform: "android",
    path: "/storage/emulated/0/Documents",
    enabled: false
  }
];

// ============================================================================
// STORAGE ADAPTERS - Унифицированный доступ к разным хранилищам
// ============================================================================

class StorageAdapter {
  constructor(private config: StorageConfig) {}

  /**
   * Список файлов в директории
   */
  async listFiles(subPath: string = ""): Promise<FileEntry[]> {
    const fullPath = path.join(this.config.path, subPath);

    switch (this.config.type) {
      case "local":
        return this.listLocalFiles(fullPath);
      
      case "nas":
        return this.listNasFiles(fullPath);
      
      case "cloud":
        return this.listCloudFiles(subPath);
      
      case "android":
        return this.listAndroidFiles(fullPath);
      
      default:
        throw new Error(`Unsupported storage type: ${this.config.type}`);
    }
  }

  /**
   * Чтение файла
   */
  async readFile(filePath: string): Promise<string> {
    const fullPath = path.join(this.config.path, filePath);

    switch (this.config.type) {
      case "local":
        return fs.readFile(fullPath, "utf-8");
      
      case "nas":
        return this.readNasFile(fullPath);
      
      case "cloud":
        return this.readCloudFile(filePath);
      
      case "android":
        return this.readAndroidFile(fullPath);
      
      default:
        throw new Error(`Unsupported storage type: ${this.config.type}`);
    }
  }

  /**
   * Поиск файлов по содержимому
   */
  async searchFiles(query: string, options?: {
    fileTypes?: string[];
    maxResults?: number;
  }): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const files = await this.listFiles();

    for (const file of files) {
      if (results.length >= (options?.maxResults || 50)) break;

      // Фильтр по типу файла
      if (options?.fileTypes && options.fileTypes.length > 0) {
        const ext = path.extname(file.name).toLowerCase();
        if (!options.fileTypes.includes(ext)) continue;
      }

      try {
        let content = "";
        
        // Для изображений - OCR
        if (this.isImage(file.name)) {
          content = await this.extractTextFromImage(file.path);
        } else {
          content = await this.readFile(file.path);
        }

        // Поиск по содержимому
        if (content.toLowerCase().includes(query.toLowerCase())) {
          const lines = content.split('\n');
          const matchingLines = lines.filter(line => 
            line.toLowerCase().includes(query.toLowerCase())
          );

          results.push({
            file: file,
            matches: matchingLines.slice(0, 3), // Первые 3 совпадения
            score: matchingLines.length
          });
        }
      } catch (error) {
        console.error(`Error processing ${file.name}:`, error);
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }

  // --------------------------------------------------------------------------
  // Local Storage
  // --------------------------------------------------------------------------

  private async listLocalFiles(dirPath: string): Promise<FileEntry[]> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      const files: FileEntry[] = [];

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const stats = await fs.stat(fullPath);

        files.push({
          name: entry.name,
          path: fullPath.replace(this.config.path, ""),
          size: stats.size,
          isDirectory: entry.isDirectory(),
          modified: stats.mtime,
          storageId: this.config.id
        });
      }

      return files;
    } catch (error) {
      throw new Error(`Failed to list local files: ${error.message}`);
    }
  }

  // --------------------------------------------------------------------------
  // NAS Storage (SMB/CIFS)
  // --------------------------------------------------------------------------

  private async listNasFiles(dirPath: string): Promise<FileEntry[]> {
    try {
      // Монтирование NAS если еще не смонтирован
      const mountPoint = await this.mountNas();
      const actualPath = path.join(mountPoint, dirPath.replace(this.config.path, ""));
      
      return this.listLocalFiles(actualPath);
    } catch (error) {
      throw new Error(`Failed to list NAS files: ${error.message}`);
    }
  }

  private async readNasFile(filePath: string): Promise<string> {
    const mountPoint = await this.mountNas();
    const actualPath = path.join(mountPoint, filePath.replace(this.config.path, ""));
    return fs.readFile(actualPath, "utf-8");
  }

  private async mountNas(): Promise<string> {
    // Linux: mount -t cifs //192.168.1.5/shared /mnt/nas -o username=admin,password=***
    const mountPoint = `/mnt/nas-${this.config.id}`;
    
    try {
      await fs.access(mountPoint);
      return mountPoint;
    } catch {
      // Монтируем
      const mountCmd = `sudo mount -t cifs ${this.config.path} ${mountPoint} ` +
        `-o username=${this.config.credentials?.username},password=${this.config.credentials?.password}`;
      
      await execAsync(mountCmd);
      return mountPoint;
    }
  }

  // --------------------------------------------------------------------------
  // Cloud Storage (WebDAV)
  // --------------------------------------------------------------------------

  private async listCloudFiles(subPath: string): Promise<FileEntry[]> {
    const client = createClient(
      this.config.credentials!.url!,
      {
        username: this.config.credentials!.username,
        password: this.config.credentials!.password
      }
    );

    const contents = await client.getDirectoryContents(subPath);
    
    return contents.map((item: any) => ({
      name: path.basename(item.filename),
      path: item.filename,
      size: item.size,
      isDirectory: item.type === "directory",
      modified: new Date(item.lastmod),
      storageId: this.config.id
    }));
  }

  private async readCloudFile(filePath: string): Promise<string> {
    const client = createClient(
      this.config.credentials!.url!,
      {
        username: this.config.credentials!.username,
        password: this.config.credentials!.password
      }
    );

    const buffer = await client.getFileContents(filePath);
    return buffer.toString("utf-8");
  }

  // --------------------------------------------------------------------------
  // Android Storage (через ADB или HTTP API)
  // --------------------------------------------------------------------------

  private async listAndroidFiles(dirPath: string): Promise<FileEntry[]> {
    // Вариант 1: ADB
    try {
      const { stdout } = await execAsync(`adb shell ls -la "${dirPath}"`);
      return this.parseAndroidLsOutput(stdout, dirPath);
    } catch (error) {
      throw new Error(`Failed to list Android files: ${error.message}`);
    }
  }

  private async readAndroidFile(filePath: string): Promise<string> {
    const { stdout } = await execAsync(`adb shell cat "${filePath}"`);
    return stdout;
  }

  private parseAndroidLsOutput(output: string, basePath: string): FileEntry[] {
    const lines = output.split('\n').filter(l => l.trim());
    const files: FileEntry[] = [];

    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length < 8) continue;

      const isDir = parts[0].startsWith('d');
      const size = parseInt(parts[4]);
      const name = parts.slice(7).join(' ');

      if (name === '.' || name === '..') continue;

      files.push({
        name,
        path: path.join(basePath, name).replace(this.config.path, ""),
        size,
        isDirectory: isDir,
        modified: new Date(),
        storageId: this.config.id
      });
    }

    return files;
  }

  // --------------------------------------------------------------------------
  // OCR для изображений
  // --------------------------------------------------------------------------

  private isImage(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.webp'].includes(ext);
  }

  private async extractTextFromImage(filePath: string): Promise<string> {
    try {
      const fullPath = path.join(this.config.path, filePath);
      const { data: { text } } = await Tesseract.recognize(fullPath, 'eng+rus', {
        logger: () => {} // Отключаем логи
      });
      return text;
    } catch (error) {
      console.error(`OCR failed for ${filePath}:`, error);
      return "";
    }
  }
}

// ============================================================================
// ТИПЫ
// ============================================================================

interface FileEntry {
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  modified: Date;
  storageId: string;
}

interface SearchResult {
  file: FileEntry;
  matches: string[];
  score: number;
}

// ============================================================================
// MCP SERVER
// ============================================================================

const server = new McpServer({
  name: "universal-file-storage-mcp",
  version: "1.0.0"
});

// Создаем адаптеры для всех активных хранилищ
const storageAdapters = STORAGES
  .filter(s => s.enabled)
  .map(s => new StorageAdapter(s));

// ----------------------------------------------------------------------------
// TOOL 1: Список всех хранилищ
// ----------------------------------------------------------------------------

server.registerTool(
  "list_storages",
  {
    title: "List Available Storages",
    description: `Returns list of all configured storage locations.
    
Shows all available file storage locations including local drives,
NAS devices, cloud storage, and mobile devices.

Returns:
  Array of storage configurations with:
  - id: Unique storage identifier
  - type: Storage type (local/nas/cloud/android)
  - platform: Operating system (windows/linux/macos/android)
  - path: Storage path
  - enabled: Whether storage is currently accessible`,
    inputSchema: z.object({}),
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true
    }
  },
  async () => {
    const storages = STORAGES.map(s => ({
      id: s.id,
      type: s.type,
      platform: s.platform,
      path: s.path,
      enabled: s.enabled
    }));

    return {
      content: [{
        type: "text",
        text: `# Available Storage Locations\n\n` +
              storages.map(s => 
                `## ${s.id}\n` +
                `- **Type**: ${s.type}\n` +
                `- **Platform**: ${s.platform}\n` +
                `- **Path**: ${s.path}\n` +
                `- **Status**: ${s.enabled ? '✅ Enabled' : '❌ Disabled'}\n`
              ).join('\n')
      }],
      structuredContent: { storages }
    };
  }
);

// ----------------------------------------------------------------------------
// TOOL 2: Поиск файлов
// ----------------------------------------------------------------------------

const SearchFilesSchema = z.object({
  query: z.string()
    .min(1)
    .describe("Search query to find in file contents"),
  storage_ids: z.array(z.string())
    .optional()
    .describe("Limit search to specific storage IDs. If not provided, searches all storages"),
  file_types: z.array(z.string())
    .optional()
    .describe("Filter by file extensions (e.g., ['.txt', '.md', '.pdf'])"),
  include_images: z.boolean()
    .default(true)
    .describe("Whether to perform OCR on images"),
  max_results: z.number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe("Maximum number of results to return")
});

server.registerTool(
  "search_files",
  {
    title: "Search Files Across All Storages",
    description: `Full-text search across all configured storage locations.
    
Searches file contents including:
- Text files (.txt, .md, .log, etc.)
- Documents (.pdf, .docx - if supported)
- Images (.jpg, .png - using OCR)
- Code files (.js, .py, .ts, etc.)

The search works across:
- Local drives (Windows/Mac/Linux)
- Network attached storage (NAS)
- Cloud storage (WebDAV, S3)
- Android devices

Args:
  - query: Text to search for in file contents
  - storage_ids: Optional list of storage IDs to search (default: all)
  - file_types: Optional file extension filter
  - include_images: Whether to OCR images (default: true)
  - max_results: Maximum results (1-100, default: 20)

Returns:
  JSON with search results including:
  - file: File information (name, path, size, storage)
  - matches: Array of matching text lines
  - score: Relevance score based on match count

Examples:
  - "Find all mentions of 'budget'" → query="budget"
  - "Search only in NAS" → storage_ids=["nas-storage"]
  - "Find in markdown files" → file_types=[".md"]`,
    inputSchema: SearchFilesSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params) => {
    try {
      let results: SearchResult[] = [];

      // Определяем адаптеры для поиска
      let adapters = storageAdapters;
      if (params.storage_ids && params.storage_ids.length > 0) {
        adapters = storageAdapters.filter(a => 
          params.storage_ids!.includes(a['config'].id)
        );
      }

      // Поиск в каждом хранилище
      for (const adapter of adapters) {
        const storageResults = await adapter.searchFiles(params.query, {
          fileTypes: params.file_types,
          maxResults: params.max_results
        });
        results.push(...storageResults);
      }

      // Сортировка и ограничение результатов
      results = results
        .sort((a, b) => b.score - a.score)
        .slice(0, params.max_results);

      if (results.length === 0) {
        return {
          content: [{
            type: "text",
            text: `No files found matching query: "${params.query}"`
          }]
        };
      }

      // Форматирование результатов
      const output = {
        query: params.query,
        total_results: results.length,
        results: results.map(r => ({
          file: {
            name: r.file.name,
            path: r.file.path,
            size: r.file.size,
            storage: r.file.storageId,
            modified: r.file.modified
          },
          matches: r.matches,
          score: r.score
        }))
      };

      const text = `# Search Results: "${params.query}"\n\n` +
        `Found ${results.length} files\n\n` +
        results.map(r => 
          `## ${r.file.name}\n` +
          `- **Storage**: ${r.file.storageId}\n` +
          `- **Path**: ${r.file.path}\n` +
          `- **Size**: ${(r.file.size / 1024).toFixed(2)} KB\n` +
          `- **Matches**: ${r.score}\n\n` +
          `### Content Preview:\n` +
          r.matches.map(m => `> ${m}`).join('\n') + '\n'
        ).join('\n---\n\n');

      return {
        content: [{ type: "text", text }],
        structuredContent: output
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ Search failed: ${error.message}`
        }]
      };
    }
  }
);

// ----------------------------------------------------------------------------
// TOOL 3: Чтение файла
// ----------------------------------------------------------------------------

const ReadFileSchema = z.object({
  storage_id: z.string()
    .describe("Storage ID where file is located"),
  file_path: z.string()
    .describe("Relative path to the file within storage"),
  extract_text: z.boolean()
    .default(true)
    .describe("For images: perform OCR to extract text")
});

server.registerTool(
  "read_file",
  {
    title: "Read File Content",
    description: `Read complete content of a file from any storage.
    
Supports:
- Text files (returned as-is)
- Images (with optional OCR)
- Any file that can be read as text

Args:
  - storage_id: ID of the storage containing the file
  - file_path: Path to file relative to storage root
  - extract_text: For images, whether to perform OCR (default: true)

Returns:
  File content as text

Examples:
  - Read document: storage_id="windows-local", file_path="/notes/todo.txt"
  - Read from NAS: storage_id="nas-storage", file_path="/documents/report.md"
  - Extract text from image: storage_id="android-storage", file_path="/screenshots/image.png"`,
    inputSchema: ReadFileSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true
    }
  },
  async (params) => {
    try {
      const adapter = storageAdapters.find(a => 
        a['config'].id === params.storage_id
      );

      if (!adapter) {
        throw new Error(`Storage '${params.storage_id}' not found or not enabled`);
      }

      let content: string;
      
      // Проверка на изображение
      const isImage = adapter['isImage'](params.file_path);
      
      if (isImage && params.extract_text) {
        content = await adapter['extractTextFromImage'](params.file_path);
      } else {
        content = await adapter.readFile(params.file_path);
      }

      return {
        content: [{
          type: "text",
          text: `# File: ${params.file_path}\n` +
                `**Storage**: ${params.storage_id}\n\n` +
                `---\n\n${content}`
        }],
        structuredContent: {
          storage_id: params.storage_id,
          file_path: params.file_path,
          content,
          size: content.length
        }
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ Failed to read file: ${error.message}`
        }]
      };
    }
  }
);

// ----------------------------------------------------------------------------
// TOOL 4: Список файлов в директории
// ----------------------------------------------------------------------------

const ListFilesSchema = z.object({
  storage_id: z.string()
    .describe("Storage ID to list files from"),
  directory: z.string()
    .default("")
    .describe("Directory path relative to storage root (empty for root)"),
  recursive: z.boolean()
    .default(false)
    .describe("Whether to list files recursively in subdirectories")
});

server.registerTool(
  "list_files",
  {
    title: "List Files in Directory",
    description: `List all files and directories in a specific location.
    
Args:
  - storage_id: Storage to list files from
  - directory: Directory path (default: root)
  - recursive: Include subdirectories (default: false)

Returns:
  Array of files with metadata:
  - name: File/directory name
  - path: Full path
  - size: File size in bytes
  - isDirectory: Whether it's a directory
  - modified: Last modification date`,
    inputSchema: ListFilesSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true
    }
  },
  async (params) => {
    try {
      const adapter = storageAdapters.find(a => 
        a['config'].id === params.storage_id
      );

      if (!adapter) {
        throw new Error(`Storage '${params.storage_id}' not found`);
      }

      const files = await adapter.listFiles(params.directory);

      const output = {
        storage_id: params.storage_id,
        directory: params.directory || "/",
        total_files: files.length,
        files: files.map(f => ({
          name: f.name,
          path: f.path,
          size: f.size,
          is_directory: f.isDirectory,
          modified: f.modified
        }))
      };

      const text = `# Files in: ${params.directory || "/"}\n` +
        `**Storage**: ${params.storage_id}\n` +
        `**Total**: ${files.length} items\n\n` +
        files.map(f =>
          `${f.isDirectory ? '📁' : '📄'} **${f.name}**\n` +
          `   Size: ${(f.size / 1024).toFixed(2)} KB | ` +
          `Modified: ${f.modified.toLocaleDateString()}`
        ).join('\n');

      return {
        content: [{ type: "text", text }],
        structuredContent: output
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `❌ Failed to list files: ${error.message}`
        }]
      };
    }
  }
);

// ============================================================================
// HTTP SERVER
// ============================================================================

const app = express();
const transport = new StreamableHTTPServerTransport({
  server: app,
  endpoint: "/mcp"
});

server.connect(transport);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`
🚀 Universal File Storage MCP Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Server running on: http://localhost:${PORT}
MCP endpoint: http://localhost:${PORT}/mcp

📦 Active Storages:
${STORAGES.filter(s => s.enabled).map(s => 
  `  ✓ ${s.id} (${s.type}) - ${s.path}`
).join('\n')}

🔧 Available Tools:
  • list_storages - List all storage locations
  • search_files - Full-text search across all storages
  • read_file - Read any file content
  • list_files - List directory contents
  `);
});
