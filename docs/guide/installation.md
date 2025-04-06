# Installation

This guide explains how to install and set up the MCP RAG Server.

## Prerequisites

- [Docker](https://www.docker.com/products/docker-desktop/) (Recommended for running dependencies)
- [Node.js](https://nodejs.org/) (Latest LTS version)
- [npm](https://www.npmjs.com/) (Bundled with Node.js)

## Using Docker Compose (Recommended)

This is the easiest way to get started, as it manages the server, ChromaDB, and Ollama.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/sylphlab/rag-server-mcp.git
    cd rag-server-mcp
    ```

2.  **Start the services:**
    ```bash
    docker-compose up -d --build
    ```
    This command builds the server image and starts all necessary services in the background.

3.  **Pull the embedding model (first time only):**
    ```bash
    docker exec ollama ollama pull nomic-embed-text
    ```
    Wait a moment for the Ollama container to be ready before running this.

The server should now be running within the Docker network. Refer to the Getting Started guide for configuration and usage.

## Manual Installation (Advanced)

*(Details for manual setup without Docker will be added here later.)*