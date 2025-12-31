import { CodeBlock } from '@/components/CodeBlock'

export function Generators() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="scroll-m-20 text-4xl font-bold tracking-tight">Generators</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Available code generators and what they produce.
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Project Generator
        </h2>

        <p>The main project generator creates a complete project structure:</p>

        <CodeBlock
          code={`my-api/
├── src/
│   ├── routes/          # Route definitions
│   ├── controllers/     # Request handlers
│   ├── services/        # Business logic
│   ├── middleware/      # Custom middleware
│   ├── config/          # App configuration (Zod validation)
│   ├── helpers/         # Utilities (supabase, response formatter)
│   ├── utils/           # Logger, retriever
│   ├── db/              # Drizzle schema + connection
│   ├── environments/    # Staging/production configs
│   ├── cron/            # Scheduled jobs
│   └── types/           # TypeScript types
├── docs/                # Project documentation
├── temp/                # Git-ignored temp files
├── sql/                 # SQL schema files
├── .github/workflows/   # GitHub Actions
├── vercel.json          # Vercel cron config
├── drizzle.config.ts    # Drizzle ORM config
├── ecosystem.config.js  # PM2 config
└── Dockerfile           # Docker config`}
          language="plaintext"
        />

        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-8">
          Route Generator
        </h2>

        <p>Creates routes with controllers and services:</p>

        <CodeBlock
          code={`// src/routes/users.ts
import { Router } from 'express';
import { UsersController } from '../controllers/usersController';

const router = Router();
const controller = new UsersController();

router.get('/', controller.getAll);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);

export default router;`}
          language="typescript"
        />

        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-8">
          AI Generators
        </h2>

        <h3 className="scroll-m-20 text-xl font-semibold tracking-tight mt-4">RAG Service</h3>

        <p>Generates a complete RAG (Retrieval-Augmented Generation) service:</p>

        <CodeBlock
          code={`// src/services/ragService.ts
import { OpenAIEmbeddings } from '@langchain/openai';
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';

export class RAGService {
  private embeddings: OpenAIEmbeddings;
  private vectorStore: SupabaseVectorStore;

  async search(query: string, k: number = 5) {
    return await this.vectorStore.similaritySearch(query, k);
  }

  async addDocuments(documents: Document[]) {
    await this.vectorStore.addDocuments(documents);
  }
}`}
          language="typescript"
        />

        <h3 className="scroll-m-20 text-xl font-semibold tracking-tight mt-4">Chat Service</h3>

        <p>Generates a conversation management service:</p>

        <CodeBlock
          code={`// src/services/chatService.ts
import { ChatOpenAI } from '@langchain/openai';
import { BufferMemory } from 'langchain/memory';

export class ChatService {
  private model: ChatOpenAI;
  private memory: BufferMemory;

  async chat(message: string, conversationId: string) {
    // Load conversation history
    // Generate response
    // Save to history
  }
}`}
          language="typescript"
        />

        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-8">
          Middleware Generator
        </h2>

        <p>Generates various middleware types:</p>

        <div className="grid gap-4 md:grid-cols-2 mt-4">
          <div className="rounded-lg border p-4">
            <h4 className="font-semibold">Logger</h4>
            <p className="text-sm text-muted-foreground">Request logging with Winston</p>
          </div>
          <div className="rounded-lg border p-4">
            <h4 className="font-semibold">Rate Limiter</h4>
            <p className="text-sm text-muted-foreground">Request rate limiting</p>
          </div>
          <div className="rounded-lg border p-4">
            <h4 className="font-semibold">CORS</h4>
            <p className="text-sm text-muted-foreground">Cross-origin resource sharing</p>
          </div>
          <div className="rounded-lg border p-4">
            <h4 className="font-semibold">Custom</h4>
            <p className="text-sm text-muted-foreground">Custom middleware template</p>
          </div>
        </div>

        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-8">
          Database Generators
        </h2>

        <h3 className="scroll-m-20 text-xl font-semibold tracking-tight mt-4">Supabase</h3>

        <p>Generates Supabase client with helpers:</p>

        <CodeBlock
          code={`// src/helpers/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export const getStorageUrl = (bucket: string, path: string) => {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;
};`}
          language="typescript"
        />

        <h3 className="scroll-m-20 text-xl font-semibold tracking-tight mt-4">Drizzle ORM</h3>

        <p>Generates Drizzle configuration and schema:</p>

        <CodeBlock
          code={`// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});`}
          language="typescript"
        />
      </div>
    </div>
  )
}
