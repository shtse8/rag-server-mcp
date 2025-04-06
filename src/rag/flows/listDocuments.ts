import * as z from 'zod';
import { ai, getChromaCollection } from '../flows.js'; // Import shared resources
import { IncludeEnum } from 'chromadb';
import { UNIFIED_COLLECTION_NAME } from '../../indexing/autoIndexer.js';

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
  async () => {
    console.debug('[Genkit RAG] Listing indexed document paths...');
    try {
      const collection = await getChromaCollection();
      // Get all documents and include metadata
      const results = await collection.get({
        include: [IncludeEnum.Metadatas],
      });

      if (results.metadatas.length === 0) {
        console.info('[Genkit RAG] No documents found in the collection.');
        return [];
      }

      const paths = new Set<string>();
      results.metadatas.forEach((metadata: Record<string, unknown> | null) => {
        const sourcePath = metadata?.['sourcePath'];
        if (sourcePath && typeof sourcePath === 'string') {
          paths.add(sourcePath);
        }
      });
      const pathArray = Array.from(paths);
      console.info(
        `[Genkit RAG] Found ${pathArray.length.toString()} unique document paths.`,
      );
      return pathArray;
    } catch (error) {
      console.error(
        '[Genkit RAG] Error listing documents using Chroma client:',
        error,
      );
      if (
        error instanceof Error &&
        error.message.toLowerCase().includes('collection not found')
      ) {
        console.warn(
          `[Genkit RAG] Collection ${UNIFIED_COLLECTION_NAME} not found during list.`,
        );
        return [];
      }
      throw error;
    }
  },
);
