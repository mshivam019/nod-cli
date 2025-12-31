import { CodeBlock } from '@/components/CodeBlock'

export function LangfuseComponent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="scroll-m-20 text-4xl font-bold tracking-tight">Langfuse</h1>
        <p className="text-lg text-muted-foreground mt-2">
          LLM observability and tracing for monitoring your AI features.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Installation
        </h2>
        <CodeBlock code={`nod add langfuse`} language="bash" />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          What it Does
        </h2>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground">
          <li>Adds <code className="bg-muted px-1 rounded">langfuse-langchain</code> dependency</li>
          <li>Enables tracing of all LangChain calls</li>
          <li>Tracks token usage, latency, and costs</li>
          <li>Provides debugging and analytics dashboard</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Environment Variables
        </h2>
        <CodeBlock
          code={`LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_HOST=https://cloud.langfuse.com  # or self-hosted URL`}
          language="bash"
        />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Usage with LangChain
        </h2>
        <CodeBlock
          code={`import { ChatOpenAI } from '@langchain/openai';
import { CallbackHandler } from 'langfuse-langchain';

// Create Langfuse callback handler
const langfuseHandler = new CallbackHandler({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_HOST,
});

// Use with LangChain
const llm = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  callbacks: [langfuseHandler],
});

// All calls are now traced
const response = await llm.invoke([
  { role: 'user', content: 'Hello!' }
]);

// Add custom metadata to traces
const handlerWithMetadata = new CallbackHandler({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  userId: 'user-123',
  sessionId: 'session-456',
  metadata: { feature: 'chat', version: '1.0' },
});`}
          language="typescript"
        />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Manual Tracing
        </h2>
        <CodeBlock
          code={`import { Langfuse } from 'langfuse';

const langfuse = new Langfuse({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
});

// Create a trace
const trace = langfuse.trace({
  name: 'rag-query',
  userId: 'user-123',
  metadata: { query: 'What is RAG?' },
});

// Add spans for sub-operations
const span = trace.span({
  name: 'embedding-generation',
  input: { text: 'What is RAG?' },
});

// ... do embedding work ...

span.end({ output: { dimensions: 1536 } });

// Add generation for LLM calls
const generation = trace.generation({
  name: 'llm-response',
  model: 'gpt-4o-mini',
  input: messages,
  output: response,
  usage: { promptTokens: 100, completionTokens: 50 },
});

// Flush at the end
await langfuse.flushAsync();`}
          language="typescript"
        />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Features
        </h2>
        <div className="grid gap-4 md:grid-cols-2 mt-4">
          <div className="rounded-lg border p-4">
            <h4 className="font-medium">Tracing</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Full visibility into LLM calls, latency, and token usage
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h4 className="font-medium">Analytics</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Track costs, usage patterns, and performance metrics
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h4 className="font-medium">Debugging</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Inspect prompts, responses, and intermediate steps
            </p>
          </div>
          <div className="rounded-lg border p-4">
            <h4 className="font-medium">Evaluation</h4>
            <p className="text-sm text-muted-foreground mt-1">
              Score and evaluate LLM outputs for quality
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
