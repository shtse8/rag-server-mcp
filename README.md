# MCP RAG Server

<!-- Badges -->
[![NPM Version](https://img.shields.io/npm/v/mcp-rag-server.svg)](https://www.npmjs.com/package/mcp-rag-server) <!-- TODO: Update package name if published -->
[![License](https://img.shields.io/npm/l/mcp-rag-server.svg)](LICENSE) <!-- TODO: Update package name if published -->
[![CI Status](https://github.com/shtse8/rag-server-mcp/actions/workflows/typescript-ci.yml/badge.svg)](https://github.com/shtse8/rag-server-mcp/actions/workflows/typescript-ci.yml)
<!-- [![Coverage Status](https://coveralls.io/repos/github/shtse8/rag-server-mcp/badge.svg?branch=main)](https://coveralls.io/github/shtse8/rag-server-mcp?branch=main) --> <!-- TODO: Add coverage badge once setup -->

**mcp-rag-server** is a [Model Context Protocol (MCP)](https://developer.modelcontext.dev/) server that enables Retrieval Augmented Generation (RAG) capabilities for connected LLMs. It indexes documents from your project and provides relevant context to enhance LLM responses.

Built with [Google Genkit](https://developer.google.com/genkit), [ChromaDB](https://www.trychroma.com/), and [Ollama](https://ollama.com/).

## Features

- **Automatic Indexing:** Scans the project directory on startup (configurable) and indexes supported files.
- **Supported File Types:** `.txt`, `.md`, code files (via generic splitting), `.json`, `.jsonl`, `.csv`. (Code file chunking is basic).
- **Hierarchical Chunking:** Intelligently chunks Markdown files, separating text and code blocks.
- **Vector Storage:** Uses ChromaDB for persistent vector storage.
- **Local Embeddings:** Leverages Ollama for local embedding generation (default: `nomic-embed-text`).
- **MCP Tools:** Exposes RAG functions as standard MCP tools:
    - `indexDocuments`: Manually index a file or directory.
    - `queryDocuments`: Retrieve relevant document chunks for a query.
    - `removeDocument`: Remove a specific document's chunks by source path.
    - `removeAllDocuments`: Clear the entire index for the current project.
    - `listDocuments`: List indexed document source paths.
- **Dockerized:** Includes a `docker-compose.yml` for easy setup of the server, ChromaDB, and Ollama.

## Installation & Usage (Docker Compose - Recommended)

This method runs the server and its dependencies (ChromaDB, Ollama) in isolated containers.

1.  **Prerequisites:**
    *   Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) or Docker Engine.
    *   Ensure port `8000` (ChromaDB) and `11434` (Ollama) are free on your host machine, or adjust ports in `docker-compose.yml`.

2.  **Clone the Repository:**
    ```bash
    git clone https://github.com/shtse8/rag-server-mcp.git
    cd mcp-rag-server
    ```

3.  **Start Services:**
    ```bash
    docker-compose up -d --build
    ```
    *   This builds the server image, downloads ChromaDB and Ollama images, and starts the services.
    *   The first run might take time to download images and build.

4.  **Pull Embedding Model (First Run):**
    The default embedding model (`nomic-embed-text`) needs to be pulled into the Ollama container *after* it starts.
    ```bash
    docker exec ollama ollama pull nomic-embed-text
    ```
    *   Wait a few moments after `docker-compose up` before running this. You only need to do this once as the model will be persisted in a Docker volume.

5.  **Integration with MCP Client:**
    Configure your MCP client (e.g., in VS Code settings or another MCP server) to connect to this server. Since it's running via Docker Compose, you typically don't run it via `npx` directly in the client config. Instead, the client needs to know how to communicate with the running server (which isn't directly exposed by default in this setup, usually communication happens via other means like direct API calls if the server exposed an HTTP interface, or via shared volumes/databases if applicable).

    **Note:** The current setup primarily facilitates RAG via Genkit flows *within* this project or potentially other services within the same Docker network. Direct MCP client integration from an external host requires exposing the server's MCP port from the Docker container.

## Configuration (Environment Variables)

Configure the server via environment variables, typically set within the `docker-compose.yml` file for the `rag-server` service:

-   **`CHROMA_URL`**: URL of the ChromaDB service. (Default in compose: `http://chromadb:8000`)
-   **`OLLAMA_HOST`**: URL of the Ollama service. (Default in compose: `http://ollama:11434`)
-   **`INDEX_PROJECT_ON_STARTUP`**: Set to `true` (default) or `false` to enable/disable automatic indexing on server start.
-   **`INDEXING_EXCLUDE_PATTERNS`**: Comma-separated list of glob patterns to exclude from indexing (e.g., `**/node_modules/**,**/.git/**`). Defaults are defined in `autoIndexer.ts`.
-   **`GENKIT_ENV`**: Set to `production` or `development` (influences logging, etc.).
-   **`LOG_LEVEL`**: Set log level (e.g., `debug`, `info`, `warn`, `error`).

*(See `docker-compose.yml` and `src/config/genkit.ts` for more details)*

## Development

1.  **Prerequisites:** Node.js (LTS), npm.
2.  **Install Dependencies:** `npm install`
3.  **Build:** `npm run build`
4.  **Run Linters/Formatters:**
    *   `npm run lint`
    *   `npm run format`
    *   `npm run validate` (runs format check, lint, typecheck, tests)
5.  **Run Tests:**
    *   `npm test` (runs unit tests)
    *   `npm run test:cov` (runs unit tests with coverage)
    *   **E2E Tests:** Require Docker Compose environment running (`docker-compose up -d`). Run specific E2E tests via Vitest commands or potentially integrate into `npm test`. *(Note: E2E tests are currently failing due to external service interaction issues).*
6.  **Run Server Locally (without Docker):**
    *   Ensure ChromaDB and Ollama are running and accessible (e.g., locally installed or separate Docker containers).
    *   Set environment variables (`CHROMA_URL`, `OLLAMA_HOST`).
    *   `npm start`

## Contributing

Contributions are welcome! Please open an issue to discuss changes before submitting a pull request. Follow coding standards and commit conventions.

## License

This project is licensed under the [MIT License](LICENSE).
