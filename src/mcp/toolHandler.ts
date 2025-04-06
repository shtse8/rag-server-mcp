import {
  CallToolRequest,
} from "@modelcontextprotocol/sdk/types.js";
// Import the specific Genkit flows needed
import {
  indexDocumentsFlow,
  queryDocumentsFlow,
  removeDocumentFlow,    // Uncomment removeDocumentFlow
  removeAllDocumentsFlow, // Uncomment removeAllDocumentsFlow
  listDocumentsFlow,
} from "../rag/flows.js"; // Updated import path

/**
 * Handles incoming CallTool requests by routing them to the appropriate Genkit Flow.
 * @param request - The CallToolRequest object.
 * @returns A Promise resolving to the flow's output formatted for MCP.
 */
export async function handleToolCall(request: CallToolRequest) {
  const { name, arguments: args } = request.params;

  // Basic check for arguments object
  if (typeof args !== 'object' || args === null) {
    console.error(`Invalid or missing arguments object for tool: ${name}`);
    return {
      content: [{ type: "text", text: `Error: Invalid or missing arguments object for tool: ${name}` }],
    };
  }

  try {
    let flowResult: any; // To store the result from the Genkit flow

    switch (name) {
      case "index_documents":
        // Input validation is handled by the flow's inputSchema (Zod)
        // Use type assertion to satisfy TypeScript, Zod handles runtime validation
        await indexDocumentsFlow(args as any);
        return {
          content: [{ type: "text", text: `Successfully started indexing documents from ${args.path}` }],
          // Note: Flows might run async; this confirms the call was made.
          // For void outputSchema, we just confirm invocation.
        };

      case "query_documents":
        // Input validation handled by the flow
        // Use type assertion to satisfy TypeScript, Zod handles runtime validation
        flowResult = await queryDocumentsFlow(args as any);
        return {
          content: [{ type: "text", text: flowResult }], // Return the string result from the flow
        };

      case "remove_document": { // Add block scope
         // Use type assertion, Zod handles runtime validation
         await removeDocumentFlow(args as any);
         return { content: [{ type: "text", text: `Successfully requested removal of document: ${args.path}` }] };
      } // Close block scope


      case "remove_all_documents": { // Add block scope
         // Use type assertion, Zod handles runtime validation
         // Confirmation check is now inside the flow, but we can keep a basic check here too
         if (args.confirm === true) {
           await removeAllDocumentsFlow(args as any);
           return { content: [{ type: "text", text: "Successfully requested removal of all documents." }] };
         } else {
           // Return error if confirmation is not explicitly true
           return { content: [{ type: "text", text: "Error: Confirmation flag 'confirm: true' is required." }] };
         }
      } // Close block scope


      case "list_documents": { // Add block scope for lexical declarations
         // Call the listDocumentsFlow (no args needed)
         const flowResult = await listDocumentsFlow();
         const paths = flowResult as string[]; // Flow outputSchema is z.array(z.string())
         const textResult = paths.length === 0
           ? "No documents found in the index."
           : `Found ${paths.length} unique document paths in the index:\n\n${paths.map(p => `- ${p}`).join("\n")}`;
         return { content: [{ type: "text", text: textResult }] };
      } // Close block scope

      default:
        console.error(`Unknown tool: ${name}`);
        return {
          content: [{ type: "text", text: `Error: Unknown tool: ${name}` }],
        };
    }
  } catch (error) {
    // Catch errors from flow execution (including Zod validation errors)
    console.error(`Error executing Genkit flow for tool ${name}:`, error);
    return {
      content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
    };
  }
}