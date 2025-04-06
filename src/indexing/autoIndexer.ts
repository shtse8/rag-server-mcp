import * as fs from 'fs/promises';
import * as path from 'path';
import { hierarchicalChunker, Chunk, ChunkMetadata } from '../rag/chunking.js';
import { ai } from '../rag/flows.js'; // Import the initialized ai instance
import { chromaIndexerRef } from 'genkitx-chromadb';
import ignore from 'ignore'; // Import the ignore library

// Define the name for the single collection used by this server instance
// Each server instance running in a different CWD will use its own data within this named collection
// in its connected ChromaDB instance.
export const UNIFIED_COLLECTION_NAME = 'mcp-rag-unified';

// Create the indexer reference for the unified collection
const unifiedIndexerRef = chromaIndexerRef({ collectionName: UNIFIED_COLLECTION_NAME });


async function readGitignore(projectRoot: string): Promise<string[]> {
  const gitignorePath = path.join(projectRoot, '.gitignore');
  try {
    const content = await fs.readFile(gitignorePath, 'utf-8');
    return content.split(/\r?\n/).filter(line => line.trim() !== '' && !line.startsWith('#'));
  } catch (error) {
    if (error instanceof Error && (error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []; // No .gitignore file found, return empty patterns
    }
    console.warn('[AutoIndexer] Error reading .gitignore:', error);
    return [];
  }
}

// Checks if a path relative to the project root should be ignored
function shouldIgnore(relativePath: string, ig: ReturnType<typeof ignore>): boolean {
    // The 'ignore' library expects POSIX paths (using /)
    const posixPath = relativePath.replace(/\\/g, '/');
    // Important: Also ignore the ignore file itself if present
    if (posixPath === '.gitignore') return true;
    return ig.ignores(posixPath);
}

// Processes a single file: reads, chunks, adds metadata
async function processFile(filePath: string, projectRoot: string): Promise<Chunk[]> {
  try {
    // console.log(`[AutoIndexer] Processing file: ${path.relative(projectRoot, filePath)}`);
    const content = await fs.readFile(filePath, 'utf-8');
    const extension = path.extname(filePath);
    const chunks = hierarchicalChunker(content, extension);

    // Add sourcePath metadata to each chunk
    const relativePath = path.relative(projectRoot, filePath);
    chunks.forEach(chunk => {
        if (!chunk.metadata) chunk.metadata = {};
        // Ensure contentType is set by the chunker, default to 'unknown' if missing
        (chunk.metadata as ChunkMetadata).contentType = (chunk.metadata as ChunkMetadata)?.contentType || 'unknown';
        // Add source path relative to project root
        chunk.metadata.sourcePath = relativePath;
    });
    return chunks;
  } catch (error) {
    console.error(`[AutoIndexer] Error processing file ${filePath}:`, error);
    return [];
  }
}

/**
 * Starts the automatic indexing process for the project CWD.
 * Scans the directory, filters ignored files, chunks content, and indexes into ChromaDB.
 * Runs asynchronously in the background.
 */
export async function startIndexing(): Promise<void> {
  console.log('[AutoIndexer] Starting automatic project indexing for CWD...');
  const projectRoot = process.cwd(); // Index the current working directory

  // Initialize ignore instance
  const ig = ignore();

  // Add predefined ignore patterns (common build/dependency/git folders)
  const predefinedIgnores = [
      '.git',             // Git directory
      'node_modules',     // Node dependencies
      'dist',             // Common build output directory
      'build',            // Common build output directory
      'coverage',         // Coverage reports
      '*.log',            // Log files
      'package-lock.json',// Lock file (usually not useful for RAG)
      '.env*',            // Environment files
      'temp-e2e-test-data', // E2E test data directory
      'docker-compose.yml', // Docker compose file
      'Dockerfile',       // Docker file
      // Add more common ignores as glob patterns
  ];
  ig.add(predefinedIgnores);

  // Add patterns from .gitignore
  const gitignorePatterns = await readGitignore(projectRoot);
  if (gitignorePatterns.length > 0) {
      console.log(`[AutoIndexer] Loaded ${gitignorePatterns.length} patterns from .gitignore`);
      ig.add(gitignorePatterns);
  }

  let filesProcessed = 0;
  let chunksGenerated = 0;
  const allChunks: Chunk[] = []; // Collect all chunks before indexing

  try {
    const queue: string[] = [projectRoot]; // Start scanning from the root
    const visited = new Set<string>(); // To handle potential symlink loops

    while (queue.length > 0) {
      const currentPath = queue.shift()!;
      if (visited.has(currentPath)) continue;
      visited.add(currentPath);

      const relativePath = path.relative(projectRoot, currentPath);

      // Check ignore rules (skip root check if relativePath is empty)
      if (relativePath && shouldIgnore(relativePath, ig)) {
        // console.log(`[AutoIndexer] Ignoring: ${relativePath}`);
        continue;
      }

      try {
        const stats = await fs.stat(currentPath);

        if (stats.isDirectory()) {
          // If it's a directory, read its contents and add to the queue
          const dirents = await fs.readdir(currentPath, { withFileTypes: true });
          dirents.forEach(dirent => {
              const direntPath = path.join(currentPath, dirent.name);
              // Check ignore rules again before adding to queue
              const direntRelativePath = path.relative(projectRoot, direntPath);
              if (!shouldIgnore(direntRelativePath, ig)) {
                  queue.push(direntPath);
              } else {
                  // console.log(`[AutoIndexer] Ignoring directory entry: ${direntRelativePath}`);
              }
          });
        } else if (stats.isFile()) {
          // If it's a file, process it
          const chunks = await processFile(currentPath, projectRoot);
          if (chunks.length > 0) {
            filesProcessed++;
            chunksGenerated += chunks.length;
            allChunks.push(...chunks);
          }
        }
      } catch (statError) {
         // Ignore errors for specific files/dirs (e.g., permission denied) but log them
         console.warn(`[AutoIndexer] Error accessing ${currentPath}:`, statError);
      }
    } // End while loop

    // Index all collected chunks in one go (potentially more efficient)
    if (allChunks.length > 0) {
        console.log(`[AutoIndexer] Indexing ${allChunks.length} chunks from ${filesProcessed} files...`);
        // TODO: Consider batching if allChunks is very large
        await ai.index({ indexer: unifiedIndexerRef, documents: allChunks });
        console.log(`[AutoIndexer] Indexing complete.`);
    } else {
        console.log('[AutoIndexer] No files found to index or all files were ignored.');
    }

  } catch (error) {
    console.error('[AutoIndexer] Fatal error during indexing process:', error);
  }
}