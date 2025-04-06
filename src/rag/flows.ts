import { genkit } from 'genkit';
import config from '../config/genkit.js';
import { ChromaClient, Collection } from 'chromadb';
import { UNIFIED_COLLECTION_NAME } from '../indexing/autoIndexer.js';
import { EmbedderArgument } from '@genkit-ai/ai';

// Initialize Genkit with the configuration
export const ai = genkit(config);

// --- ChromaDB Client Setup ---
const CHROMA_URL = process.env['CHROMA_URL'] || 'http://localhost:8000';
let chromaClient: ChromaClient | null = null;
let chromaCollection: Collection | null = null;

export async function getChromaCollection(): Promise<Collection> {
  if (!chromaCollection) {
    if (!chromaClient) {
      chromaClient = new ChromaClient({ path: CHROMA_URL });
    }
    try {
      chromaCollection = await chromaClient.getOrCreateCollection({
        name: UNIFIED_COLLECTION_NAME,
      });
      console.info(
        `[ChromaDB] Accessed collection: ${UNIFIED_COLLECTION_NAME}`,
      );
    } catch (error) {
      console.error(
        `[ChromaDB] Error accessing collection ${UNIFIED_COLLECTION_NAME}:`,
        error,
      );
      throw new Error(
        `Failed to get or create ChromaDB collection: ${UNIFIED_COLLECTION_NAME}`,
      );
    }
  }
  return chromaCollection;
}
// --- End ChromaDB Client Setup ---

// Define embedder reference (consistent with genkit.config.ts)
export const embedderRef: EmbedderArgument = 'ollama/nomic-embed-text';

// Re-export flows from their individual files
export * from './flows/indexDocuments.js';
export * from './flows/queryDocuments.js';
export * from './flows/removeDocument.js';
export * from './flows/removeAllDocuments.js';
export * from './flows/listDocuments.js';
