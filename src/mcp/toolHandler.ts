import { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
// Import the specific Genkit flows needed
import {
  indexDocumentsFlow,
  queryDocumentsFlow,
  removeDocumentFlow, // Uncomment removeDocumentFlow
  removeAllDocumentsFlow, // Uncomment removeAllDocumentsFlow
  listDocumentsFlow,
} from '../rag/flows.js'; // Updated import path

// Define interfaces for tool arguments based on server schema
interface IndexDocumentsArgs {
  path: string;
}
interface QueryDocumentsArgs {
  query: string;
  k?: number;
  filter?: Record<string, unknown>;
}
interface RemoveDocumentArgs {
  path: string;
}
interface RemoveAllDocumentsArgs {
  confirm: boolean;
}
// list_documents has no arguments

/**
 * Handles incoming CallTool requests by routing them to the appropriate Genkit Flow.
 * @param request - The CallToolRequest object.
 * @returns A Promise resolving to the flow's output formatted for MCP.
 */
export async function handleToolCall(request: CallToolRequest) {
  const { name, arguments: rawArgs } = request.params; // Rename to rawArgs

  // Use unknown for initial args type, check if it's an object
  const args: unknown = rawArgs;
  if (typeof args !== 'object' || args === null) {
    // This check might be redundant if MCP SDK guarantees args is object | undefined
    // but keep for robustness. The ESLint error for this line will be ignored
    // as it provides safety against unexpected inputs.
    console.error(`Invalid or missing arguments object for tool: ${name}`);
    return {
      content: [
        {
          type: 'text',
          text: `Error: Invalid or missing arguments object for tool: ${name}`,
        },
      ],
    };
  }

  // Helper type guard functions
  function isIndexDocumentsArgs(obj: unknown): obj is IndexDocumentsArgs {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      'path' in obj &&
      typeof (obj as IndexDocumentsArgs).path === 'string'
    );
  }
  function isQueryDocumentsArgs(obj: unknown): obj is QueryDocumentsArgs {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      'query' in obj &&
      typeof (obj as QueryDocumentsArgs).query === 'string'
    );
    // Note: Optional fields k and filter are not strictly checked here,
    // Zod validation within the flow handles that.
  }
  function isRemoveDocumentArgs(obj: unknown): obj is RemoveDocumentArgs {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      'path' in obj &&
      typeof (obj as RemoveDocumentArgs).path === 'string'
    );
  }
  function isRemoveAllDocumentsArgs(
    obj: unknown,
  ): obj is RemoveAllDocumentsArgs {
    return (
      typeof obj === 'object' &&
      obj !== null &&
      'confirm' in obj &&
      typeof (obj as RemoveAllDocumentsArgs).confirm === 'boolean'
    );
  }

  try {
    // Use a more specific type for flowResult later if possible, start with unknown
    let flowResult: unknown;

    switch (name) {
      case 'index_documents': {
        // Add block scope
        if (!isIndexDocumentsArgs(args)) {
          throw new Error(
            'Invalid arguments for index_documents. Required: { path: string }',
          );
        }
        // Type guard passed, args is now IndexDocumentsArgs
        await indexDocumentsFlow(args);
        return {
          content: [
            {
              type: 'text',
              text: `Successfully started indexing documents from ${args.path}`, // args is now typed
            },
          ],
          // Note: Flows might run async; this confirms the call was made.
          // For void outputSchema, we just confirm invocation.
        };
      } // Close block scope for index_documents

      case 'query_documents': {
        // Add block scope
        if (!isQueryDocumentsArgs(args)) {
          throw new Error(
            'Invalid arguments for query_documents. Required: { query: string }',
          );
        }
        // Type guard passed, args is now QueryDocumentsArgs
        // Flow returns string, so cast flowResult
        flowResult = await queryDocumentsFlow(args);
        if (typeof flowResult !== 'string') {
          throw new Error('queryDocumentsFlow did not return a string');
        }
        return {
          content: [{ type: 'text', text: flowResult }],
        };
      } // Close block scope for query_documents

      case 'remove_document': {
        if (!isRemoveDocumentArgs(args)) {
          throw new Error(
            'Invalid arguments for remove_document. Required: { path: string }',
          );
        }
        // Type guard passed, args is now RemoveDocumentArgs
        await removeDocumentFlow(args);
        return {
          content: [
            {
              type: 'text',
              text: `Successfully requested removal of document: ${args.path}`, // args is now typed
            },
          ],
        };
      } // Close block scope

      case 'remove_all_documents': {
        if (!isRemoveAllDocumentsArgs(args)) {
          throw new Error(
            'Invalid arguments for remove_all_documents. Required: { confirm: boolean }',
          );
        }
        // Type guard passed, args is now RemoveAllDocumentsArgs
        // Confirmation check is now inside the flow, but we can keep a basic check here too
        if (args.confirm) {
          // Accessing typed args.confirm directly
          await removeAllDocumentsFlow(args);
          return {
            content: [
              {
                type: 'text',
                text: 'Successfully requested removal of all documents.',
              },
            ],
          };
        } else {
          // Return error if confirmation is not explicitly true
          return {
            content: [
              {
                type: 'text',
                text: "Error: Confirmation flag 'confirm: true' is required.",
              },
            ],
          };
        }
      } // Close block scope

      case 'list_documents': {
        // Add block scope for lexical declarations
        // Call the listDocumentsFlow (no args needed)
        flowResult = await listDocumentsFlow(); // Assign to flowResult
        // Ensure flowResult is string[] before proceeding
        if (
          !Array.isArray(flowResult) ||
          !flowResult.every((item) => typeof item === 'string')
        ) {
          throw new Error('listDocumentsFlow did not return a string array');
        }
        const paths = flowResult; // paths is now string[]
        const textResult =
          paths.length === 0
            ? 'No documents found in the index.'
            : `Found ${paths.length.toString()} unique document paths in the index:\n\n${paths.map((p) => `- ${p}`).join('\n')}`; // Use toString()
        return { content: [{ type: 'text', text: textResult }] };
      } // Close block scope

      default:
        console.error(`Unknown tool: ${name}`);
        return {
          content: [{ type: 'text', text: `Error: Unknown tool: ${name}` }],
        };
    }
  } catch (error) {
    // Catch errors from flow execution (including Zod validation errors)
    console.error(`Error executing Genkit flow for tool ${name}:`, error);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    };
  }
}
