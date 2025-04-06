import { genkit } from 'genkit'; // Remove GenkitConfig type
import { ollama } from 'genkitx-ollama';
import { chroma, chromaIndexerRef, chromaRetrieverRef } from 'genkitx-chromadb'; // Corrected import names
import { UNIFIED_COLLECTION_NAME } from '../indexing/autoIndexer.js'; // Import the unified name
// Remove devLocalVectorstore import
// import { devLocalVectorstore } from '@genkit-ai/dev-local-vectorstore';

// Define the embedder model reference (can be shared)
const embedderRef = 'ollama/nomic-embed-text';


// Define the configuration object (TypeScript will infer the type)
const config = {
  plugins: [
    ollama({
      serverAddress: 'http://localhost:11434',
      models: [
        { name: embedderRef }, // Use the defined reference
        // Add other models like llama3 if needed
        // { name: 'llama3' }
      ],
    }),
    // Configure the ChromaDB plugin; it expects an array of collection configs
    chroma([
      {
        collectionName: UNIFIED_COLLECTION_NAME, // Use the unified collection name
        embedder: embedderRef, // Specify the embedder (same as before)
        // Optional: Specify ChromaDB address if not default localhost:8000
        // clientParams: { path: 'http://localhost:8000' },
      }
    ]),
  ],
  // Flow state and trace stores (optional, defaults to in-memory)
  // flowStateStore: 'firebase', // Example using Firebase Firestore
  // traceStore: 'firebase', // Example using Firebase RTDB (or Google Cloud Trace)

  // Optional settings (if needed and valid)
  // logLevel: 'debug',
  // enableTracingAndMetrics: true,
};

// Export the configuration
export default config;