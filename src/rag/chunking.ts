import { Document, DocumentData } from '@genkit-ai/ai/retriever';

// Define the structure for our custom metadata.
// This will be stored in the Document's metadata field.
export interface ChunkMetadata {
  contentType: 'text' | 'code' | 'unknown';
  language?: string; // Primarily for code chunks
  sourcePath?: string; // Relative path of the source file
  // Add other relevant metadata like line numbers if needed
}

// Define the Chunk type as a Genkit Document.
// We expect its metadata field to conform to ChunkMetadata.
export type Chunk = Document;


// Configuration (consider moving to a central config or making configurable)
const DEFAULT_CHUNK_SIZE = +(process.env.CHUNK_SIZE || 500);
const DEFAULT_CHUNK_OVERLAP = +(process.env.CHUNK_OVERLAP || 50); // Use new env var or default

// Mapping of extensions to content types (can be expanded)
// Using lowercase extensions for consistent matching
const extensionToContentType: Record<string, 'text' | 'code'> = {
  '.md': 'text',
  '.txt': 'text',
  '.ts': 'code',
  '.js': 'code',
  '.jsx': 'code',
  '.tsx': 'code',
  '.py': 'code',
  '.java': 'code',
  '.go': 'code',
  '.cs': 'code', // C#
  '.html': 'code', // Often treated as code/markup
  '.css': 'code',
  '.json': 'text', // Often treated as data/text
  '.yaml': 'text',
  '.yml': 'text',
  // Add more as needed
};

/**
 * Splits generic text into chunks using a simple sliding window approach.
 * Adapted from the original chunkText function.
 * Returns an array of Chunk objects.
 */
function chunkGenericText(
    content: string,
    contentType: ChunkMetadata['contentType'] = 'text',
    chunkSize: number = DEFAULT_CHUNK_SIZE,
    overlap: number = DEFAULT_CHUNK_OVERLAP
): Chunk[] {
  if (chunkSize <= overlap && chunkSize > 0) {
    console.warn(`[Chunking] Chunk size (${chunkSize}) should be greater than overlap (${overlap}). Adjusting overlap to ${Math.floor(chunkSize / 2)}`);
    overlap = Math.floor(chunkSize / 2);
  } else if (chunkSize <= 0) {
     console.warn(`[Chunking] Chunk size (${chunkSize}) must be positive. Using default ${DEFAULT_CHUNK_SIZE}.`);
     chunkSize = DEFAULT_CHUNK_SIZE;
     if (overlap >= chunkSize) {
        overlap = Math.floor(chunkSize / 2);
     }
  }

  const chunks: Chunk[] = [];
  let i = 0;
  while (i < content.length) {
    const end = Math.min(i + chunkSize, content.length);
    const chunkContent = content.slice(i, end);

    if (chunkContent.trim().length > 0) { // Ensure chunk is not just whitespace
        // Create metadata with only our custom fields
        const metadata: ChunkMetadata = { contentType };
        // Pass the custom metadata when creating the Document
        chunks.push(Document.fromText(chunkContent, metadata));
    }

    const step = chunkSize - overlap;
    i += step > 0 ? step : chunkSize; // Ensure progress even with zero/negative step
  }

   // Check if the last chunk fully covered the end of the content
   if (chunks.length > 0) {
       const lastChunk = chunks[chunks.length - 1];
       // Find the start index of the last chunk's content in the original string
       // This is tricky due to overlap. A simple approximation:
       // Let's use a simpler check: did the last calculated 'end' reach the total length?
       // Calculate the approximate end index of the content processed by the loop
       let approxLastEnd = 0;
       if (i > 0) { // If the loop ran at least once
           const lastStep = (chunkSize - overlap > 0) ? (chunkSize - overlap) : chunkSize;
           const approxLastStart = i - lastStep;
           approxLastEnd = Math.min(approxLastStart + chunkSize, content.length);
       }


       if (approxLastEnd < content.length) {
           const finalPiece = content.slice(approxLastEnd);
           if (finalPiece.trim().length > 0) {
                const metadata: ChunkMetadata = { contentType };
                // Pass the custom metadata when creating the Document
                chunks.push(Document.fromText(finalPiece, metadata));
           }
       }
   } else if (content.trim().length > 0 && content.length > 0) {
       // Handle case where the entire content is smaller than chunkSize or only one chunk needed
       const metadata: ChunkMetadata = { contentType };
       // Pass the custom metadata when creating the Document
       chunks.push(Document.fromText(content, metadata));
   }

  // Filter out potential empty strings again just in case
  // Use chunk.text() to access the content for filtering
  // Access the text content via the 'text' getter property
  return chunks.filter(chunk => chunk.text.trim().length > 0);
}


/**
 * Placeholder for Markdown-specific chunking.
 * TODO: Implement Markdown-aware chunking.
 * - Identify code blocks (```) and treat them differently.
 * - Chunk text parts based on paragraphs/headings.
 */
function chunkMarkdown(content: string): Chunk[] {
  console.log('[Chunking] chunkMarkdown processing...');
  const chunks: Chunk[] = [];
  // Regex to find code blocks ```lang\n code \n```
  const codeBlockRegex = /^```(\w*)\r?\n([\s\S]*?)\r?\n^```/gm;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    const codeBlockStartIndex = match.index;
    const codeBlockEndIndex = codeBlockRegex.lastIndex;
    const language = match[1]?.toLowerCase() || undefined; // Captured language or undefined
    const codeContent = match[2]; // Captured code content

    // 1. Process the text segment BEFORE the code block
    if (codeBlockStartIndex > lastIndex) {
      const textSegment = content.slice(lastIndex, codeBlockStartIndex);
      if (textSegment.trim().length > 0) {
        console.log(`[Chunking] chunkMarkdown: Processing text segment [${lastIndex}-${codeBlockStartIndex}]`);
        chunks.push(...chunkGenericText(textSegment, 'text'));
      }
    }

    // 2. Process the code block itself (treat as a single chunk for now)
    // Ensure codeContent is defined and not just whitespace before processing
    if (codeContent && codeContent.trim().length > 0) {
       console.log(`[Chunking] chunkMarkdown: Processing code block [${codeBlockStartIndex}-${codeBlockEndIndex}], lang: ${language}`);
       const metadata: ChunkMetadata = {
           contentType: 'code',
           language: language, // language might be undefined if not specified after ```
       };
       // Create a single chunk for the entire code block
       chunks.push(Document.fromText(codeContent, metadata));
       // TODO: Optionally, call chunkGenericCode here if we want to split large code blocks further
    } else {
        // Log if we skipped an empty code block
        // console.log(`[Chunking] chunkMarkdown: Skipping empty code block [${codeBlockStartIndex}-${codeBlockEndIndex}]`);
    }

    // Update lastIndex to the end of the current code block
    lastIndex = codeBlockEndIndex;
  }

  // 3. Process any remaining text segment AFTER the last code block
  if (lastIndex < content.length) {
    const remainingTextSegment = content.slice(lastIndex);
    if (remainingTextSegment.trim().length > 0) {
       console.log(`[Chunking] chunkMarkdown: Processing remaining text segment [${lastIndex}-END]`);
       chunks.push(...chunkGenericText(remainingTextSegment, 'text'));
    }
  }

  console.log(`[Chunking] chunkMarkdown finished, generated ${chunks.length} chunks.`);
  // Filter final chunks just in case empty ones slipped through
  return chunks.filter(chunk => chunk.text.trim().length > 0);
}

/**
 * Placeholder for generic code-aware chunking.
 * TODO: Implement better generic code-aware chunking.
 * - Split by blank lines?
 * - Try to keep functions/classes together?
 * - Consider using tree-sitter or similar for robust parsing in the future.
 */
function chunkGenericCode(content: string, fileExtension: string): Chunk[] {
  console.log(`[Chunking] chunkGenericCode processing for ${fileExtension}`);
  const language = fileExtension.startsWith('.') ? fileExtension.substring(1).toLowerCase() : fileExtension.toLowerCase();
  const chunks: Chunk[] = [];

  // Simple strategy: Split by one or more blank lines
  // This preserves indentation within blocks but might create large chunks.
  const potentialChunks = content.split(/\r?\n\s*\r?\n/); // Split by lines containing only whitespace

  for (const potentialChunk of potentialChunks) {
    const trimmedChunk = potentialChunk.trim(); // Remove leading/trailing whitespace from the block itself
    if (trimmedChunk.length > 0) {
      const metadata: ChunkMetadata = {
        contentType: 'code',
        language: language || undefined,
      };
      // TODO: Consider applying DEFAULT_CHUNK_SIZE limit here as well,
      // potentially using chunkGenericText on oversized code blocks?
      // For now, keep the block intact.
      chunks.push(Document.fromText(potentialChunk, metadata)); // Keep original leading whitespace for indentation
    }
  }

  console.log(`[Chunking] chunkGenericCode finished for ${fileExtension}, generated ${chunks.length} chunks.`);
  return chunks; // No need to filter again as we checked trim().length > 0
}


/**
 * Master chunker function (Hierarchical Chunker).
 * Detects content type based on file extension and dispatches to specialized chunkers.
 *
 * @param content The raw file content.
 * @param fileExtension The file extension (e.g., '.md', '.ts'). Should include the dot.
 * @returns An array of Chunk objects with appropriate metadata.
 */
export function hierarchicalChunker(
  content: string,
  fileExtension: string
): Chunk[] {
  // Ensure extension starts with a dot and is lowercase for consistent matching
  const extLower = fileExtension.startsWith('.') ? fileExtension.toLowerCase() : `.${fileExtension.toLowerCase()}`;
  const contentType = extensionToContentType[extLower] || 'unknown';

  console.log(`[Chunking] Processing file with extension ${extLower}, detected type: ${contentType}`);

  try {
      if (contentType === 'text') {
        // Special handling for markdown
        if (extLower === '.md') {
          return chunkMarkdown(content);
        } else {
          // Use generic text chunker for other text types
          return chunkGenericText(content, 'text');
        }
      } else if (contentType === 'code') {
        return chunkGenericCode(content, extLower);
      } else {
        // Handle unknown types - use generic text chunking
        console.warn(`[Chunking] Unknown file type: ${extLower}. Using generic text chunking.`);
         return chunkGenericText(content, 'unknown');
      }
  } catch (error) {
      console.error(`[Chunking] Error processing file with extension ${extLower}:`, error);
      return []; // Return empty array on error
  }
}

// Original chunkText function follows, marked as potentially deprecated.
// Consumers should prefer hierarchicalChunker.

/**
 * Splits text into chunks using a simple sliding window approach.
 * TODO: Explore more sophisticated chunking strategies if needed.
 *
 * @param text The input text to chunk.
 * @param chunkSize The target size of each chunk (in characters). Defaults to DEFAULT_CHUNK_SIZE.
 * @param overlap The number of overlapping characters between chunks. Defaults to DEFAULT_CHUNK_OVERLAP.
 * @returns An array of text chunks.
 */
/**
 * @deprecated Prefer hierarchicalChunker for new usage.
 * Splits text into chunks using a simple sliding window approach.
 * Returns simple string array, not Chunk objects with metadata.
 */
export function chunkText(
  text: string,
  chunkSize: number = DEFAULT_CHUNK_SIZE,
  overlap: number = DEFAULT_CHUNK_OVERLAP
): string[] {
  if (chunkSize <= overlap) {
    console.warn(`[Chunking] Chunk size (${chunkSize}) should be greater than overlap (${overlap}). Adjusting overlap to ${chunkSize / 2}`);
    overlap = Math.floor(chunkSize / 2);
  }
  if (chunkSize <= 0) {
     console.warn(`[Chunking] Chunk size (${chunkSize}) must be positive. Using default ${DEFAULT_CHUNK_SIZE}.`);
     chunkSize = DEFAULT_CHUNK_SIZE;
  }


  const chunks: string[] = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(i + chunkSize, text.length);
    const chunk = text.slice(i, end);
    chunks.push(chunk);
    const step = chunkSize - overlap;
    i += step > 0 ? step : chunkSize; // Ensure progress even with large overlap
    if (i >= text.length && end < text.length) {
        // Ensure the last part is captured if the step overshoots
        const lastChunk = text.slice(i - (step > 0 ? step : chunkSize));
        if (lastChunk && !chunks.includes(lastChunk)) chunks.push(lastChunk);
    }

  }
  // Filter out potential empty strings resulting from edge cases
  return chunks.filter(chunk => chunk.trim().length > 0);
}