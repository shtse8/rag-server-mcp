<!-- Version: 1.1 | Last Updated: 2025-06-06 -->

# Progress

**Current Status:**
- **Architecture finalized and validated:** Server operates on its CWD, automatically indexes on startup (default), uses a hierarchical chunker, stores all data in a single collection with metadata, and requires no `projectId`.
- **Core Features Implemented & Tested:** Automatic indexing, hierarchical chunking (basic implementation for MD code blocks and generic code), single collection storage, metadata tagging (`contentType`, `language`, `sourcePath`), querying with filters, listing, and deletion.
- **Deployment Simplified:** Dockerfile and Docker Compose configuration created for easy setup of server, ChromaDB, and Ollama.
- **Testing:**
    - Unit tests (`flows.test.ts`) updated and passing (except one expected failure for error handling).
    - E2E test suite (`flows.e2e.test.ts`) created and **passing**, validating major flows against live ChromaDB and Ollama instances.
- **Documentation:** README updated with Docker instructions.
- Build process is successful.

**What Works:**
- Project builds successfully (`npm run build`).
- Unit tests pass (mostly).
- E2E tests pass, confirming integration between server logic, ChromaDB, and Ollama embedder.
- Core RAG flows (indexing, query, filter, list, delete) are functional.
- Docker Compose setup successfully runs all required services.

**What's Left / Next Steps (Improvement Areas):**
1.  **Refine Chunking:** Improve `chunkMarkdown` and `chunkGenericCode` for better accuracy and handling of edge cases or specific languages.
2.  **Error Handling/Logging:** Enhance robustness in `autoIndexer.ts` and flows.
3.  **Configuration Management:** Centralize configuration further if needed.
4.  **Ollama Model Management:** Implement a more robust way to ensure the required Ollama model is downloaded (e.g., entrypoint script in Docker, check-and-pull logic in server startup).
5.  **Advanced RAG:** Explore re-ranking, query expansion, etc. after core functionality is stable.
6.  **Update Memory Bank:** Continuously update.
7.  **Commit Changes:** Commit the latest refactoring and E2E test implementation.

**Known Issues:**
- `removeAllDocuments` implementation (get all IDs then delete) might be inefficient for very large collections.
- Current `chunkGenericCode` (split by blank lines) is basic.