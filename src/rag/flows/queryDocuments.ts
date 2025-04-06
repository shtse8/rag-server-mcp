import * as z from 'zod';
import { ai, getChromaCollection, embedderRef } from '../flows.js'; // Import shared resources
import { IncludeEnum, QueryResponse } from 'chromadb';
import { ChunkMetadata } from '../chunking.js';

// Define Zod schema for action input
export const QueryPathSchema = z.object({
  query: z.string(),
  k: z.number().optional(),
  filter: z
    .record(z.string(), z.unknown())
    .optional()
    .describe('Optional metadata filter (e.g., { contentType: "code" })'),
});

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
    const { query, k = 15, filter } = input;
    console.debug(
      `[Genkit RAG] Querying documents for: "${query}" (k=${k.toString()}, filter=${JSON.stringify(filter)})`,
    );
    try {
      const collection = await getChromaCollection();

      // 1. Embed the query
      const queryEmbedResult = await ai.embed({
        embedder: embedderRef,
        content: query,
      });
      if (!queryEmbedResult[0]?.embedding) {
        throw new Error(
          `[Genkit RAG] Failed to get embedding for query: ${query}`,
        );
      }
      const queryEmbedding: number[] = queryEmbedResult[0].embedding;

      // 2. Query ChromaDB directly
      const queryOptions: { where?: Record<string, unknown> } = {};
      if (filter) {
        queryOptions.where = filter;
        console.debug(`[Genkit RAG] Applying metadata filter:`, filter);
      }

      const results: QueryResponse = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: k,
        where: queryOptions.where,
        include: [IncludeEnum.Metadatas, IncludeEnum.Documents],
      });

      // 3. Process results
      const ids = results.ids[0] || [];
      const metadatas = results.metadatas[0] || [];
      const documents = results.documents[0] || [];

      if (ids.length === 0) {
        console.info(
          `[Genkit RAG] No relevant documents found for query: "${query}"`,
        );
        return 'No relevant documents found in the index.';
      }

      console.info(
        `[Genkit RAG] Retrieved ${ids.length.toString()} relevant chunks for query: "${query}"`,
      );

      // 4. Format results for LLM
      const llmFormattedResults = ids.map((_id, index) => {
        const metadata = metadatas[index] as ChunkMetadata | null;
        const content = documents[index] || '';
        const docPath = metadata?.sourcePath || 'unknown_source';
        const fileName = docPath.split(/[/\\]/).pop() || docPath;
        const chunkNum = index + 1;
        const docName = `${fileName}_chunk${chunkNum.toString()}`.replace(
          /[^a-zA-Z0-9_]/g,
          '_',
        );
        return `[DOCUMENT:${docName}]\n${content.trim()}\n[/DOCUMENT:${docName}]`;
      });

      return llmFormattedResults.join('\n\n');
    } catch (error) {
      console.error(
        `[Genkit RAG] Error querying documents for "${query}":`,
        error,
      );
      if (
        error instanceof Error &&
        (error.message.includes('Retriever not found') ||
          error.message.includes('Indexer not found') ||
          error.message.includes('collection not found'))
      ) {
        return 'Error: Documents not indexed yet or index is not configured correctly. Please run index_documents first.';
      }
      throw error;
    }
  },
);