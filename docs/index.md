---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: 'MCP RAG Server'
  text: 'Retrieval Augmented Generation for MCP'
  tagline: Enhance your MCP-connected LLMs with knowledge from your own documents.
  actions:
    - theme: brand
      text: Introduction
      link: /guide/introduction
    - theme: alt
      text: View on GitHub
      link: https://github.com/shtse8/rag-server-mcp

features:
  - title: Document Indexing
    details: Automatically scans and indexes documents (text, markdown, code) from your project directory.
  - title: Contextual Augmentation
    details: Retrieves relevant document chunks based on queries to provide context to LLMs.
  - title: MCP Integration
    details: Exposes RAG capabilities as standard MCP tools for seamless integration.
---
