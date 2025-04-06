#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
// RagManager is now used within toolHandler
import { handleToolCall } from "./toolHandler.js";
import { startIndexing } from "../indexing/autoIndexer.js"; // Re-import startIndexing

const server = new Server(
  {
    name: "rag-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "index_documents",
        description: "Add documents from specified path for RAG Indexing",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Path containing files/directories to index (relative to CWD)",
            },
            // projectId removed - server operates on its CWD
          },
          required: ["path"],
        },
      },
      {
        name: "query_documents",
        description: "Query indexed documents using RAG",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "The question to search documents for",
            },
            // projectId removed
            k: {
              type: "number",
              description: "Number of chunks to return (default: 15)",
            },
            filter: {
              type: "object",
              description: "Optional metadata filter (e.g., {\"contentType\": \"code\"})",
              additionalProperties: true,
            },
          },
          required: ["query"], // Only query is required now
        },
      },
      {
        name: "remove_document",
        description: "Remove a specific document from the index by file path",
        inputSchema: {
          type: "object",
          properties: {
            path: {
              type: "string",
              description: "Source path of the document/file to remove (relative to CWD)",
            },
            // projectId removed
          },
          required: ["path"],
        },
      },
      {
        name: "remove_all_documents",
        description: "Remove all documents from the index",
        inputSchema: {
          type: "object",
          properties: {
            // projectId removed - operates on the current CWD's index
            confirm: {
              type: "boolean",
              description: "Confirmation flag (must be true) to remove all indexed data for this project (CWD)",
            },
          },
          required: ["confirm"],
        },
      },
      {
        name: "list_documents",
        description: "List all document paths in the index",
        inputSchema: {
          type: "object",
          properties: {
             // projectId removed - lists documents for the current CWD's index
          },
          // No required properties anymore
        },
      },
    ],
  };
});

// Delegate tool calls to the dedicated handler
server.setRequestHandler(CallToolRequestSchema, handleToolCall);

async function main() {
  try {
    // Restore auto-indexing logic
    // Check environment variable to control auto-indexing (default to true if not set)
    const shouldAutoIndex = process.env.INDEX_PROJECT_ON_STARTUP !== 'false';

    if (shouldAutoIndex) {
      // Start indexing in the background, do not await
      startIndexing().catch((err: unknown) => { // Add type annotation for err
        console.error("[Server Startup] Background indexing failed:", err);
        // Decide if this should be a fatal error for the server?
        // For now, just log it and let the server continue.
      });
    } else {
      console.log("[Server Startup] Automatic project indexing is disabled via INDEX_PROJECT_ON_STARTUP=false.");
    }

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.info("RAG MCP Server running on stdio");
  } catch (error) {
    handleFatalError("Error during server initialization:", error);
  }
}

function handleFatalError(message: string, error: unknown): void {
  console.error(
    message,
    error instanceof Error ? error.message : String(error)
  );
  process.exit(1);
}

main();
