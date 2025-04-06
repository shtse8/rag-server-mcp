import { statSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import * as z from 'zod';
import { genkit } from 'genkit';
import { embed } from '@genkit-ai/ai'; // Import embed from @genkit-ai/ai
import config from '../config/genkit.js';
import { Document } from 'genkit/retriever';
import { chromaIndexerRef, chromaRetrieverRef } from 'genkitx-chromadb'; // Keep for potential future use or reference
import { hierarchicalChunker, ChunkMetadata } from './chunking.js'; // Use hierarchicalChunker
import { ChromaClient, Collection, IncludeEnum, QueryResponse } from 'chromadb'; // Import IncludeEnum and QueryResponse
import { EmbedderArgument } from '@genkit-ai/ai'; // Import EmbedderArgument
// Remove incorrect import

// Initialize Genkit with the configuration
export const ai = genkit(config); // Export the initialized ai instance

// --- ChromaDB Client Setup ---
const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000';
// Import the unified collection name
import { UNIFIED_COLLECTION_NAME } from '../indexing/autoIndexer.js';
// Remove old constant definition entirely

let chromaClient: ChromaClient | null = null;
let chromaCollection: Collection | null = null;

export async function getChromaCollection(): Promise<Collection> { // Add export
  if (!chromaCollection) {
    if (!chromaClient) {
      chromaClient = new ChromaClient({ path: CHROMA_URL });
    }
    try {
        // Use the unified collection name
        chromaCollection = await chromaClient.getOrCreateCollection({ name: UNIFIED_COLLECTION_NAME });
        console.info(`[ChromaDB] Accessed collection: ${UNIFIED_COLLECTION_NAME}`);
    } catch (error) {
        // Use UNIFIED_COLLECTION_NAME in error message too
        console.error(`[ChromaDB] Error accessing collection ${UNIFIED_COLLECTION_NAME}:`, error);
        throw new Error(`Failed to get or create ChromaDB collection: ${UNIFIED_COLLECTION_NAME}`);
    }
  }
  return chromaCollection;
}
// --- End ChromaDB Client Setup ---


// Define Zod schemas for action inputs (projectId removed)
const IndexPathSchema = z.object({
    path: z.string().describe("Path containing files/directories to index (relative to CWD)")
});
const QueryPathSchema = z.object({
  query: z.string(),
  k: z.number().optional(),
  filter: z.record(z.string(), z.any()).optional().describe('Optional metadata filter (e.g., { contentType: "code" })')
  // projectId removed
});
const RemovePathSchema = z.object({
    path: z.string().describe("Source path of the document/file to remove (relative to CWD)")
    // projectId removed
});
const RemoveAllSchema = z.object({
    confirm: z.boolean().describe("Confirmation flag (must be true) to remove all indexed data for this project (CWD)")
    // projectId removed
});
// listDocumentsFlow inputSchema is z.void(), no change needed for projectId removal

// Define embedder reference (consistent with genkit.config.ts)
// Use the imported function to create the embedder reference
const embedderRef: EmbedderArgument = 'ollama/nomic-embed-text'; // Revert to string reference

// Define Genkit references (might be unused now for index/retrieve but keep for consistency)
const ragIndexerRef = chromaIndexerRef({ collectionName: UNIFIED_COLLECTION_NAME });
const ragRetrieverRef = chromaRetrieverRef({ collectionName: UNIFIED_COLLECTION_NAME });

const CHUNK_SIZE = +(process.env.CHUNK_SIZE || 500);
const CHUNK_OVERLAP = 50;

/**
 * Genkit Flow to index documents from a specified path.
 */
export const indexDocumentsFlow = ai.defineFlow(
  {
    name: 'indexDocuments',
    inputSchema: IndexPathSchema,
    outputSchema: z.void(),
  },
  // This flow now acts as a manual trigger for indexing specific paths within the CWD context.
  // The auto-indexer handles the main indexing on startup.
  // We might want to refactor or keep this for manual re-indexing?
  // For now, let's assume it indexes the given path into the unified collection.
  async (input: z.infer<typeof IndexPathSchema>) => {
    const { path: relativePathInput } = input; // Path is relative to CWD
    const absolutePath = join(process.cwd(), relativePathInput); // Get absolute path
    console.debug(`[Genkit RAG] Manually indexing documents from: ${absolutePath}`);

    const ids: string[] = [];
    const embeddings: number[][] = [];
    const metadatasForChroma: Record<string, string | number | boolean>[] = []; // Array for ChromaDB compatible metadata
    const documents: string[] = [];
    let chunkCount = 0;

    try {
      const stat = statSync(absolutePath);
      const collection = await getChromaCollection();

      const processFile = async (filePath: string, sourcePath: string) => {
        const content = readFileSync(filePath, "utf-8");
        const extension = filePath.split('.').pop() || '';
        // Use hierarchicalChunker
        const chunks = hierarchicalChunker(content, `.${extension}`);

        for (const chunk of chunks) {
          const chunkTextContent = chunk.content[0]?.text || ''; // Assuming text content is in the first part
          if (!chunkTextContent) continue; // Skip empty chunks

          // Assume embed takes two arguments and returns number[]
          // Generate a unique ID for the chunk *inside* the loop
          const chunkId = `${sourcePath}-${chunkCount++}`;

          // Use ai.embed with object argument
          const embedResult = await ai.embed({ embedder: embedderRef, content: chunkTextContent });
          // Correctly check and extract embedding
          if (!embedResult || embedResult.length === 0 || !embedResult[0]?.embedding) {
              console.warn(`[Genkit RAG] Failed to get embedding for chunk: ${chunkId}`);
              continue; // Skip this chunk if embedding failed
          }
          const embedding: number[] = embedResult[0].embedding;
          const metadata = { ...chunk.metadata, sourcePath } as ChunkMetadata; // Ensure sourcePath is set

          // Generate a unique ID for the chunk (e.g., sourcePath + chunk index or hash)
          // Removed duplicate chunkId declaration from here

          ids.push(chunkId);
          embeddings.push(embedding); // Push the number[] directly
          // Cast metadata to the type expected by ChromaDB
          // Transform metadata for ChromaDB (only string/number/boolean)
          const chromaMetadata: Record<string, string | number | boolean> = {
              sourcePath: metadata.sourcePath || sourcePath, // Ensure sourcePath is present
              contentType: metadata.contentType,
          };
          if (metadata.language) {
              chromaMetadata.language = metadata.language;
          }
          // Add other simple metadata fields if needed

          metadatasForChroma.push(chromaMetadata); // Push transformed metadata
          documents.push(chunkTextContent);
        }
      };

      if (stat.isDirectory()) {
        // TODO: Reuse filtering logic from autoIndexer? For now, process all files.
        const files = readdirSync(absolutePath);
        if (files.length === 0) throw new Error(`No files found in directory ${absolutePath}`);
        for (const file of files) {
          const filePath = join(absolutePath, file);
          const fileStat = statSync(filePath);
          if (fileStat.isFile()) {
            const relativeFilePath = join(relativePathInput, file); // Keep path relative to CWD for metadata
            await processFile(filePath, relativeFilePath);
          }
        }
      } else if (stat.isFile()) {
        await processFile(absolutePath, relativePathInput); // Use the input relative path for metadata
      } else {
        throw new Error(`Path is neither a file nor a directory: ${absolutePath}`);
      }

      if (ids.length > 0) {
        // Use collection.add directly
        // Cast the metadatas array to the type expected by ChromaDB add
        // Pass the correctly typed metadatasForChroma array
        // Ensure metadatasForChroma is passed correctly
        await collection.add({ ids, embeddings, metadatas: metadatasForChroma, documents });
        console.info(`[Genkit RAG] Successfully indexed ${ids.length} chunks from ${absolutePath} using direct Chroma add.`);
      } else {
        console.info(`[Genkit RAG] No indexable chunks found in ${absolutePath}.`);
      }

    } catch (error: unknown) {
      console.error(`[Genkit RAG] Error indexing documents from ${absolutePath}:`, error);
      if (error instanceof Error && "code" in error && error.code === "ENOENT") throw new Error(`Path does not exist: ${absolutePath}`);
      throw error;
    }
  }
);

/**
 * Genkit Flow to query indexed documents.
 */
export const queryDocumentsFlow = ai.defineFlow(
  {
    name: 'queryDocuments',
    inputSchema: QueryPathSchema,
    outputSchema: z.string(),
  },
  async (input: z.infer<typeof QueryPathSchema>) => {
    // projectId removed from input
    const { query, k = 15, filter } = input;
    console.debug(`[Genkit RAG] Querying documents for: "${query}" (k=${k}, filter=${JSON.stringify(filter)})`);
    try {
      const collection = await getChromaCollection();

      // 1. Embed the query
      // Assume embed takes two arguments and returns number[]
      // Call embed with an object, and extract the embedding array from the result
      // Call embed with an object, and extract the embedding array from the result
      // Revert to using ai.embed with object argument
      // Use ai.embed with object argument
      const queryEmbedResult = await ai.embed({ embedder: embedderRef, content: query });
      // Correctly check and extract embedding
       if (!queryEmbedResult || queryEmbedResult.length === 0 || !queryEmbedResult[0]?.embedding) {
           throw new Error(`[Genkit RAG] Failed to get embedding for query: ${query}`);
       }
      const queryEmbedding: number[] = queryEmbedResult[0].embedding;

      // 2. Query ChromaDB directly
      const queryOptions: { where?: Record<string, any> } = {};
      if (filter) {
        queryOptions.where = filter;
        console.debug(`[Genkit RAG] Applying metadata filter:`, filter);
      }

      const results: QueryResponse = await collection.query({
        queryEmbeddings: [queryEmbedding], // Pass the number[] directly
        nResults: k,
        where: queryOptions.where,
        include: [IncludeEnum.Metadatas, IncludeEnum.Documents] // Ensure we get needed data
      });

      // 3. Process results from collection.query()
      // Results are nested arrays, one per query embedding (we only have one)
      const ids = results.ids?.[0] || [];
      const distances = results.distances?.[0] || [];
      const metadatas = results.metadatas?.[0] || [];
      const documents = results.documents?.[0] || [];

      if (ids.length === 0) {
        console.info(`[Genkit RAG] No relevant documents found for query: "${query}"`);
        return "No relevant documents found in the index.";
      }

      console.info(`[Genkit RAG] Retrieved ${ids.length} relevant chunks for query: "${query}"`);

      // 4. Format results for LLM
      const llmFormattedResults = ids.map((id, index) => {
        const metadata = metadatas[index] as ChunkMetadata | null; // Cast for type safety
        const content = documents[index] || '';
        const docPath = metadata?.sourcePath || 'unknown_source';
        const fileName = docPath.split(/[/\\]/).pop() || docPath;
        // Try to get chunk number from metadata if available, otherwise use index
        // Use index + 1 as chunk number since metadata doesn't contain it
        const chunkNum = index + 1;
        const docName = `${fileName}_chunk${chunkNum}`.replace(/[^a-zA-Z0-9_]/g, '_');

        return `[DOCUMENT:${docName}]\n${content.trim()}\n[/DOCUMENT:${docName}]`;
      });

      return llmFormattedResults.join("\n\n");

    } catch (error) {
      console.error(`[Genkit RAG] Error querying documents for "${query}":`, error);
      // Keep the specific error check for index not ready, although direct query might throw different errors
      if (error instanceof Error && (error.message.includes('Retriever not found') || error.message.includes('Indexer not found') || error.message.includes('collection not found'))) {
         return "Error: Documents not indexed yet or index is not configured correctly. Please run index_documents first.";
      }
      throw error;
    }
  }
);

/**
 * Genkit Flow to remove a specific document (all its chunks) by source path.
 * Uses direct ChromaDB client access.
 */
export const removeDocumentFlow = ai.defineFlow(
  {
    name: 'removeDocument',
    inputSchema: RemovePathSchema,
    outputSchema: z.void(),
  },
  async (input: z.infer<typeof RemovePathSchema>) => {
    // projectId removed from input
    const { path } = input; // path is the sourcePath relative to CWD
    console.debug(`[Genkit RAG] Removing document by source path: ${path}`);
    try {
      const collection = await getChromaCollection();
      // Use ChromaDB's delete with a 'where' filter on metadata
      // Filter only by sourcePath within the unified collection
      await collection.delete({ where: { sourcePath: path } });
      console.info(`[Genkit RAG] Requested deletion of chunks for document: ${path}`);
    } catch (error) {
      console.error(`[Genkit RAG] Error removing document ${path} using Chroma client:`, error);
      throw error;
    }
  }
);

/**
 * Genkit Flow to remove all documents from the collection.
 * Uses direct ChromaDB client access.
 */
export const removeAllDocumentsFlow = ai.defineFlow(
  {
    name: 'removeAllDocuments',
    inputSchema: RemoveAllSchema,
    outputSchema: z.void(),
  },
  async (input: z.infer<typeof RemoveAllSchema>) => {
    // projectId removed from input
    const { confirm } = input;
    if (!confirm) {
      throw new Error("Confirmation flag `confirm: true` is required to remove all documents.");
    }
    // This now removes ALL documents in the unified collection for this server instance
    // This now removes ALL documents in the unified collection for this server instance
    console.debug(`[Genkit RAG] Removing all documents from collection: ${UNIFIED_COLLECTION_NAME}`); // Already correct
    try {
      const collection = await getChromaCollection();
      // Get all IDs first then delete
      const allItems = await collection.get();
      if (allItems.ids.length > 0) {
          await collection.delete({ ids: allItems.ids });
          console.info(`[Genkit RAG] Successfully deleted all ${allItems.ids.length} items from collection: ${UNIFIED_COLLECTION_NAME}`); // Already correct
      } else {
          console.info(`[Genkit RAG] Collection ${UNIFIED_COLLECTION_NAME} was already empty.`); // Already correct
      }
    } catch (error) {
      console.error(`[Genkit RAG] Error removing all documents from ${UNIFIED_COLLECTION_NAME}:`, error); // Already correct
      throw error;
    }
  }
);

/**
 * Genkit Flow to list the source paths of all indexed documents.
 * Uses direct ChromaDB client access.
 */
export const listDocumentsFlow = ai.defineFlow(
  {
    name: 'listDocuments',
    inputSchema: z.void(),
    outputSchema: z.array(z.string()),
  },
  // Input schema is z.void(), no projectId needed
  async () => {
    // Lists documents for the current CWD's index (unified collection)
    console.debug("[Genkit RAG] Listing indexed document paths...");
    try {
      const collection = await getChromaCollection();
      // Get all documents and include metadata
      const results = await collection.get({ include: [IncludeEnum.Metadatas] });

      if (!results || !results.metadatas || results.metadatas.length === 0) {
          console.info("[Genkit RAG] No documents found in the collection.");
          return [];
      }

      const paths = new Set<string>();
      results.metadatas.forEach((metadata: Record<string, any> | null) => {
        // Use sourcePath
        if (metadata?.sourcePath && typeof metadata.sourcePath === 'string') {
          paths.add(metadata.sourcePath);
        }
      });
      const pathArray = Array.from(paths);
      console.info(`[Genkit RAG] Found ${pathArray.length} unique document paths.`);
      return pathArray;
    } catch (error) {
      console.error("[Genkit RAG] Error listing documents using Chroma client:", error);
       if (error instanceof Error && error.message.toLowerCase().includes('collection not found')) {
           console.warn(`[Genkit RAG] Collection ${UNIFIED_COLLECTION_NAME} not found during list.`); // Already correct
           return [];
       }
      throw error;
    }
  }
);