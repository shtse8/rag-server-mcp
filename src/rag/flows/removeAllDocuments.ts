import * as z from 'zod';
import { ai, getChromaCollection } from '../flows.js'; // Import shared resources
import { UNIFIED_COLLECTION_NAME } from '../../indexing/autoIndexer.js';

// Define Zod schema for action input
export const RemoveAllSchema = z.object({
  confirm: z
    .boolean()
    .describe(
      'Confirmation flag (must be true) to remove all indexed data for this project (CWD)',
    ),
});

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
    const { confirm } = input;
    if (!confirm) {
      throw new Error(
        'Confirmation flag `confirm: true` is required to remove all documents.',
      );
    }
    console.debug(
      `[Genkit RAG] Removing all documents from collection: ${UNIFIED_COLLECTION_NAME}`,
    );
    try {
      const collection = await getChromaCollection();
      // Get all IDs first then delete
      const allItems = await collection.get();
      if (allItems.ids.length > 0) {
        await collection.delete({ ids: allItems.ids });
        console.info(
          `[Genkit RAG] Successfully deleted all ${allItems.ids.length.toString()} items from collection: ${UNIFIED_COLLECTION_NAME}`,
        );
      } else {
        console.info(
          `[Genkit RAG] Collection ${UNIFIED_COLLECTION_NAME} was already empty.`,
        );
      }
    } catch (error) {
      console.error(
        `[Genkit RAG] Error removing all documents from ${UNIFIED_COLLECTION_NAME}:`,
        error,
      );
      throw error;
    }
  },
);
