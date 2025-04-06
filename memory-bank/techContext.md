<!-- Version: 0.4 | Last Updated: 2025-06-04 -->

# Tech Context

**Language:** TypeScript
**Runtime:** Node.js (module system)
**Package Manager:** npm

**Core AI Framework:** Google Genkit (`genkit`)

- **Plugins:**
  - `genkitx-ollama`: For local Ollama models (embedding).
  - `genkitx-chromadb`: For persistent vector storage using ChromaDB.
  - `@genkit-ai/dotprompt`: For prompt management (if used).
- **Schema Validation:** `zod`.

**Testing Framework:** Vitest (`vitest`, `@vitest/coverage-v8`)

**Key Dependencies:**

- `@modelcontextprotocol/sdk`: For MCP server implementation.
- `genkit`: Core Genkit framework.
- `genkitx-ollama`: Ollama integration.
- `genkitx-chromadb`: ChromaDB integration.
- `zod`: Schema definition and validation.

**Build System:** `tsc` (TypeScript Compiler).
**Linting:** ESLint with TypeScript support.

**Configuration:**

- MCP Server: Standard MCP setup in `src/mcp/server.ts`.
- Genkit: Central configuration in `src/config/genkit.ts`.
- ChromaDB: Assumes local instance running at default port (localhost:8000), configured in `src/config/genkit.ts`.
- Ollama: Assumes local instance running at default port (localhost:11434), configured in `src/config/genkit.ts`.

**Development Scripts:**

- `npm run build`: Compiles TypeScript.
- `npm start`: Runs the compiled server.
- `npm run watch`: Compiles in watch mode.
- `npm run inspect`: Runs server with MCP Inspector.
- `npm test`: Runs Vitest tests.
- `npm run test:watch`: Runs Vitest in watch mode.
- `npm run coverage`: Runs tests with coverage.
