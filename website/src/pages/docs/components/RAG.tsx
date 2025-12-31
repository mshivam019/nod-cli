import { CodeBlock } from '@/components/CodeBlock'

export function RAGComponent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="scroll-m-20 text-4xl font-bold tracking-tight">RAG</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Vector similarity search with multiple embedding providers and vector stores.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Installation
        </h2>
        <CodeBlock code={`nod add rag`} language="bash" />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Options
        </h2>
        <div className="grid gap-4 md:grid-cols-2 mt-4">
          <div className="rounded-lg border p-4">
            <h4 className="font-medium">Embedding Providers</h4>
            <ul className="text-sm text-muted-foreground mt-2 space-y-1">
              <li>• OpenAI (text-embedding-3-small)</li>
              <li>• Google Gemini (embedding-001)</li>
              <li>• Cohere (embed-english-v3.0)</li>
            </ul>
          </div>
          <div className="rounded-lg border p-4">
            <h4 className="font-medium">Vector Stores</h4>
            <ul className="text-sm text-muted-foreground mt-2 space-y-1">
              <li>• Supabase (pgvector)</li>
              <li>• Pinecone</li>
              <li>• Chroma (local/self-hosted)</li>
              <li>• Weaviate</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Generated Files
        </h2>
        
        <h3 className="font-semibold mt-4">Retriever (src/utils/retriever.ts)</h3>
        <CodeBlock
          code={`import { OpenAIEmbeddings } from '@langchain/openai';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

export const embeddings = new OpenAIEmbeddings({ 
  openAIApiKey: process.env.OPENAI_API_KEY,
  model: 'text-embedding-3-small'
});

const sbApiKey = process.env.SUPABASE_API_KEY;
const sbUrl = process.env.SUPABASE_URL;
export const client = createClient(sbUrl!, sbApiKey!);`}
          language="typescript"
        />

        <h3 className="font-semibold mt-6">RAG Service (src/services/rag.service.ts)</h3>
        <CodeBlock
          code={`import { embeddings, client } from '../utils/retriever.js';
import logger from '../utils/logger.js';

export const ragService = {
  async search(
    query: string,
    options: {
      matchFunction?: string;
      matchCount?: number;
      minSimilarity?: number;
    } = {}
  ) {
    const {
      matchFunction = 'match_documents',
      matchCount = 5,
      minSimilarity = 0.7
    } = options;

    // Generate embedding for query
    const queryEmbedding = await embeddings.embedQuery(query);

    // Search vector store
    const { data, error } = await client.rpc(matchFunction, {
      query_embedding: queryEmbedding,
      match_count: matchCount,
    });

    if (error) {
      logger.error('Vector search failed:', error.message);
      throw error;
    }

    return (data || [])
      .filter((d: any) => d.similarity >= minSimilarity)
      .map((d: any) => ({
        content: d.content,
        metadata: d.metadata,
        similarity: d.similarity
      }));
  },

  async storeDocument(
    content: string,
    metadata: Record<string, any> = {},
    tableName = 'documents'
  ) {
    const embedding = await embeddings.embedQuery(content);

    const { error } = await client
      .from(tableName)
      .insert({ content, embedding, metadata });

    if (error) {
      logger.error('Error storing document:', error.message);
      throw error;
    }
  }
};`}
          language="typescript"
        />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Schema Setup
        </h2>
        
        <div className="bg-muted/50 p-4 rounded-lg border mb-4">
          <p className="text-sm font-medium">💡 Using Drizzle ORM?</p>
          <p className="text-sm text-muted-foreground mt-1">
            If you have Drizzle installed (via preset or <code>nod add drizzle</code>), 
            the schema below is automatically added to your <code>src/db/schema.ts</code>.
            Just run <code>npx drizzle-kit push</code> to apply changes.
          </p>
        </div>

        <p className="mb-2">For non-Drizzle projects, run this SQL in your database:</p>

        <CodeBlock
          code={`-- Enable pgvector extension
create extension if not exists vector;

-- Create documents table
create table documents (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  embedding vector(1536),
  metadata jsonb default '{}',
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Create index for faster similarity search
create index documents_embedding_idx on documents 
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

-- Create similarity search function
create or replace function match_documents(
  query_embedding vector(1536),
  match_count int default 5
)
returns table (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    d.id,
    d.content,
    d.metadata,
    1 - (d.embedding <=> query_embedding) as similarity
  from documents d
  order by d.embedding <=> query_embedding
  limit match_count;
end;
$$;`}
          language="sql"
        />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Environment Variables
        </h2>
        <CodeBlock
          code={`# OpenAI
OPENAI_API_KEY=sk-...

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_API_KEY=your-anon-key`}
          language="bash"
        />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Usage
        </h2>
        <CodeBlock
          code={`import { ragService } from './services/rag.service.js';

// Search for similar documents
const results = await ragService.search('How do I reset my password?', {
  matchCount: 5,
  minSimilarity: 0.75
});

// Store a new document
await ragService.storeDocument(
  'To reset your password, click on the forgot password link...',
  { category: 'faq', source: 'help-center' }
);`}
          language="typescript"
        />
      </section>
    </div>
  )
}
