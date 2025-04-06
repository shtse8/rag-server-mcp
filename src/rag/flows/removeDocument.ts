import * as z from 'zod';
import { ai, getChromaCollection } from '../flows.js'; // Import shared resources

// Define Zod schema for action input
export const RemovePathSchema = z.object({
  path: z
    .string()
    .describe('Source path of the document/file to remove (relative to CWD)'),
});

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
    const { path } = input; // path is the sourcePath relative to CWD
    console.debug(`[Genkit RAG] Removing document by source path: ${path}`);
    try {
      const collection = await getChromaCollection();
      // Use ChromaDB's delete with a 'where' filter on metadata
      await collection.delete({ where: { sourcePath: path } });
      console.info(
        `[Genkit RAG] Requested deletion of chunks for document: ${path}`,
      );
    } catch (error) {
      console.error(
        `[Genkit RAG] Error removing document ${path} using Chroma client:`,
        error,
      );
      throw error;
    }
  },
);