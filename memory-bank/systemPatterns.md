<!-- Version: 0.8 | Last Updated: 2025-06-06 -->

# System Patterns

**Core Architecture:** MCP Server (designed for one instance per project CWD)

- Entry point: `src/mcp/server.ts`.
- Tool handling logic: `src/mcp/toolHandler.ts`.

**RAG Workflow (Implemented with Genkit & ChromaDB):**

- Configuration: `src/config/genkit.ts` (initializes Genkit, plugins like Ollama and ChromaDB).
- Core Logic: `src/rag/flows.ts` defines Genkit Flows.
- **Chunking (Hierarchical):** `src/rag/chunking.ts` contains:
  - `hierarchicalChunker`: Master chunker dispatching based on file extension.
  - `chunkMarkdown`: Handles Markdown, separating text and ``` code blocks (code blocks treated as single chunks currently).
  - `chunkGenericCode`: Handles code files, splitting by blank lines (basic implementation).
  - `chunkGenericText`: Handles plain text files.
  - Chunks include metadata: `contentType`, `language` (for code), `sourcePath` (relative to CWD).
- ChromaDB Client: Used via direct calls in flows for indexing, querying, deletion, and listing.

1.  **Indexing (Automatic on Startup - Default):**
    - Triggered automatically by `startIndexing` in `src/indexing/autoIndexer.ts` when server starts (configurable via `INDEX_PROJECT_ON_STARTUP` env var).
    - Scans Current Working Directory (CWD) recursively in the background.
    - Applies filtering based on `.gitignore` and predefined exclusion rules (`.git`, `node_modules`, etc.).
    - Uses `hierarchicalChunker` to process file content.
    - **Direct ChromaDB Interaction:** Uses `getChromaCollection()` and `collection.add()` to store chunks (with metadata and embeddings generated via `ai.embed`) in a **single ChromaDB collection** (`mcp-rag-unified`).
2.  **Querying (`queryDocumentsFlow`):**
    - Accepts `query`, `k`, and optional `filter` (for metadata like `contentType`, `language`).
    - **Direct ChromaDB Interaction:** Generates query embedding using `ai.embed`, then calls `collection.query()` on the single collection (`mcp-rag-unified`), passing the query embedding and user's metadata filter in `where`.
3.  **Deletion (`removeDocumentFlow`, `removeAllDocumentsFlow`):**
    - Uses direct `chromadb` client API (`collection.delete`) on the single collection.
    - `removeDocumentFlow` filters by `metadata.sourcePath`.
    - `removeAllDocumentsFlow` deletes all items in the collection for the current server instance.
4.  **Listing (`listDocumentsFlow`):**
    - Uses direct `chromadb` client API (`collection.get`) on the single collection to retrieve all metadata and extract unique `sourcePath` values.
5.  **Storage:** **Single ChromaDB collection** (`mcp-rag-unified`) per server instance/CWD.
6.  **Embedding:** Uses Ollama embedder (`ollama/nomic-embed-text`) configured in `genkit.config.ts` and invoked via `ai.embed`.

**Testing:**

- Unit Tests: Uses Vitest (`src/tests/rag/flows.test.ts`), mocks Genkit/fs/chromadb. Mostly passing (1 expected failure).
- E2E Tests: Uses Vitest (`src/tests/rag/flows.e2e.test.ts`), requires running ChromaDB and Ollama (with `nomic-embed-text` model downloaded). **All passing**.

**Deployment (Recommended):**

- Docker Compose (`docker-compose.yml`): Bundles the Node.js server, ChromaDB, and Ollama for easy startup (`docker-compose up`).
  - ChromaDB port `8000` is exposed to host.
  - Ollama port `11434` is exposed to host (required for E2E tests).
  - **Manual Step Required:** Ensure `nomic-embed-text` model is pulled into the Ollama container (`docker exec ollama ollama pull nomic-embed-text`) before running E2E tests or relying on embedding.

**Configuration:**

- MCP tool definitions in `src/mcp/server.ts` (no `projectId`).
- Genkit/Plugin configuration in `src/config/genkit.ts`.
- Environment variables for ChromaDB URL, Ollama host, chunk size, and startup indexing behavior (see `docker-compose.yml` for examples).
