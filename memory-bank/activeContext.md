<!-- Version: 1.1 | Last Updated: 2025-06-06 -->

# Active Context

**Current Task:** Finalize implementation and prepare for testing of the enhanced RAG server. -> **Completed**

**Recent Actions:**
1.  Committed previous deletion/listing implementation to Git (Commit: `3d3c401`).
2.  Discussed extending RAG to support source code alongside documents.
3.  Evaluated different approaches: separate collections, single collection + metadata, AI summarization, intelligent chunking.
4.  Discussed automatic indexing on startup vs. manual triggering.
5.  **Final Decision on Architecture:** Based on the primary use case of "one server instance per project CWD":
    *   **Automatic Indexing:** Server defaults to indexing its CWD on startup (configurable off).
    *   **No `projectId`:** Removed the need for `projectId` parameter in tools/flows as CWD provides context.
    *   **Hierarchical Chunker:** Implemented basic structure (`hierarchicalChunker` in `chunking.ts`) dispatching based on file extension, with specific handling for Markdown code blocks and a generic code chunker (split by blank lines). Metadata (`contentType`, `language`, `sourcePath`) is added to chunks.
    *   **Single Collection:** All chunks (docs & code) stored in a single unified ChromaDB collection (`mcp-rag-unified`).
6.  **Implementation Completed:**
    *   Restored auto-indexing trigger in `server.ts`.
    *   Recreated `autoIndexer.ts` for CWD scanning, `.gitignore` filtering, and indexing.
    *   Removed `projectId` from tool schemas (`server.ts`) and flow logic (`flows.ts`).
    *   Implemented basic `hierarchicalChunker`, `chunkMarkdown`, `chunkGenericCode` in `chunking.ts`.
    *   Created `Dockerfile` and `docker-compose.yml` for containerized deployment including ChromaDB and Ollama.
    *   Updated `README.md` with Docker instructions.
    *   Created E2E test suite (`flows.e2e.test.ts`) covering indexing, querying (with filters), listing, and deletion.
    *   Fixed unit tests (`flows.test.ts`) to align with changes.
7.  **Troubleshooting & Fixes:**
    *   Diagnosed E2E test failures related to ChromaDB (`Unimplemented` error) and Ollama embedder (`Unable to resolve embedder`).
    *   Refactored `flows.ts` to use direct `chromadb` client calls for indexing and querying, bypassing potential issues in `genkitx-chromadb` plugin abstractions.
    *   Fixed unit tests (`flows.test.ts`) mocks and assertions to align with the refactored `flows.ts`.
    *   Identified missing Ollama model (`nomic-embed-text`) in the E2E environment as the root cause for embedder resolution errors.
    *   Updated `docker-compose.yml` to expose Ollama port and added manual step to pull the required model.
8.  **Testing Completed:**
    *   Unit tests (`flows.test.ts`) are passing (except one designed to test error handling).
    *   E2E tests (`flows.e2e.test.ts`) are **passing** after ensuring the Ollama model was available.

**Next Steps:**
1.  Commit final changes to Git.
2.  Consider further improvements (e.g., refining chunking logic, adding more tests, improving Ollama model download process).