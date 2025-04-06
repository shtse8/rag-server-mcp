<!-- Version: 0.2 | Last Updated: 2025-06-04 -->

# Project Brief

This project, `mcp-rag-server`, is a Model Context Protocol (MCP) server designed to provide Retrieval Augmented Generation (RAG) capabilities. Its primary function is to enable Large Language Models (LLMs) connected via MCP clients to access and utilize information from a user-provided document corpus for generating contextually relevant responses.

The server indexes documents, creates vector embeddings, stores them locally, and retrieves relevant document chunks based on user queries to augment the LLM's context.
