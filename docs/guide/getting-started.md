# Getting Started

This guide provides a quick overview of how to configure and use the MCP RAG Server after installation.

## Configuration

The server is primarily configured using environment variables. If you are using the recommended Docker Compose setup, these variables are set in the `docker-compose.yml` file for the `rag-server` service.

Key variables:

-   `CHROMA_URL`: URL for the ChromaDB service (e.g., `http://chromadb:8000`).
-   `OLLAMA_HOST`: URL for the Ollama service (e.g., `http://ollama:11434`).
-   `INDEX_PROJECT_ON_STARTUP`: `true` or `false` (default: `true`) to control automatic indexing when the server starts.
-   `INDEXING_EXCLUDE_PATTERNS`: Comma-separated glob patterns to exclude files/directories.

Refer to the `README.md` for a more comprehensive list.

## Automatic Indexing

By default (`INDEX_PROJECT_ON_STARTUP=true`), the server will automatically scan the current working directory (where the server is running, or the mounted volume in Docker) and index all supported files into ChromaDB when it starts. This process runs in the background.

## Using MCP Tools

Once the server is running and connected to your MCP client (like the VS Code extension), you can use the provided tools:

-   **`queryDocuments`**:
    -   **Input:** `query` (string), `k` (number, optional, default: 5), `filter` (object, optional, e.g., `{ contentType: 'markdown' }`)
    -   **Output:** An array of relevant document chunks based on your query.
    ```json
    // Example MCP client request
    {
      "tool": "queryDocuments",
      "arguments": {
        "query": "How does the chunking work?",
        "k": 3
      }
    }
    ```

-   **`indexDocuments`**: (Manual indexing)
    -   **Input:** `path` (string, relative path to file or directory)
    -   **Output:** Status message.

-   **`listDocuments`**:
    -   **Input:** None
    -   **Output:** Array of indexed source file paths.

-   **`removeDocument`**:
    -   **Input:** `path` (string, relative path of the document to remove)
    -   **Output:** Status message.

-   **`removeAllDocuments`**:
    -   **Input:** None
    -   **Output:** Status message.

## Next Steps

-   Explore the [API Reference](/api/) for detailed tool schemas.
-   Customize the configuration based on your project needs.