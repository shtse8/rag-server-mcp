import { statSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import * as z from 'zod';
import { ai, getChromaCollection, embedderRef } from '../flows.js'; // Import shared resources
import { hierarchicalChunker, ChunkMetadata } from '../chunking.js';

// Define Zod schema for action input
export const IndexPathSchema = z.object({
  path: z
    .string()
    .describe('Path containing files/directories to index (relative to CWD)'),
});

/**
 * Genkit Flow to index documents from a specified path.
 */
export const indexDocumentsFlow = ai.defineFlow(
  {
    name: 'indexDocuments',
    inputSchema: IndexPathSchema,
    outputSchema: z.void(),
  },
  async (input: z.infer<typeof IndexPathSchema>) => {
    const { path: relativePathInput } = input; // Path is relative to CWD
    const absolutePath = join(process.cwd(), relativePathInput); // Get absolute path
    console.debug(
      `[Genkit RAG] Manually indexing documents from: ${absolutePath}`,
    );

    const ids: string[] = [];
    const embeddings: number[][] = [];
    const metadatasForChroma: Record<string, string | number | boolean>[] = [];
    const documents: string[] = [];
    let chunkCount = 0;

    try {
      const stat = statSync(absolutePath);
      const collection = await getChromaCollection();

      const processFile = async (filePath: string, sourcePath: string) => {
        const content = readFileSync(filePath, 'utf-8');
        const extension = filePath.split('.').pop() || '';
        const chunks = hierarchicalChunker(content, `.${extension}`);

        for (const chunk of chunks) {
          const chunkTextContent = chunk.content[0]?.text || '';
          if (!chunkTextContent) continue;

          const chunkId = `${sourcePath}-${chunkCount.toString()}`;
          chunkCount++;

          const embedResult = await ai.embed({
            embedder: embedderRef,
            content: chunkTextContent,
          });

          if (!embedResult[0]?.embedding) {
            console.warn(
              `[Genkit RAG] Failed to get embedding for chunk: ${chunkId}`,
            );
            continue;
          }
          const embedding: number[] = embedResult[0].embedding;
          const metadata = { ...chunk.metadata, sourcePath } as ChunkMetadata;

          ids.push(chunkId);
          embeddings.push(embedding);
          const chromaMetadata: Record<string, string | number | boolean> = {
            sourcePath: metadata.sourcePath || sourcePath,
            contentType: metadata.contentType,
          };
          if (metadata.language) {
            chromaMetadata['language'] = metadata.language;
          }
          metadatasForChroma.push(chromaMetadata);
          documents.push(chunkTextContent);
        }
      };

      if (stat.isDirectory()) {
        const files = readdirSync(absolutePath);
        if (files.length === 0)
          throw new Error(`No files found in directory ${absolutePath}`);
        for (const file of files) {
          const filePath = join(absolutePath, file);
          const fileStat = statSync(filePath);
          if (fileStat.isFile()) {
            const relativeFilePath = join(relativePathInput, file);
            await processFile(filePath, relativeFilePath);
          }
        }
      } else if (stat.isFile()) {
        await processFile(absolutePath, relativePathInput);
      } else {
        throw new Error(
          `Path is neither a file nor a directory: ${absolutePath}`,
        );
      }

      if (ids.length > 0) {
        await collection.add({
          ids,
          embeddings,
          metadatas: metadatasForChroma,
          documents,
        });
        console.info(
          `[Genkit RAG] Successfully indexed ${ids.length.toString()} chunks from ${absolutePath} using direct Chroma add.`,
        );
      } else {
        console.info(
          `[Genkit RAG] No indexable chunks found in ${absolutePath}.`,
        );
      }
    } catch (error: unknown) {
      console.error(
        `[Genkit RAG] Error indexing documents from ${absolutePath}:`,
        error,
      );
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
        throw new Error(`Path does not exist: ${absolutePath}`);
      throw error;
    }
  },
);
