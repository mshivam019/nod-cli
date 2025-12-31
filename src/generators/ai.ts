import fs from 'fs-extra';
import * as path from 'path';
import { ProjectConfig, EmbeddingProvider, VectorStore, LLMProvider, ChatDatabase } from '../types/index.js';

// ============================================================================
// RAG SERVICE GENERATION
// ============================================================================

export async function generateRAGService(projectPath: string, config: ProjectConfig, ext: string) {
  const isTS = ext === 'ts';
  const embeddingProvider = config.ai?.embeddings || 'openai';
  const vectorStore = config.ai?.vectorStore || 'supabase';
  
  // Generate retriever utility based on embedding provider
  const retrieverContent = generateRetrieverContent(isTS, embeddingProvider, vectorStore);
  
  // Generate RAG service based on vector store
  const ragServiceContent = generateRAGServiceContent(isTS, vectorStore);

  await fs.ensureDir(path.join(projectPath, 'src/utils'));
  await fs.ensureDir(path.join(projectPath, 'src/services'));
  await fs.outputFile(path.join(projectPath, `src/utils/retriever.${ext}`), retrieverContent);
  await fs.outputFile(path.join(projectPath, `src/services/rag.service.${ext}`), ragServiceContent);
}

function generateRetrieverContent(isTS: boolean, embeddingProvider: EmbeddingProvider, vectorStore: VectorStore): string {
  const typeAnnotations = isTS ? ': string' : '';
  
  // Import statements based on provider
  let imports = '';
  let embeddingInit = '';
  let clientInit = '';
  
  // Embedding provider imports and initialization
  if (embeddingProvider === 'openai') {
    imports += `import { OpenAIEmbeddings } from '@langchain/openai';\n`;
    embeddingInit = `export const embeddings = new OpenAIEmbeddings({ 
  openAIApiKey: process.env.OPENAI_API_KEY,
  model: 'text-embedding-3-small'
});`;
  } else if (embeddingProvider === 'gemini') {
    imports += `import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';\n`;
    embeddingInit = `export const embeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GOOGLE_API_KEY,
  model: 'embedding-001'
});`;
  } else if (embeddingProvider === 'cohere') {
    imports += `import { CohereEmbeddings } from '@langchain/cohere';\n`;
    embeddingInit = `export const embeddings = new CohereEmbeddings({
  apiKey: process.env.COHERE_API_KEY,
  model: 'embed-english-v3.0'
});`;
  }
  
  // Vector store client imports and initialization
  if (vectorStore === 'supabase') {
    imports += `import { createClient } from '@supabase/supabase-js';\n`;
    clientInit = `const sbApiKey = process.env.SUPABASE_API_KEY;
const sbUrl = process.env.SUPABASE_URL;
export const client = createClient(sbUrl${isTS ? '!' : ''}, sbApiKey${isTS ? '!' : ''});
export const supabaseAuthAdmin = client.auth.admin;`;
  } else if (vectorStore === 'pinecone') {
    imports += `import { Pinecone } from '@pinecone-database/pinecone';\n`;
    clientInit = `export const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY${isTS ? '!' : ''}
});
export const pineconeIndex = pinecone.index(process.env.PINECONE_INDEX${isTS ? '!' : ''});`;
  } else if (vectorStore === 'chroma') {
    imports += `import { ChromaClient } from 'chromadb';\n`;
    clientInit = `export const chromaClient = new ChromaClient({
  path: process.env.CHROMA_URL || 'http://localhost:8000'
});`;
  } else if (vectorStore === 'weaviate') {
    imports += `import weaviate from 'weaviate-ts-client';\n`;
    clientInit = `export const weaviateClient = weaviate.client({
  scheme: 'https',
  host: process.env.WEAVIATE_URL${isTS ? '!' : ''},
  apiKey: new weaviate.ApiKey(process.env.WEAVIATE_API_KEY${isTS ? '!' : ''})
});`;
  }
  
  imports += `import dotenv from 'dotenv';
dotenv.config();\n`;

  return `${imports}
${embeddingInit}

${clientInit}
`;
}

function generateRAGServiceContent(isTS: boolean, vectorStore: VectorStore): string {
  const typeAnnotations = {
    text: isTS ? ': string' : '',
    numberArray: isTS ? ': number[]' : '',
    any: isTS ? ': any' : '',
    void: isTS ? ': void' : '',
    string: isTS ? ': string' : '',
  };
  
  let vectorSearchImpl = '';
  let storeDocumentImpl = '';
  
  if (vectorStore === 'supabase') {
    vectorSearchImpl = `const { data, error } = await client.rpc(matchFunction, {
        query_embedding: queryEmbedding,
        match_count: matchCount,
      });
      
      if (error) {
        logger.error('Vector search failed:', error.message);
        throw error;
      }
      
      return (data || [])
        .filter((d${typeAnnotations.any}) => d.similarity >= minSimilarity)
        .map((d${typeAnnotations.any}) => ({
          content: d.content,
          metadata: d.metadata,
          similarity: d.similarity
        }));`;
    
    storeDocumentImpl = `const { error } = await client
        .from(tableName)
        .insert({
          content,
          embedding,
          metadata
        });
      
      if (error) {
        logger.error('Error storing document:', error.message);
        throw error;
      }`;
  } else if (vectorStore === 'pinecone') {
    vectorSearchImpl = `const results = await pineconeIndex.query({
        vector: queryEmbedding,
        topK: matchCount,
        includeMetadata: true
      });
      
      return (results.matches || [])
        .filter((m${typeAnnotations.any}) => (m.score || 0) >= minSimilarity)
        .map((m${typeAnnotations.any}) => ({
          content: m.metadata?.content || '',
          metadata: m.metadata,
          similarity: m.score || 0
        }));`;
    
    storeDocumentImpl = `await pineconeIndex.upsert([{
        id: \`doc_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`,
        values: embedding,
        metadata: { content, ...metadata }
      }]);`;
  } else if (vectorStore === 'chroma') {
    vectorSearchImpl = `const collection = await chromaClient.getCollection({ name: tableName || 'documents' });
      const results = await collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: matchCount
      });
      
      return (results.documents?.[0] || []).map((doc${typeAnnotations.any}, i${isTS ? ': number' : ''}) => ({
        content: doc || '',
        metadata: results.metadatas?.[0]?.[i] || {},
        similarity: results.distances?.[0]?.[i] ? 1 - results.distances[0][i] : 0
      })).filter((r${typeAnnotations.any}) => r.similarity >= minSimilarity);`;
    
    storeDocumentImpl = `const collection = await chromaClient.getOrCreateCollection({ name: tableName });
      await collection.add({
        ids: [\`doc_\${Date.now()}_\${Math.random().toString(36).substr(2, 9)}\`],
        embeddings: [embedding],
        documents: [content],
        metadatas: [metadata]
      });`;
  } else if (vectorStore === 'weaviate') {
    vectorSearchImpl = `const result = await weaviateClient.graphql
        .get()
        .withClassName(tableName || 'Document')
        .withFields('content _additional { certainty }')
        .withNearVector({ vector: queryEmbedding })
        .withLimit(matchCount)
        .do();
      
      return (result.data?.Get?.[tableName || 'Document'] || [])
        .filter((d${typeAnnotations.any}) => (d._additional?.certainty || 0) >= minSimilarity)
        .map((d${typeAnnotations.any}) => ({
          content: d.content,
          metadata: d,
          similarity: d._additional?.certainty || 0
        }));`;
    
    storeDocumentImpl = `await weaviateClient.data
        .creator()
        .withClassName(tableName)
        .withProperties({ content, ...metadata })
        .withVector(embedding)
        .do();`;
  }

  // Build import statement based on vector store
  let importStatement = `import logger from '../utils/logger.js';\n`;
  if (vectorStore === 'supabase') {
    importStatement += `import { client, embeddings } from '../utils/retriever.js';`;
  } else if (vectorStore === 'pinecone') {
    importStatement += `import { pineconeIndex, embeddings } from '../utils/retriever.js';`;
  } else if (vectorStore === 'chroma') {
    importStatement += `import { chromaClient, embeddings } from '../utils/retriever.js';`;
  } else if (vectorStore === 'weaviate') {
    importStatement += `import { weaviateClient, embeddings } from '../utils/retriever.js';`;
  }

  const interfaceDefinitions = isTS ? `
interface VectorSearchOptions {
  matchCount?: number;
  tableName?: string;
  matchFunction?: string;
  minSimilarity?: number;
}

interface SearchResult {
  content: string;
  metadata: any;
  similarity: number;
}

` : '';

  const returnType = isTS ? ': Promise<number[]>' : '';
  const searchReturnType = isTS ? ': Promise<SearchResult[]>' : '';
  const contextReturnType = isTS ? ': Promise<string>' : '';
  const storeReturnType = isTS ? ': Promise<void>' : '';
  const optionsType = isTS ? ': VectorSearchOptions' : '';

  return `${importStatement}

// Create embedding for query text
const createQueryEmbedding = async (text${typeAnnotations.text})${returnType} => {
  try {
    const [embedding] = await embeddings.embedDocuments([text]);
    return embedding;
  } catch (error${typeAnnotations.any}) {
    logger.error('Error creating query embedding:', error.message);
    throw error;
  }
};
${interfaceDefinitions}
const ragService = {
  /**
   * Perform vector similarity search
   */
  async vectorSearch(queryText${typeAnnotations.text}, options${optionsType} = {})${searchReturnType} {
    const { 
      matchCount = 10, 
      ${vectorStore === 'supabase' ? "matchFunction = 'match_documents'," : "tableName = 'documents',"}
      minSimilarity = 0.5 
    } = options;
    
    try {
      const queryEmbedding = await createQueryEmbedding(queryText);
      
      ${vectorSearchImpl}
    } catch (error${typeAnnotations.any}) {
      logger.error('Error in vector search:', error.message);
      throw error;
    }
  },

  /**
   * Get context for RAG-enhanced responses
   */
  async getContext(query${typeAnnotations.text}, options${optionsType} = {})${contextReturnType} {
    const results = await this.vectorSearch(query, options);
    
    if (results.length === 0) {
      return '';
    }
    
    return results
      .map((r, i) => \`[Source \${i + 1}] (Relevance: \${(r.similarity * 100).toFixed(1)}%)\n\${r.content}\`)
      .join('\\n\\n');
  },

  /**
   * Create and store embeddings for documents
   */
  async createEmbedding(text${typeAnnotations.text})${returnType} {
    return createQueryEmbedding(text);
  },

  /**
   * Store document with embedding
   */
  async storeDocument(
    tableName${typeAnnotations.text},
    content${typeAnnotations.text},
    metadata${typeAnnotations.any} = {}
  )${storeReturnType} {
    try {
      const embedding = await createQueryEmbedding(content);
      
      ${storeDocumentImpl}
      
      logger.info('Document stored successfully');
    } catch (error${typeAnnotations.any}) {
      logger.error('Error in storeDocument:', error.message);
      throw error;
    }
  }
};

export default ragService;
`;
}

// ============================================================================
// RAG SCHEMA GENERATION
// ============================================================================

export async function generateRAGSchema(projectPath: string, vectorStore: VectorStore, ext: string) {
  await fs.ensureDir(path.join(projectPath, 'sql'));
  
  let schemaContent = '';
  
  if (vectorStore === 'supabase' || vectorStore === 'none') {
    schemaContent = `-- RAG Schema for Supabase (pgvector)
-- Run this in your Supabase SQL Editor

-- Enable the pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create documents table for storing embeddings
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  embedding vector(1536), -- OpenAI text-embedding-3-small dimension
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster similarity search
CREATE INDEX IF NOT EXISTS documents_embedding_idx ON documents 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Create function for similarity search
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.content,
    d.metadata,
    1 - (d.embedding <=> query_embedding) AS similarity
  FROM documents d
  ORDER BY d.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Create RLS policies (optional - uncomment if needed)
-- ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow public read" ON documents FOR SELECT USING (true);
-- CREATE POLICY "Allow authenticated insert" ON documents FOR INSERT WITH CHECK (auth.role() = 'authenticated');
`;
  } else if (vectorStore === 'pinecone') {
    schemaContent = `# Pinecone Setup Instructions

Pinecone is a managed vector database - no SQL schema needed.

## Setup Steps:

1. Create an account at https://www.pinecone.io/
2. Create a new index with the following settings:
   - Dimensions: 1536 (for OpenAI text-embedding-3-small)
   - Metric: cosine
   - Pod Type: Choose based on your needs (starter/s1/p1/p2)

3. Add the following to your .env file:
   PINECONE_API_KEY=your-api-key
   PINECONE_INDEX=your-index-name

## Index Configuration (via API or Console):

\`\`\`javascript
// If creating via API:
const pinecone = new Pinecone({ apiKey: 'your-api-key' });
await pinecone.createIndex({
  name: 'your-index-name',
  dimension: 1536,
  metric: 'cosine',
  spec: {
    serverless: {
      cloud: 'aws',
      region: 'us-east-1'
    }
  }
});
\`\`\`
`;
  } else if (vectorStore === 'chroma') {
    schemaContent = `# Chroma Setup Instructions

Chroma is a local/self-hosted vector database.

## Option 1: Run locally with Docker

\`\`\`bash
docker run -d -p 8000:8000 chromadb/chroma
\`\`\`

## Option 2: Run with docker-compose

Add to your docker-compose.yml:
\`\`\`yaml
services:
  chroma:
    image: chromadb/chroma:latest
    ports:
      - "8000:8000"
    volumes:
      - chroma_data:/chroma/chroma

volumes:
  chroma_data:
\`\`\`

## Environment Variables

Add to your .env:
\`\`\`
CHROMA_URL=http://localhost:8000
\`\`\`

## Collection Creation (automatic)

Collections are created automatically when you first store a document.
Default collection name: 'documents'
`;
  } else if (vectorStore === 'weaviate') {
    schemaContent = `# Weaviate Setup Instructions

## Option 1: Weaviate Cloud (Recommended for production)

1. Create an account at https://console.weaviate.cloud/
2. Create a new cluster
3. Get your API key and cluster URL

## Option 2: Self-hosted with Docker

\`\`\`bash
docker run -d -p 8080:8080 \\
  -e AUTHENTICATION_ANONYMOUS_ACCESS_ENABLED=true \\
  -e PERSISTENCE_DATA_PATH=/var/lib/weaviate \\
  -e QUERY_DEFAULTS_LIMIT=20 \\
  -e DEFAULT_VECTORIZER_MODULE=none \\
  semitechnologies/weaviate:latest
\`\`\`

## Environment Variables

Add to your .env:
\`\`\`
WEAVIATE_URL=your-cluster-url.weaviate.network
WEAVIATE_API_KEY=your-api-key
\`\`\`

## Schema Creation

Run this to create the Document class:

\`\`\`javascript
const schemaConfig = {
  class: 'Document',
  properties: [
    { name: 'content', dataType: ['text'] },
    { name: 'metadata', dataType: ['object'] },
    { name: 'createdAt', dataType: ['date'] }
  ],
  vectorizer: 'none' // We provide our own vectors
};

await weaviateClient.schema.classCreator().withClass(schemaConfig).do();
\`\`\`
`;
  }
  
  const filename = vectorStore === 'pinecone' || vectorStore === 'chroma' || vectorStore === 'weaviate' 
    ? 'rag-schema.md' 
    : 'rag-schema.sql';
  
  await fs.outputFile(path.join(projectPath, `sql/${filename}`), schemaContent);

  // Update Drizzle schema if it exists and using postgres/supabase
  if (vectorStore === 'supabase' || vectorStore === 'none') {
    const schemaPath = path.join(projectPath, `src/db/schema.${ext}`);
    if (await fs.pathExists(schemaPath)) {
      let currentSchema = await fs.readFile(schemaPath, 'utf-8');
      
      if (!currentSchema.includes('export const documents')) {
        // Add vector to imports if not present
        if (!currentSchema.includes('vector')) {
          if (currentSchema.includes("from 'drizzle-orm/pg-core'")) {
            currentSchema = currentSchema.replace(
              /import { (.*?) } from 'drizzle-orm\/pg-core';/, 
              "import { $1, vector } from 'drizzle-orm/pg-core';"
            );
          } else {
            // Fallback if import line is different or not found (unlikely in our generated code)
            const importLine = ext === 'ts' 
              ? "import { pgTable, uuid, text, timestamp, jsonb, vector } from 'drizzle-orm/pg-core';"
              : "import { pgTable, uuid, text, timestamp, jsonb, vector } from 'drizzle-orm/pg-core';";
             currentSchema = importLine + '\n' + currentSchema;
          }
        }

        const drizzleContent = `
// RAG Documents table
export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  content: text('content').notNull(),
  metadata: jsonb('metadata').default({}),
  embedding: vector('embedding', { dimensions: 1536 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => ({
  embeddingIdx: index('documents_embedding_idx').using('ivfflat', table.embedding.op('vector_cosine_ops')),
}));
`;
        // We also need to import 'index' if we use it
        if (!currentSchema.includes('index')) {
           currentSchema = currentSchema.replace(
              /import { (.*?) } from 'drizzle-orm\/pg-core';/, 
              "import { $1, index } from 'drizzle-orm/pg-core';"
            );
        }

        await fs.writeFile(schemaPath, currentSchema + drizzleContent);
        console.log('✓ Updated Drizzle schema with documents table');
      }
    }
  }
}

// ============================================================================
// RAG ROUTES GENERATION
// ============================================================================

export async function generateRAGRoutes(projectPath: string, framework: string, ext: string) {
  const isTS = ext === 'ts';
  await fs.ensureDir(path.join(projectPath, 'src/routes'));
  
  let routesContent = '';
  
  if (framework === 'express') {
    routesContent = isTS ? `import { Router } from 'express';
import { DeclarativeRouter, METHODS } from '../helpers/route-builder.js';
import ragController from '../controllers/rag.controller.js';

const router = Router();

/**
 * Default middlewares for RAG routes
 * All routes are protected by default
 */
const defaultMiddlewares: string[] = [];
const defaultRoles: string[] = [];

/**
 * RAG route definitions
 */
const routes = [
  {
    method: METHODS.POST,
    path: '/search',
    handler: ragController.search
  },
  {
    method: METHODS.POST,
    path: '/context',
    handler: ragController.getContext
  },
  {
    method: METHODS.POST,
    path: '/documents',
    handler: ragController.storeDocument
  },
  {
    method: METHODS.POST,
    path: '/embed',
    handler: ragController.createEmbedding
  },
];

const dr = new DeclarativeRouter({ defaultMiddlewares, defaultRoles, routes });
dr.applyToExpress(router);

export default router;
` : `import { Router } from 'express';
import { DeclarativeRouter, METHODS } from '../helpers/route-builder.js';
import ragController from '../controllers/rag.controller.js';

const router = Router();

/**
 * Default middlewares for RAG routes
 */
const defaultMiddlewares = [];
const defaultRoles = [];

/**
 * RAG route definitions
 */
const routes = [
  {
    method: METHODS.POST,
    path: '/search',
    handler: ragController.search
  },
  {
    method: METHODS.POST,
    path: '/context',
    handler: ragController.getContext
  },
  {
    method: METHODS.POST,
    path: '/documents',
    handler: ragController.storeDocument
  },
  {
    method: METHODS.POST,
    path: '/embed',
    handler: ragController.createEmbedding
  },
];

const dr = new DeclarativeRouter({ defaultMiddlewares, defaultRoles, routes });
dr.applyToExpress(router);

export default router;
`;
  } else {
    // Hono
    routesContent = isTS ? `import { Hono } from 'hono';
import { DeclarativeRouter, METHODS } from '../helpers/route-builder.js';
import ragController from '../controllers/rag.controller.js';

const ragRoutes = new Hono();

/**
 * Default middlewares for RAG routes
 */
const defaultMiddlewares: string[] = [];
const defaultRoles: string[] = [];

/**
 * RAG route definitions
 */
const routes = [
  {
    method: METHODS.POST,
    path: '/search',
    handler: 'ragController.search'
  },
  {
    method: METHODS.POST,
    path: '/context',
    handler: 'ragController.getContext'
  },
  {
    method: METHODS.POST,
    path: '/documents',
    handler: 'ragController.storeDocument'
  },
  {
    method: METHODS.POST,
    path: '/embed',
    handler: 'ragController.createEmbedding'
  },
];

const dr = new DeclarativeRouter({ defaultMiddlewares, defaultRoles, routes });
dr.registerController('ragController', ragController);
dr.applyToHono(ragRoutes);

export default ragRoutes;
` : `import { Hono } from 'hono';
import { DeclarativeRouter, METHODS } from '../helpers/route-builder.js';
import ragController from '../controllers/rag.controller.js';

const ragRoutes = new Hono();

/**
 * Default middlewares for RAG routes
 */
const defaultMiddlewares = [];
const defaultRoles = [];

/**
 * RAG route definitions
 */
const routes = [
  {
    method: METHODS.POST,
    path: '/search',
    handler: 'ragController.search'
  },
  {
    method: METHODS.POST,
    path: '/context',
    handler: 'ragController.getContext'
  },
  {
    method: METHODS.POST,
    path: '/documents',
    handler: 'ragController.storeDocument'
  },
  {
    method: METHODS.POST,
    path: '/embed',
    handler: 'ragController.createEmbedding'
  },
];

const dr = new DeclarativeRouter({ defaultMiddlewares, defaultRoles, routes });
dr.registerController('ragController', ragController);
dr.applyToHono(ragRoutes);

export default ragRoutes;
`;
  }
  
  await fs.outputFile(path.join(projectPath, `src/routes/rag.routes.${ext}`), routesContent);
}

// ============================================================================
// RAG CONTROLLER GENERATION
// ============================================================================

export async function generateRAGController(projectPath: string, ext: string) {
  const isTS = ext === 'ts';
  await fs.ensureDir(path.join(projectPath, 'src/controllers'));
  
  const controllerContent = isTS ? `import { Request, Response } from 'express';
import ragService from '../services/rag.service.js';
import logger from '../utils/logger.js';

const ragController = {
  /**
   * Search for similar documents
   */
  async search(req: Request, res: Response) {
    try {
      const { query, matchCount, tableName, minSimilarity } = req.body;
      
      if (!query) {
        return res.status(400).json({ error: 'Query is required' });
      }
      
      const results = await ragService.vectorSearch(query, {
        matchCount,
        tableName,
        minSimilarity
      });
      
      return res.json({ success: true, data: results });
    } catch (error: any) {
      logger.error('RAG search error:', error);
      return res.status(500).json({ error: 'Search failed', message: error.message });
    }
  },

  /**
   * Get context for RAG-enhanced responses
   */
  async getContext(req: Request, res: Response) {
    try {
      const { query, matchCount, tableName, minSimilarity } = req.body;
      
      if (!query) {
        return res.status(400).json({ error: 'Query is required' });
      }
      
      const context = await ragService.getContext(query, {
        matchCount,
        tableName,
        minSimilarity
      });
      
      return res.json({ success: true, data: { context } });
    } catch (error: any) {
      logger.error('RAG context error:', error);
      return res.status(500).json({ error: 'Failed to get context', message: error.message });
    }
  },

  /**
   * Store a new document with embedding
   */
  async storeDocument(req: Request, res: Response) {
    try {
      const { content, metadata, tableName } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: 'Content is required' });
      }
      
      await ragService.storeDocument(tableName || 'documents', content, metadata);
      
      return res.json({ success: true, message: 'Document stored successfully' });
    } catch (error: any) {
      logger.error('RAG store error:', error);
      return res.status(500).json({ error: 'Failed to store document', message: error.message });
    }
  },

  /**
   * Create embedding for text
   */
  async createEmbedding(req: Request, res: Response) {
    try {
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }
      
      const embedding = await ragService.createEmbedding(text);
      
      return res.json({ success: true, data: { embedding, dimensions: embedding.length } });
    } catch (error: any) {
      logger.error('RAG embedding error:', error);
      return res.status(500).json({ error: 'Failed to create embedding', message: error.message });
    }
  }
};

export default ragController;
` : `import ragService from '../services/rag.service.js';
import logger from '../utils/logger.js';

const ragController = {
  /**
   * Search for similar documents
   */
  async search(req, res) {
    try {
      const { query, matchCount, tableName, minSimilarity } = req.body;
      
      if (!query) {
        return res.status(400).json({ error: 'Query is required' });
      }
      
      const results = await ragService.vectorSearch(query, {
        matchCount,
        tableName,
        minSimilarity
      });
      
      res.json({ success: true, data: results });
    } catch (error) {
      logger.error('RAG search error:', error);
      res.status(500).json({ error: 'Search failed', message: error.message });
    }
  },

  /**
   * Get context for RAG-enhanced responses
   */
  async getContext(req, res) {
    try {
      const { query, matchCount, tableName, minSimilarity } = req.body;
      
      if (!query) {
        return res.status(400).json({ error: 'Query is required' });
      }
      
      const context = await ragService.getContext(query, {
        matchCount,
        tableName,
        minSimilarity
      });
      
      res.json({ success: true, data: { context } });
    } catch (error) {
      logger.error('RAG context error:', error);
      res.status(500).json({ error: 'Failed to get context', message: error.message });
    }
  },

  /**
   * Store a new document with embedding
   */
  async storeDocument(req, res) {
    try {
      const { content, metadata, tableName } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: 'Content is required' });
      }
      
      await ragService.storeDocument(tableName || 'documents', content, metadata);
      
      res.json({ success: true, message: 'Document stored successfully' });
    } catch (error) {
      logger.error('RAG store error:', error);
      res.status(500).json({ error: 'Failed to store document', message: error.message });
    }
  },

  /**
   * Create embedding for text
   */
  async createEmbedding(req, res) {
    try {
      const { text } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: 'Text is required' });
      }
      
      const embedding = await ragService.createEmbedding(text);
      
      res.json({ success: true, data: { embedding, dimensions: embedding.length } });
    } catch (error) {
      logger.error('RAG embedding error:', error);
      res.status(500).json({ error: 'Failed to create embedding', message: error.message });
    }
  }
};

export default ragController;
`;
  
  await fs.outputFile(path.join(projectPath, `src/controllers/rag.controller.${ext}`), controllerContent);
}

// ============================================================================
// CHAT SERVICE GENERATION
// ============================================================================

export async function generateChatService(projectPath: string, config: ProjectConfig, ext: string) {
  const hasLangfuse = config.ai?.langfuse;
  const isTS = ext === 'ts';
  const llmProvider = config.ai?.llmProvider || 'openai';
  const chatDatabase = config.ai?.chatDatabase || 'supabase';

  const chatServiceContent = generateChatServiceContent(isTS, llmProvider, chatDatabase, hasLangfuse);
  
  // Also generate database helper if needed
  await generateChatDatabaseHelper(projectPath, chatDatabase, ext);

  await fs.ensureDir(path.join(projectPath, 'src/services'));
  await fs.outputFile(path.join(projectPath, `src/services/chat.service.${ext}`), chatServiceContent);
}

function generateChatServiceContent(isTS: boolean, llmProvider: LLMProvider, chatDatabase: ChatDatabase, hasLangfuse?: boolean): string {
  const typeAnnotations = {
    string: isTS ? ': string' : '',
    number: isTS ? ': number' : '',
    any: isTS ? ': any' : '',
    boolean: isTS ? ': boolean' : '',
  };
  
  // LLM imports
  let llmImport = '';
  let llmInit = '';
  
  if (llmProvider === 'openai') {
    llmImport = `import { ChatOpenAI } from '@langchain/openai';`;
    llmInit = `const llm = new ChatOpenAI({
        model,
        temperature,
        maxTokens,
        openAIApiKey: process.env.OPENAI_API_KEY,
        ${hasLangfuse ? 'callbacks: [langfuseHandler],' : ''}
      });`;
  } else if (llmProvider === 'anthropic') {
    llmImport = `import { ChatAnthropic } from '@langchain/anthropic';`;
    llmInit = `const llm = new ChatAnthropic({
        model: model || 'claude-3-sonnet-20240229',
        temperature,
        maxTokens,
        anthropicApiKey: process.env.ANTHROPIC_API_KEY,
        ${hasLangfuse ? 'callbacks: [langfuseHandler],' : ''}
      });`;
  } else if (llmProvider === 'gemini') {
    llmImport = `import { ChatGoogleGenerativeAI } from '@langchain/google-genai';`;
    llmInit = `const llm = new ChatGoogleGenerativeAI({
        model: model || 'gemini-pro',
        temperature,
        maxOutputTokens: maxTokens,
        apiKey: process.env.GOOGLE_API_KEY,
        ${hasLangfuse ? 'callbacks: [langfuseHandler],' : ''}
      });`;
  }
  
  // Database imports
  let dbImport = '';
  if (chatDatabase === 'supabase') {
    dbImport = `import { chatDb } from '../helpers/chat.db.js';`;
  } else if (chatDatabase === 'pg') {
    dbImport = `import { chatDb } from '../helpers/chat.db.js';`;
  } else if (chatDatabase === 'mysql') {
    dbImport = `import { chatDb } from '../helpers/chat.db.js';`;
  }
  
  const defaultModel = llmProvider === 'openai' ? 'gpt-4o-mini' 
    : llmProvider === 'anthropic' ? 'claude-3-sonnet-20240229' 
    : 'gemini-pro';

  const interfaces = isTS ? `
interface Message {
  id: string;
  conversation_id: string;
  message_type: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: any;
  created_at: string;
}

interface Conversation {
  id: string;
  user_id: string;
  title?: string;
  module?: string;
  metadata?: any;
  created_at: string;
}

` : '';

  const promiseTypes = isTS ? {
    conversation: ': Promise<Conversation>',
    message: ': Promise<Message>',
    messages: ': Promise<Message[]>',
    string: ': Promise<string>',
  } : { conversation: '', message: '', messages: '', string: '' };

  return `import logger from '../utils/logger.js';
${dbImport}
${llmImport}
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
${hasLangfuse ? `import { CallbackHandler } from 'langfuse-langchain';
const langfuseHandler = new CallbackHandler({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
});` : ''}
${interfaces}
const chatService = {
  /**
   * Create a new conversation
   */
  async createConversation(
    userId${typeAnnotations.string}, 
    module${typeAnnotations.string} = 'general', 
    modelName${typeAnnotations.string} = '${defaultModel}',
    title${isTS ? '?: string' : ''}
  )${promiseTypes.conversation} {
    try {
      const data = await chatDb.createConversation(userId, module, modelName, title);
      logger.info('Conversation created', { conversationId: data.id, userId, module });
      return data;
    } catch (error${typeAnnotations.any}) {
      logger.error('Error in createConversation:', error);
      throw error;
    }
  },

  /**
   * Add a message to conversation
   */
  async addMessage(
    conversationId${typeAnnotations.string}, 
    messageType${isTS ? ": 'user' | 'assistant' | 'system'" : ''}, 
    content${typeAnnotations.string}, 
    metadata${typeAnnotations.any} = {}
  )${promiseTypes.message} {
    try {
      const data = await chatDb.addMessage(conversationId, messageType, content, metadata);
      return data;
    } catch (error${typeAnnotations.any}) {
      logger.error('Error in addMessage:', error);
      throw error;
    }
  },

  /**
   * Get conversation history
   */
  async getConversationHistory(conversationId${typeAnnotations.string}, limit${typeAnnotations.number} = 50)${promiseTypes.messages} {
    try {
      const data = await chatDb.getConversationHistory(conversationId, limit);
      return data || [];
    } catch (error${typeAnnotations.any}) {
      logger.error('Error in getConversationHistory:', error);
      throw error;
    }
  },

  /**
   * Generate AI response
   */
  async generateResponse(
    messages${isTS ? ': { role: string; content: string }[]' : ''},
    options${isTS ? `: {
      model?: string;
      temperature?: number;
      maxTokens?: number;
      systemPrompt?: string;
    }` : ''} = {}
  )${promiseTypes.string} {
    const {
      model = '${defaultModel}',
      temperature = 0.7,
      maxTokens = 2000,
      systemPrompt = 'You are a helpful assistant.'
    } = options;

    try {
      ${llmInit}

      const formattedMessages${isTS ? ': [string, string][]' : ''} = [
        ['system', systemPrompt],
        ...messages.map(m => [m.role, m.content]${isTS ? ' as [string, string]' : ''})
      ];

      const prompt = ChatPromptTemplate.fromMessages(formattedMessages);
      const chain = prompt.pipe(llm).pipe(new StringOutputParser());
      
      const response = await chain.invoke({});
      return response;
    } catch (error${typeAnnotations.any}) {
      logger.error('Error generating AI response:', error);
      throw error;
    }
  },

  /**
   * Generate AI title for conversation
   */
  async generateAITitle(firstMessage${typeAnnotations.string})${promiseTypes.string} {
    try {
      const model = '${defaultModel}';
      ${llmInit.replace('temperature,', 'temperature: 0,').replace('maxTokens,', 'maxTokens: 50,')}

      const prompt = ChatPromptTemplate.fromMessages([
        ['system', 'Generate a short, concise title (max 6 words) for a conversation. Return only the title, no quotes.'],
        ['human', 'User message: {message}\\n\\nTitle:']
      ]);

      const chain = prompt.pipe(llm).pipe(new StringOutputParser());
      const aiTitle = await chain.invoke({ message: firstMessage.substring(0, 200) });

      return aiTitle.replace(/['\"]/g, '').trim().substring(0, 60);
    } catch (error${typeAnnotations.any}) {
      logger.error('Error generating AI title:', error);
      return firstMessage.length > 50 ? firstMessage.substring(0, 47) + '...' : firstMessage;
    }
  },

  /**
   * Update conversation title
   */
  async updateConversationTitle(conversationId${typeAnnotations.string}, title${typeAnnotations.string}, userId${isTS ? '?: string' : ''})${promiseTypes.conversation} {
    try {
      const data = await chatDb.updateConversationTitle(conversationId, title, userId);
      return data;
    } catch (error${typeAnnotations.any}) {
      logger.error('Error in updateConversationTitle:', error);
      throw error;
    }
  },

  /**
   * Delete conversation (soft delete)
   */
  async deleteConversation(conversationId${typeAnnotations.string}, userId${typeAnnotations.string})${promiseTypes.conversation} {
    try {
      const data = await chatDb.deleteConversation(conversationId, userId);
      return data;
    } catch (error${typeAnnotations.any}) {
      logger.error('Error in deleteConversation:', error);
      throw error;
    }
  },

  /**
   * Get user's conversations
   */
  async getUserConversations(userId${typeAnnotations.string}, limit${typeAnnotations.number} = 50)${isTS ? ': Promise<Conversation[]>' : ''} {
    try {
      const data = await chatDb.getUserConversations(userId, limit);
      return data || [];
    } catch (error${typeAnnotations.any}) {
      logger.error('Error in getUserConversations:', error);
      throw error;
    }
  }
};

export default chatService;
`;
}

async function generateChatDatabaseHelper(projectPath: string, chatDatabase: ChatDatabase, ext: string) {
  const isTS = ext === 'ts';
  await fs.ensureDir(path.join(projectPath, 'src/helpers'));
  
  let helperContent = '';
  
  if (chatDatabase === 'supabase') {
    helperContent = isTS ? `import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_API_KEY!);

export const chatDb = {
  async createConversation(userId: string, module: string, modelName: string, title?: string) {
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        title,
        module: module.trim().toLowerCase(),
        metadata: { model_name: modelName }
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async addMessage(conversationId: string, messageType: string, content: string, metadata: any = {}) {
    const { data, error } = await supabase
      .from('conversation_messages')
      .insert({
        conversation_id: conversationId,
        message_type: messageType,
        content,
        metadata
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getConversationHistory(conversationId: string, limit: number = 50) {
    const { data, error } = await supabase
      .from('conversation_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return data;
  },

  async updateConversationTitle(conversationId: string, title: string, userId?: string) {
    let query = supabase
      .from('conversations')
      .update({ title })
      .eq('id', conversationId);
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query.select().single();
    if (error) throw error;
    return data;
  },

  async deleteConversation(conversationId: string, userId: string) {
    const { data: existing, error: fetchError } = await supabase
      .from('conversations')
      .select('user_id, metadata')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();
    if (fetchError) throw fetchError;

    const { data, error } = await supabase
      .from('conversations')
      .update({ 
        user_id: null, 
        metadata: { ...existing.metadata, deleted_user_id: existing.user_id } 
      })
      .eq('id', conversationId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getUserConversations(userId: string, limit: number = 50) {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  }
};
` : `import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_API_KEY);

export const chatDb = {
  async createConversation(userId, module, modelName, title) {
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        title,
        module: module.trim().toLowerCase(),
        metadata: { model_name: modelName }
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async addMessage(conversationId, messageType, content, metadata = {}) {
    const { data, error } = await supabase
      .from('conversation_messages')
      .insert({
        conversation_id: conversationId,
        message_type: messageType,
        content,
        metadata
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getConversationHistory(conversationId, limit = 50) {
    const { data, error } = await supabase
      .from('conversation_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return data;
  },

  async updateConversationTitle(conversationId, title, userId) {
    let query = supabase
      .from('conversations')
      .update({ title })
      .eq('id', conversationId);
    if (userId) query = query.eq('user_id', userId);
    const { data, error } = await query.select().single();
    if (error) throw error;
    return data;
  },

  async deleteConversation(conversationId, userId) {
    const { data: existing, error: fetchError } = await supabase
      .from('conversations')
      .select('user_id, metadata')
      .eq('id', conversationId)
      .eq('user_id', userId)
      .single();
    if (fetchError) throw fetchError;

    const { data, error } = await supabase
      .from('conversations')
      .update({ 
        user_id: null, 
        metadata: { ...existing.metadata, deleted_user_id: existing.user_id } 
      })
      .eq('id', conversationId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async getUserConversations(userId, limit = 50) {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return data;
  }
};
`;
  } else if (chatDatabase === 'pg') {
    helperContent = isTS ? `import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

export const chatDb = {
  async createConversation(userId: string, module: string, modelName: string, title?: string) {
    const result = await pool.query(
      \`INSERT INTO conversations (user_id, title, module, metadata) 
       VALUES ($1, $2, $3, $4) RETURNING *\`,
      [userId, title, module.trim().toLowerCase(), JSON.stringify({ model_name: modelName })]
    );
    return result.rows[0];
  },

  async addMessage(conversationId: string, messageType: string, content: string, metadata: any = {}) {
    const result = await pool.query(
      \`INSERT INTO conversation_messages (conversation_id, message_type, content, metadata) 
       VALUES ($1, $2, $3, $4) RETURNING *\`,
      [conversationId, messageType, content, JSON.stringify(metadata)]
    );
    return result.rows[0];
  },

  async getConversationHistory(conversationId: string, limit: number = 50) {
    const result = await pool.query(
      \`SELECT * FROM conversation_messages 
       WHERE conversation_id = $1 
       ORDER BY created_at ASC LIMIT $2\`,
      [conversationId, limit]
    );
    return result.rows;
  },

  async updateConversationTitle(conversationId: string, title: string, userId?: string) {
    const query = userId 
      ? \`UPDATE conversations SET title = $1 WHERE id = $2 AND user_id = $3 RETURNING *\`
      : \`UPDATE conversations SET title = $1 WHERE id = $2 RETURNING *\`;
    const params = userId ? [title, conversationId, userId] : [title, conversationId];
    const result = await pool.query(query, params);
    return result.rows[0];
  },

  async deleteConversation(conversationId: string, userId: string) {
    const existing = await pool.query(
      'SELECT user_id, metadata FROM conversations WHERE id = $1 AND user_id = $2',
      [conversationId, userId]
    );
    if (!existing.rows[0]) throw new Error('Conversation not found');
    
    const metadata = { ...existing.rows[0].metadata, deleted_user_id: existing.rows[0].user_id };
    const result = await pool.query(
      \`UPDATE conversations SET user_id = NULL, metadata = $1 WHERE id = $2 RETURNING *\`,
      [JSON.stringify(metadata), conversationId]
    );
    return result.rows[0];
  },

  async getUserConversations(userId: string, limit: number = 50) {
    const result = await pool.query(
      \`SELECT * FROM conversations 
       WHERE user_id = $1 
       ORDER BY created_at DESC LIMIT $2\`,
      [userId, limit]
    );
    return result.rows;
  }
};
` : `import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL
});

export const chatDb = {
  async createConversation(userId, module, modelName, title) {
    const result = await pool.query(
      \`INSERT INTO conversations (user_id, title, module, metadata) 
       VALUES ($1, $2, $3, $4) RETURNING *\`,
      [userId, title, module.trim().toLowerCase(), JSON.stringify({ model_name: modelName })]
    );
    return result.rows[0];
  },

  async addMessage(conversationId, messageType, content, metadata = {}) {
    const result = await pool.query(
      \`INSERT INTO conversation_messages (conversation_id, message_type, content, metadata) 
       VALUES ($1, $2, $3, $4) RETURNING *\`,
      [conversationId, messageType, content, JSON.stringify(metadata)]
    );
    return result.rows[0];
  },

  async getConversationHistory(conversationId, limit = 50) {
    const result = await pool.query(
      \`SELECT * FROM conversation_messages 
       WHERE conversation_id = $1 
       ORDER BY created_at ASC LIMIT $2\`,
      [conversationId, limit]
    );
    return result.rows;
  },

  async updateConversationTitle(conversationId, title, userId) {
    const query = userId 
      ? \`UPDATE conversations SET title = $1 WHERE id = $2 AND user_id = $3 RETURNING *\`
      : \`UPDATE conversations SET title = $1 WHERE id = $2 RETURNING *\`;
    const params = userId ? [title, conversationId, userId] : [title, conversationId];
    const result = await pool.query(query, params);
    return result.rows[0];
  },

  async deleteConversation(conversationId, userId) {
    const existing = await pool.query(
      'SELECT user_id, metadata FROM conversations WHERE id = $1 AND user_id = $2',
      [conversationId, userId]
    );
    if (!existing.rows[0]) throw new Error('Conversation not found');
    
    const metadata = { ...existing.rows[0].metadata, deleted_user_id: existing.rows[0].user_id };
    const result = await pool.query(
      \`UPDATE conversations SET user_id = NULL, metadata = $1 WHERE id = $2 RETURNING *\`,
      [JSON.stringify(metadata), conversationId]
    );
    return result.rows[0];
  },

  async getUserConversations(userId, limit = 50) {
    const result = await pool.query(
      \`SELECT * FROM conversations 
       WHERE user_id = $1 
       ORDER BY created_at DESC LIMIT $2\`,
      [userId, limit]
    );
    return result.rows;
  }
};
`;
  } else if (chatDatabase === 'mysql') {
    helperContent = isTS ? `import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10
});

export const chatDb = {
  async createConversation(userId: string, module: string, modelName: string, title?: string) {
    const id = crypto.randomUUID();
    await pool.execute(
      \`INSERT INTO conversations (id, user_id, title, module, metadata) 
       VALUES (?, ?, ?, ?, ?)\`,
      [id, userId, title, module.trim().toLowerCase(), JSON.stringify({ model_name: modelName })]
    );
    const [rows] = await pool.execute('SELECT * FROM conversations WHERE id = ?', [id]);
    return (rows as any[])[0];
  },

  async addMessage(conversationId: string, messageType: string, content: string, metadata: any = {}) {
    const id = crypto.randomUUID();
    await pool.execute(
      \`INSERT INTO conversation_messages (id, conversation_id, message_type, content, metadata) 
       VALUES (?, ?, ?, ?, ?)\`,
      [id, conversationId, messageType, content, JSON.stringify(metadata)]
    );
    const [rows] = await pool.execute('SELECT * FROM conversation_messages WHERE id = ?', [id]);
    return (rows as any[])[0];
  },

  async getConversationHistory(conversationId: string, limit: number = 50) {
    const [rows] = await pool.execute(
      \`SELECT * FROM conversation_messages 
       WHERE conversation_id = ? 
       ORDER BY created_at ASC LIMIT ?\`,
      [conversationId, limit]
    );
    return rows;
  },

  async updateConversationTitle(conversationId: string, title: string, userId?: string) {
    if (userId) {
      await pool.execute(
        'UPDATE conversations SET title = ? WHERE id = ? AND user_id = ?',
        [title, conversationId, userId]
      );
    } else {
      await pool.execute(
        'UPDATE conversations SET title = ? WHERE id = ?',
        [title, conversationId]
      );
    }
    const [rows] = await pool.execute('SELECT * FROM conversations WHERE id = ?', [conversationId]);
    return (rows as any[])[0];
  },

  async deleteConversation(conversationId: string, userId: string) {
    const [existing] = await pool.execute(
      'SELECT user_id, metadata FROM conversations WHERE id = ? AND user_id = ?',
      [conversationId, userId]
    );
    const row = (existing as any[])[0];
    if (!row) throw new Error('Conversation not found');
    
    const metadata = { ...JSON.parse(row.metadata || '{}'), deleted_user_id: row.user_id };
    await pool.execute(
      'UPDATE conversations SET user_id = NULL, metadata = ? WHERE id = ?',
      [JSON.stringify(metadata), conversationId]
    );
    const [rows] = await pool.execute('SELECT * FROM conversations WHERE id = ?', [conversationId]);
    return (rows as any[])[0];
  },

  async getUserConversations(userId: string, limit: number = 50) {
    const [rows] = await pool.execute(
      \`SELECT * FROM conversations 
       WHERE user_id = ? 
       ORDER BY created_at DESC LIMIT ?\`,
      [userId, limit]
    );
    return rows;
  }
};
` : `import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10
});

export const chatDb = {
  async createConversation(userId, module, modelName, title) {
    const id = crypto.randomUUID();
    await pool.execute(
      \`INSERT INTO conversations (id, user_id, title, module, metadata) 
       VALUES (?, ?, ?, ?, ?)\`,
      [id, userId, title, module.trim().toLowerCase(), JSON.stringify({ model_name: modelName })]
    );
    const [rows] = await pool.execute('SELECT * FROM conversations WHERE id = ?', [id]);
    return rows[0];
  },

  async addMessage(conversationId, messageType, content, metadata = {}) {
    const id = crypto.randomUUID();
    await pool.execute(
      \`INSERT INTO conversation_messages (id, conversation_id, message_type, content, metadata) 
       VALUES (?, ?, ?, ?, ?)\`,
      [id, conversationId, messageType, content, JSON.stringify(metadata)]
    );
    const [rows] = await pool.execute('SELECT * FROM conversation_messages WHERE id = ?', [id]);
    return rows[0];
  },

  async getConversationHistory(conversationId, limit = 50) {
    const [rows] = await pool.execute(
      \`SELECT * FROM conversation_messages 
       WHERE conversation_id = ? 
       ORDER BY created_at ASC LIMIT ?\`,
      [conversationId, limit]
    );
    return rows;
  },

  async updateConversationTitle(conversationId, title, userId) {
    if (userId) {
      await pool.execute(
        'UPDATE conversations SET title = ? WHERE id = ? AND user_id = ?',
        [title, conversationId, userId]
      );
    } else {
      await pool.execute(
        'UPDATE conversations SET title = ? WHERE id = ?',
        [title, conversationId]
      );
    }
    const [rows] = await pool.execute('SELECT * FROM conversations WHERE id = ?', [conversationId]);
    return rows[0];
  },

  async deleteConversation(conversationId, userId) {
    const [existing] = await pool.execute(
      'SELECT user_id, metadata FROM conversations WHERE id = ? AND user_id = ?',
      [conversationId, userId]
    );
    const row = existing[0];
    if (!row) throw new Error('Conversation not found');
    
    const metadata = { ...JSON.parse(row.metadata || '{}'), deleted_user_id: row.user_id };
    await pool.execute(
      'UPDATE conversations SET user_id = NULL, metadata = ? WHERE id = ?',
      [JSON.stringify(metadata), conversationId]
    );
    const [rows] = await pool.execute('SELECT * FROM conversations WHERE id = ?', [conversationId]);
    return rows[0];
  },

  async getUserConversations(userId, limit = 50) {
    const [rows] = await pool.execute(
      \`SELECT * FROM conversations 
       WHERE user_id = ? 
       ORDER BY created_at DESC LIMIT ?\`,
      [userId, limit]
    );
    return rows;
  }
};
`;
  }
  
  await fs.outputFile(path.join(projectPath, `src/helpers/chat.db.${ext}`), helperContent);
}

// ============================================================================
// CHAT SCHEMA GENERATION
// ============================================================================

export async function generateChatSchema(projectPath: string, chatDatabase: ChatDatabase, ext: string) {
  await fs.ensureDir(path.join(projectPath, 'sql'));
  
  let schemaContent = '';
  
  if (chatDatabase === 'supabase' || chatDatabase === 'pg') {
    schemaContent = `-- Chat Schema for PostgreSQL/Supabase
-- Run this in your database

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  title VARCHAR(255),
  module VARCHAR(100) DEFAULT 'general',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create conversation_messages table
CREATE TABLE IF NOT EXISTS conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_type VARCHAR(20) NOT NULL CHECK (message_type IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON conversation_messages(created_at);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Optional: Enable RLS for Supabase (uncomment if using Supabase Auth)
-- ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE conversation_messages ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Users can view own conversations" ON conversations
--   FOR SELECT USING (auth.uid() = user_id);
-- CREATE POLICY "Users can create conversations" ON conversations
--   FOR INSERT WITH CHECK (auth.uid() = user_id);
-- CREATE POLICY "Users can update own conversations" ON conversations
--   FOR UPDATE USING (auth.uid() = user_id);

-- CREATE POLICY "Users can view messages in their conversations" ON conversation_messages
--   FOR SELECT USING (
--     EXISTS (SELECT 1 FROM conversations WHERE id = conversation_id AND user_id = auth.uid())
--   );
-- CREATE POLICY "Users can add messages to their conversations" ON conversation_messages
--   FOR INSERT WITH CHECK (
--     EXISTS (SELECT 1 FROM conversations WHERE id = conversation_id AND user_id = auth.uid())
--   );
`;
  } else if (chatDatabase === 'mysql') {
    schemaContent = `-- Chat Schema for MySQL
-- Run this in your MySQL database

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36),
  title VARCHAR(255),
  module VARCHAR(100) DEFAULT 'general',
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at DESC)
);

-- Create conversation_messages table
CREATE TABLE IF NOT EXISTS conversation_messages (
  id VARCHAR(36) PRIMARY KEY,
  conversation_id VARCHAR(36) NOT NULL,
  message_type ENUM('user', 'assistant', 'system') NOT NULL,
  content TEXT NOT NULL,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
  INDEX idx_conversation_id (conversation_id),
  INDEX idx_created_at (created_at)
);
`;
  }
  
  const filename = 'chat-schema.sql';
  await fs.outputFile(path.join(projectPath, `sql/${filename}`), schemaContent);

  // Update Drizzle schema if it exists and using postgres/supabase
  if (chatDatabase === 'supabase' || chatDatabase === 'pg') {
    const schemaPath = path.join(projectPath, `src/db/schema.${ext}`);
    if (await fs.pathExists(schemaPath)) {
      let currentSchema = await fs.readFile(schemaPath, 'utf-8');
      
      if (!currentSchema.includes('export const conversations')) {
        const drizzleContent = `
// Chat Tables
export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id'),
  title: text('title'),
  module: text('module').default('general'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const conversationMessages = pgTable('conversation_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id').references(() => conversations.id, { onDelete: 'cascade' }).notNull(),
  messageType: text('message_type').notNull(), // 'user', 'assistant', 'system'
  content: text('content').notNull(),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow(),
});
`;
        await fs.writeFile(schemaPath, currentSchema + drizzleContent);
        console.log('✓ Updated Drizzle schema with chat tables');
      }
    }
  }
}

// ============================================================================
// CHAT ROUTES GENERATION
// ============================================================================

export async function generateChatRoutes(projectPath: string, framework: string, ext: string) {
  const isTS = ext === 'ts';
  await fs.ensureDir(path.join(projectPath, 'src/routes'));
  
  let routesContent = '';
  
  if (framework === 'express') {
    routesContent = isTS ? `import { Router } from 'express';
import { DeclarativeRouter, METHODS } from '../helpers/route-builder.js';
import chatController from '../controllers/chat.controller.js';

const router = Router();

/**
 * Default middlewares for Chat routes
 * All routes are protected by default
 */
const defaultMiddlewares: string[] = [];
const defaultRoles: string[] = [];

/**
 * Chat route definitions
 */
const routes = [
  // Conversations
  {
    method: METHODS.GET,
    path: '/conversations',
    handler: chatController.getUserConversations
  },
  {
    method: METHODS.POST,
    path: '/conversations',
    handler: chatController.createConversation
  },
  {
    method: METHODS.GET,
    path: '/conversations/:id',
    handler: chatController.getConversation
  },
  {
    method: METHODS.PATCH,
    path: '/conversations/:id',
    handler: chatController.updateConversation
  },
  {
    method: METHODS.DELETE,
    path: '/conversations/:id',
    handler: chatController.deleteConversation
  },
  // Messages
  {
    method: METHODS.GET,
    path: '/conversations/:id/messages',
    handler: chatController.getMessages
  },
  {
    method: METHODS.POST,
    path: '/conversations/:id/messages',
    handler: chatController.sendMessage
  },
  // Generate response
  {
    method: METHODS.POST,
    path: '/generate',
    handler: chatController.generateResponse
  },
];

const dr = new DeclarativeRouter({ defaultMiddlewares, defaultRoles, routes });
dr.applyToExpress(router);

export default router;
` : `import { Router } from 'express';
import { DeclarativeRouter, METHODS } from '../helpers/route-builder.js';
import chatController from '../controllers/chat.controller.js';

const router = Router();

/**
 * Default middlewares for Chat routes
 */
const defaultMiddlewares = [];
const defaultRoles = [];

/**
 * Chat route definitions
 */
const routes = [
  // Conversations
  {
    method: METHODS.GET,
    path: '/conversations',
    handler: chatController.getUserConversations
  },
  {
    method: METHODS.POST,
    path: '/conversations',
    handler: chatController.createConversation
  },
  {
    method: METHODS.GET,
    path: '/conversations/:id',
    handler: chatController.getConversation
  },
  {
    method: METHODS.PATCH,
    path: '/conversations/:id',
    handler: chatController.updateConversation
  },
  {
    method: METHODS.DELETE,
    path: '/conversations/:id',
    handler: chatController.deleteConversation
  },
  // Messages
  {
    method: METHODS.GET,
    path: '/conversations/:id/messages',
    handler: chatController.getMessages
  },
  {
    method: METHODS.POST,
    path: '/conversations/:id/messages',
    handler: chatController.sendMessage
  },
  // Generate response
  {
    method: METHODS.POST,
    path: '/generate',
    handler: chatController.generateResponse
  },
];

const dr = new DeclarativeRouter({ defaultMiddlewares, defaultRoles, routes });
dr.applyToExpress(router);

export default router;
`;
  } else {
    // Hono
    routesContent = isTS ? `import { Hono } from 'hono';
import { DeclarativeRouter, METHODS } from '../helpers/route-builder.js';
import chatController from '../controllers/chat.controller.js';

const chatRoutes = new Hono();

/**
 * Default middlewares for Chat routes
 */
const defaultMiddlewares: string[] = [];
const defaultRoles: string[] = [];

/**
 * Chat route definitions
 */
const routes = [
  // Conversations
  {
    method: METHODS.GET,
    path: '/conversations',
    handler: 'chatController.getUserConversations'
  },
  {
    method: METHODS.POST,
    path: '/conversations',
    handler: 'chatController.createConversation'
  },
  {
    method: METHODS.GET,
    path: '/conversations/:id',
    handler: 'chatController.getConversation'
  },
  {
    method: METHODS.PATCH,
    path: '/conversations/:id',
    handler: 'chatController.updateConversation'
  },
  {
    method: METHODS.DELETE,
    path: '/conversations/:id',
    handler: 'chatController.deleteConversation'
  },
  // Messages
  {
    method: METHODS.GET,
    path: '/conversations/:id/messages',
    handler: 'chatController.getMessages'
  },
  {
    method: METHODS.POST,
    path: '/conversations/:id/messages',
    handler: 'chatController.sendMessage'
  },
  // Generate response
  {
    method: METHODS.POST,
    path: '/generate',
    handler: 'chatController.generateResponse'
  },
];

const dr = new DeclarativeRouter({ defaultMiddlewares, defaultRoles, routes });
dr.registerController('chatController', chatController);
dr.applyToHono(chatRoutes);

export default chatRoutes;
` : `import { Hono } from 'hono';
import { DeclarativeRouter, METHODS } from '../helpers/route-builder.js';
import chatController from '../controllers/chat.controller.js';

const chatRoutes = new Hono();

/**
 * Default middlewares for Chat routes
 */
const defaultMiddlewares = [];
const defaultRoles = [];

/**
 * Chat route definitions
 */
const routes = [
  // Conversations
  {
    method: METHODS.GET,
    path: '/conversations',
    handler: 'chatController.getUserConversations'
  },
  {
    method: METHODS.POST,
    path: '/conversations',
    handler: 'chatController.createConversation'
  },
  {
    method: METHODS.GET,
    path: '/conversations/:id',
    handler: 'chatController.getConversation'
  },
  {
    method: METHODS.PATCH,
    path: '/conversations/:id',
    handler: 'chatController.updateConversation'
  },
  {
    method: METHODS.DELETE,
    path: '/conversations/:id',
    handler: 'chatController.deleteConversation'
  },
  // Messages
  {
    method: METHODS.GET,
    path: '/conversations/:id/messages',
    handler: 'chatController.getMessages'
  },
  {
    method: METHODS.POST,
    path: '/conversations/:id/messages',
    handler: 'chatController.sendMessage'
  },
  // Generate response
  {
    method: METHODS.POST,
    path: '/generate',
    handler: 'chatController.generateResponse'
  },
];

const dr = new DeclarativeRouter({ defaultMiddlewares, defaultRoles, routes });
dr.registerController('chatController', chatController);
dr.applyToHono(chatRoutes);

export default chatRoutes;
`;
  }
  
  await fs.outputFile(path.join(projectPath, `src/routes/chat.routes.${ext}`), routesContent);
}

// ============================================================================
// CHAT CONTROLLER GENERATION
// ============================================================================

export async function generateChatController(projectPath: string, llmProvider: LLMProvider, ext: string) {
  const isTS = ext === 'ts';
  await fs.ensureDir(path.join(projectPath, 'src/controllers'));
  
  const defaultModel = llmProvider === 'openai' ? 'gpt-4o-mini' 
    : llmProvider === 'anthropic' ? 'claude-3-sonnet-20240229' 
    : 'gemini-pro';
  
  const controllerContent = isTS ? `import { Request, Response } from 'express';
import chatService from '../services/chat.service.js';
import logger from '../utils/logger.js';

const chatController = {
  /**
   * Get user's conversations
   */
  async getUserConversations(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id || req.headers['x-user-id'] as string;
      if (!userId) {
        return res.status(401).json({ error: 'User ID required' });
      }
      
      const limit = parseInt(req.query.limit as string) || 50;
      const conversations = await chatService.getUserConversations(userId, limit);
      
      return res.json({ success: true, data: conversations });
    } catch (error: any) {
      logger.error('Get conversations error:', error);
      return res.status(500).json({ error: 'Failed to get conversations', message: error.message });
    }
  },

  /**
   * Create a new conversation
   */
  async createConversation(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id || req.headers['x-user-id'] as string;
      if (!userId) {
        return res.status(401).json({ error: 'User ID required' });
      }
      
      const { module, title, model } = req.body;
      const conversation = await chatService.createConversation(
        userId, 
        module || 'general', 
        model || '${defaultModel}',
        title
      );
      
      return res.status(201).json({ success: true, data: conversation });
    } catch (error: any) {
      logger.error('Create conversation error:', error);
      return res.status(500).json({ error: 'Failed to create conversation', message: error.message });
    }
  },

  /**
   * Get a specific conversation
   */
  async getConversation(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const messages = await chatService.getConversationHistory(id);
      
      return res.json({ success: true, data: { id, messages } });
    } catch (error: any) {
      logger.error('Get conversation error:', error);
      return res.status(500).json({ error: 'Failed to get conversation', message: error.message });
    }
  },

  /**
   * Update conversation (title)
   */
  async updateConversation(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id || req.headers['x-user-id'] as string;
      const { id } = req.params;
      const { title } = req.body;
      
      const conversation = await chatService.updateConversationTitle(id, title, userId);
      
      return res.json({ success: true, data: conversation });
    } catch (error: any) {
      logger.error('Update conversation error:', error);
      return res.status(500).json({ error: 'Failed to update conversation', message: error.message });
    }
  },

  /**
   * Delete conversation
   */
  async deleteConversation(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id || req.headers['x-user-id'] as string;
      if (!userId) {
        return res.status(401).json({ error: 'User ID required' });
      }
      
      const { id } = req.params;
      await chatService.deleteConversation(id, userId);
      
      return res.json({ success: true, message: 'Conversation deleted' });
    } catch (error: any) {
      logger.error('Delete conversation error:', error);
      return res.status(500).json({ error: 'Failed to delete conversation', message: error.message });
    }
  },

  /**
   * Get messages for a conversation
   */
  async getMessages(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const messages = await chatService.getConversationHistory(id, limit);
      
      return res.json({ success: true, data: messages });
    } catch (error: any) {
      logger.error('Get messages error:', error);
      return res.status(500).json({ error: 'Failed to get messages', message: error.message });
    }
  },

  /**
   * Send a message and get AI response
   */
  async sendMessage(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { content, model, temperature, systemPrompt } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: 'Message content is required' });
      }
      
      // Add user message
      await chatService.addMessage(id, 'user', content);
      
      // Get conversation history
      const history = await chatService.getConversationHistory(id);
      const messages = history.map(m => ({
        role: m.message_type === 'user' ? 'human' : m.message_type,
        content: m.content
      }));
      
      // Generate AI response
      const response = await chatService.generateResponse(messages, {
        model: model || '${defaultModel}',
        temperature,
        systemPrompt
      });
      
      // Add assistant message
      const assistantMessage = await chatService.addMessage(id, 'assistant', response);
      
      return res.json({ success: true, data: assistantMessage });
    } catch (error: any) {
      logger.error('Send message error:', error);
      return res.status(500).json({ error: 'Failed to send message', message: error.message });
    }
  },

  /**
   * Generate a one-off response (no conversation storage)
   */
  async generateResponse(req: Request, res: Response) {
    try {
      const { messages, model, temperature, maxTokens, systemPrompt } = req.body;
      
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messages array is required' });
      }
      
      const response = await chatService.generateResponse(messages, {
        model: model || '${defaultModel}',
        temperature,
        maxTokens,
        systemPrompt
      });
      
      return res.json({ success: true, data: { response } });
    } catch (error: any) {
      logger.error('Generate response error:', error);
      return res.status(500).json({ error: 'Failed to generate response', message: error.message });
    }
  }
};

export default chatController;
` : `import chatService from '../services/chat.service.js';
import logger from '../utils/logger.js';

const chatController = {
  /**
   * Get user's conversations
   */
  async getUserConversations(req, res) {
    try {
      const userId = req.user?.id || req.headers['x-user-id'];
      if (!userId) {
        return res.status(401).json({ error: 'User ID required' });
      }
      
      const limit = parseInt(req.query.limit) || 50;
      const conversations = await chatService.getUserConversations(userId, limit);
      
      res.json({ success: true, data: conversations });
    } catch (error) {
      logger.error('Get conversations error:', error);
      res.status(500).json({ error: 'Failed to get conversations', message: error.message });
    }
  },

  /**
   * Create a new conversation
   */
  async createConversation(req, res) {
    try {
      const userId = req.user?.id || req.headers['x-user-id'];
      if (!userId) {
        return res.status(401).json({ error: 'User ID required' });
      }
      
      const { module, title, model } = req.body;
      const conversation = await chatService.createConversation(
        userId, 
        module || 'general', 
        model || '${defaultModel}',
        title
      );
      
      res.status(201).json({ success: true, data: conversation });
    } catch (error) {
      logger.error('Create conversation error:', error);
      res.status(500).json({ error: 'Failed to create conversation', message: error.message });
    }
  },

  /**
   * Get a specific conversation
   */
  async getConversation(req, res) {
    try {
      const { id } = req.params;
      const messages = await chatService.getConversationHistory(id);
      
      res.json({ success: true, data: { id, messages } });
    } catch (error) {
      logger.error('Get conversation error:', error);
      res.status(500).json({ error: 'Failed to get conversation', message: error.message });
    }
  },

  /**
   * Update conversation (title)
   */
  async updateConversation(req, res) {
    try {
      const userId = req.user?.id || req.headers['x-user-id'];
      const { id } = req.params;
      const { title } = req.body;
      
      const conversation = await chatService.updateConversationTitle(id, title, userId);
      
      res.json({ success: true, data: conversation });
    } catch (error) {
      logger.error('Update conversation error:', error);
      res.status(500).json({ error: 'Failed to update conversation', message: error.message });
    }
  },

  /**
   * Delete conversation
   */
  async deleteConversation(req, res) {
    try {
      const userId = req.user?.id || req.headers['x-user-id'];
      if (!userId) {
        return res.status(401).json({ error: 'User ID required' });
      }
      
      const { id } = req.params;
      await chatService.deleteConversation(id, userId);
      
      res.json({ success: true, message: 'Conversation deleted' });
    } catch (error) {
      logger.error('Delete conversation error:', error);
      res.status(500).json({ error: 'Failed to delete conversation', message: error.message });
    }
  },

  /**
   * Get messages for a conversation
   */
  async getMessages(req, res) {
    try {
      const { id } = req.params;
      const limit = parseInt(req.query.limit) || 50;
      
      const messages = await chatService.getConversationHistory(id, limit);
      
      res.json({ success: true, data: messages });
    } catch (error) {
      logger.error('Get messages error:', error);
      res.status(500).json({ error: 'Failed to get messages', message: error.message });
    }
  },

  /**
   * Send a message and get AI response
   */
  async sendMessage(req, res) {
    try {
      const { id } = req.params;
      const { content, model, temperature, systemPrompt } = req.body;
      
      if (!content) {
        return res.status(400).json({ error: 'Message content is required' });
      }
      
      // Add user message
      await chatService.addMessage(id, 'user', content);
      
      // Get conversation history
      const history = await chatService.getConversationHistory(id);
      const messages = history.map(m => ({
        role: m.message_type === 'user' ? 'human' : m.message_type,
        content: m.content
      }));
      
      // Generate AI response
      const response = await chatService.generateResponse(messages, {
        model: model || '${defaultModel}',
        temperature,
        systemPrompt
      });
      
      // Add assistant message
      const assistantMessage = await chatService.addMessage(id, 'assistant', response);
      
      res.json({ success: true, data: assistantMessage });
    } catch (error) {
      logger.error('Send message error:', error);
      res.status(500).json({ error: 'Failed to send message', message: error.message });
    }
  },

  /**
   * Generate a one-off response (no conversation storage)
   */
  async generateResponse(req, res) {
    try {
      const { messages, model, temperature, maxTokens, systemPrompt } = req.body;
      
      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messages array is required' });
      }
      
      const response = await chatService.generateResponse(messages, {
        model: model || '${defaultModel}',
        temperature,
        maxTokens,
        systemPrompt
      });
      
      res.json({ success: true, data: { response } });
    } catch (error) {
      logger.error('Generate response error:', error);
      res.status(500).json({ error: 'Failed to generate response', message: error.message });
    }
  }
};

export default chatController;
`;
  
  await fs.outputFile(path.join(projectPath, `src/controllers/chat.controller.${ext}`), controllerContent);
}

// ============================================================================
// MODEL CONFIG (kept from original)
// ============================================================================

export async function generateModelConfig(projectPath: string, ext: string) {
  const isTS = ext === 'ts';
  
  const modelConfigContent = isTS
    ? `/**
 * Model Configuration Utility
 * Manages model selection based on request origin domains.
 */

import logger from './logger.js';

class ModelConfig {
  private config: Record<string, string>;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): Record<string, string> {
    try {
      const configJson = process.env.MODEL_DOMAIN_MAPPING;
      if (!configJson) {
        logger.warn('MODEL_DOMAIN_MAPPING not found. Using default configuration.');
        return this.getDefaultConfig();
      }

      const config = JSON.parse(configJson);
      logger.info('Model domain mapping loaded successfully');
      return config;
    } catch (error: any) {
      logger.error('Error loading model configuration:', error.message);
      return this.getDefaultConfig();
    }
  }

  private getDefaultConfig(): Record<string, string> {
    return {
      'o3': 'o3',
      'mini': 'gpt-4o-mini',
      'default': 'gpt-4o'
    };
  }

  extractDomain(req: any): string | null {
    try {
      if (req.headers.origin) {
        const url = new URL(req.headers.origin);
        return url.hostname;
      }
      if (req.headers.referer) {
        const url = new URL(req.headers.referer);
        return url.hostname;
      }
      if (req.headers.host) {
        return req.headers.host.split(':')[0];
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  getModelForRequest(req: any): string {
    const domain = this.extractDomain(req);
    
    if (!domain) {
      return this.config.default;
    }

    const domainLower = domain.toLowerCase();
    
    for (const [prefix, model] of Object.entries(this.config)) {
      if (prefix === 'default') continue;
      
      if (domainLower.startsWith(prefix.toLowerCase())) {
        logger.debug(\`Domain '\${domain}' matches prefix '\${prefix}', using model '\${model}'\`);
        return model;
      }
    }

    return this.config.default;
  }

  getConfig(): Record<string, string> {
    return { ...this.config };
  }
}

export default new ModelConfig();
`
    : `/**
 * Model Configuration Utility
 * Manages model selection based on request origin domains.
 */

import logger from './logger.js';

class ModelConfig {
  constructor() {
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      const configJson = process.env.MODEL_DOMAIN_MAPPING;
      if (!configJson) {
        logger.warn('MODEL_DOMAIN_MAPPING not found. Using default configuration.');
        return this.getDefaultConfig();
      }

      const config = JSON.parse(configJson);
      logger.info('Model domain mapping loaded successfully');
      return config;
    } catch (error) {
      logger.error('Error loading model configuration:', error.message);
      return this.getDefaultConfig();
    }
  }

  getDefaultConfig() {
    return {
      'o3': 'o3',
      'mini': 'gpt-4o-mini',
      'default': 'gpt-4o'
    };
  }

  extractDomain(req) {
    try {
      if (req.headers.origin) {
        const url = new URL(req.headers.origin);
        return url.hostname;
      }
      if (req.headers.referer) {
        const url = new URL(req.headers.referer);
        return url.hostname;
      }
      if (req.headers.host) {
        return req.headers.host.split(':')[0];
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  getModelForRequest(req) {
    const domain = this.extractDomain(req);
    
    if (!domain) {
      return this.config.default;
    }

    const domainLower = domain.toLowerCase();
    
    for (const [prefix, model] of Object.entries(this.config)) {
      if (prefix === 'default') continue;
      
      if (domainLower.startsWith(prefix.toLowerCase())) {
        logger.debug(\`Domain '\${domain}' matches prefix '\${prefix}', using model '\${model}'\`);
        return model;
      }
    }

    return this.config.default;
  }

  getConfig() {
    return { ...this.config };
  }
}

export default new ModelConfig();
`;

  await fs.outputFile(path.join(projectPath, `src/utils/modelConfig.${ext}`), modelConfigContent);
}

export async function generateSourceConfig(projectPath: string, ext: string) {
  const isTS = ext === 'ts';
  
  const sourceConfigContent = isTS
    ? `/**
 * Source Configuration Utility
 * Manages source determination based on request origin domains.
 */

import logger from './logger.js';

class SourceConfig {
  extractDomain(req: any): string | null {
    try {
      if (req.headers.origin) {
        const url = new URL(req.headers.origin);
        return url.hostname;
      }
      if (req.headers.referer) {
        const url = new URL(req.headers.referer);
        return url.hostname;
      }
      if (req.headers.host) {
        return req.headers.host.split(':')[0];
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  getSourceForRequest(req: any): string {
    const domain = this.extractDomain(req);
    
    if (!domain) {
      logger.debug('No domain found in request, using default source');
      return 'default';
    }

    const domainLower = domain.toLowerCase();
    const domainParts = domainLower.split('-');
    const firstPart = domainParts[0];
    
    if (firstPart && firstPart !== 'localhost') {
      logger.debug(\`Domain '\${domain}' split to '\${firstPart}'\`);
      return firstPart;
    }

    return 'default';
  }
}

export default new SourceConfig();
`
    : `/**
 * Source Configuration Utility
 * Manages source determination based on request origin domains.
 */

import logger from './logger.js';

class SourceConfig {
  extractDomain(req) {
    try {
      if (req.headers.origin) {
        const url = new URL(req.headers.origin);
        return url.hostname;
      }
      if (req.headers.referer) {
        const url = new URL(req.headers.referer);
        return url.hostname;
      }
      if (req.headers.host) {
        return req.headers.host.split(':')[0];
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  getSourceForRequest(req) {
    const domain = this.extractDomain(req);
    
    if (!domain) {
      logger.debug('No domain found in request, using default source');
      return 'default';
    }

    const domainLower = domain.toLowerCase();
    const domainParts = domainLower.split('-');
    const firstPart = domainParts[0];
    
    if (firstPart && firstPart !== 'localhost') {
      logger.debug(\`Domain '\${domain}' split to '\${firstPart}'\`);
      return firstPart;
    }

    return 'default';
  }
}

export default new SourceConfig();
`;

  await fs.outputFile(path.join(projectPath, `src/utils/sourceConfig.${ext}`), sourceConfigContent);
}

export async function generateSelectionMiddleware(projectPath: string, ext: string, includeModel: boolean = true, includeSource: boolean = true) {
  const isTS = ext === 'ts';
  
  if (includeModel) {
    const modelSelectionContent = isTS
      ? `/**
 * Model Selection Middleware
 * Automatically selects the appropriate model based on request origin domain.
 */

import modelConfig from '../utils/modelConfig.js';
import logger from '../utils/logger.js';

export const modelSelection = (req: any, _res: any, next: any) => {
  try {
    const selectedModel = modelConfig.getModelForRequest(req);
    req.selectedModel = selectedModel;
    
    logger.debug(\`Request from \${modelConfig.extractDomain(req) || 'unknown'} assigned model: \${selectedModel}\`);
    
    next();
  } catch (error) {
    logger.error('Error in model selection middleware:', error);
    req.selectedModel = 'gpt-4o';
    next();
  }
};

export const getModelForRequest = (req: any): string => {
  return modelConfig.getModelForRequest(req);
};

export default modelSelection;
`
      : `/**
 * Model Selection Middleware
 * Automatically selects the appropriate model based on request origin domain.
 */

import modelConfig from '../utils/modelConfig.js';
import logger from '../utils/logger.js';

export const modelSelection = (req, res, next) => {
  try {
    const selectedModel = modelConfig.getModelForRequest(req);
    req.selectedModel = selectedModel;
    
    logger.debug(\`Request from \${modelConfig.extractDomain(req) || 'unknown'} assigned model: \${selectedModel}\`);
    
    next();
  } catch (error) {
    logger.error('Error in model selection middleware:', error);
    req.selectedModel = 'gpt-4o';
    next();
  }
};

export const getModelForRequest = (req) => {
  return modelConfig.getModelForRequest(req);
};

export default modelSelection;
`;

    await fs.outputFile(path.join(projectPath, `src/middleware/modelSelection.middleware.${ext}`), modelSelectionContent);
  }

  if (includeSource) {
    await generateSourceSelectionMiddleware(projectPath, ext);
  }
}

export async function generateSourceSelectionMiddleware(projectPath: string, ext: string) {
  const isTS = ext === 'ts';
  
  const sourceSelectionContent = isTS
    ? `/**
 * Source Selection Middleware
 * Automatically determines the request source based on the request origin domain.
 */

import sourceConfig from '../utils/sourceConfig.js';
import logger from '../utils/logger.js';

export const sourceSelection = (req: any, _res: any, next: any) => {
  try {
    const requestSource = sourceConfig.getSourceForRequest(req);
    const domain = sourceConfig.extractDomain(req);
    
    req.requestSource = requestSource;
    req.requestDomain = domain;
    
    logger.debug(\`Request from \${domain || 'unknown'} assigned source: \${requestSource}\`);
    
    next();
  } catch (error) {
    logger.error('Error in source selection middleware:', error);
    req.requestSource = 'default';
    next();
  }
};

export const getSourceForRequest = (req: any): string => {
  return sourceConfig.getSourceForRequest(req);
};

export default sourceSelection;
`
    : `/**
 * Source Selection Middleware
 * Automatically determines the request source based on the request origin domain.
 */

import sourceConfig from '../utils/sourceConfig.js';
import logger from '../utils/logger.js';

export const sourceSelection = (req, res, next) => {
  try {
    const requestSource = sourceConfig.getSourceForRequest(req);
    const domain = sourceConfig.extractDomain(req);
    
    req.requestSource = requestSource;
    req.requestDomain = domain;
    
    logger.debug(\`Request from \${domain || 'unknown'} assigned source: \${requestSource}\`);
    
    next();
  } catch (error) {
    logger.error('Error in source selection middleware:', error);
    req.requestSource = 'default';
    next();
  }
};

export const getSourceForRequest = (req) => {
  return sourceConfig.getSourceForRequest(req);
};

export default sourceSelection;
`;

  await fs.outputFile(path.join(projectPath, `src/middleware/sourceSelection.middleware.${ext}`), sourceSelectionContent);
}
