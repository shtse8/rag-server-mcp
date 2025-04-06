/**
 * Document interface for the RAG system
 */
export interface Document {
  path: string;
  content: string;
  metadata: {
    source: string;
    score?: number;
  };
}

/**
 * Vector Store interface for the RAG system
 */
export interface VectorStore {
  removeDocument(docPath: string): Promise<void>;
  removeAllDocuments(): Promise<void>;
  addDocuments(docs: Document[]): Promise<void>;
  similaritySearch(query: string, k: number): Promise<Document[]>;
}
