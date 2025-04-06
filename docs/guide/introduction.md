# Introduction

Welcome to the documentation for the **MCP RAG Server**.

This project provides a [Model Context Protocol (MCP)](https://developer.modelcontext.dev/) server designed to enable Retrieval Augmented Generation (RAG) capabilities for connected LLMs.

## What is RAG?

Retrieval Augmented Generation is a technique that enhances the knowledge base of Large Language Models (LLMs) with external, up-to-date information. Instead of relying solely on its training data, the LLM first retrieves relevant documents or passages from a specified corpus (like your project files) based on the user's query. This retrieved information is then provided as context to the LLM along with the original query, allowing it to generate more accurate, relevant, and context-aware responses.

## How MCP RAG Server Helps

This server bridges the gap between general-purpose LLMs and your specific project documentation or knowledge base within the MCP ecosystem.

- **Indexes Your Documents:** It automatically scans your project's working directory (respecting `.gitignore`), chunks the content of supported files (text, markdown, code), generates vector embeddings, and stores them locally using ChromaDB.
- **Provides MCP Tools:** It exposes tools through the MCP, allowing connected clients (like other MCP servers or development environments) to:
    - Query the indexed documents.
    - Retrieve relevant chunks based on a query.
    - Manage the document index (e.g., list indexed files, remove documents).
- **Enhances LLM Responses:** By providing relevant document snippets as context, LLMs connected via MCP can answer questions about your specific codebase, documentation, or data with much higher accuracy and relevance.

## Next Steps

- **Installation:** Learn how to set up and run the server. (To be written)
- **Quick Start:** A brief guide to indexing your first documents and querying them. (To be written)
- **API Reference:** Detailed documentation of the MCP tools provided by the server. (To be generated)