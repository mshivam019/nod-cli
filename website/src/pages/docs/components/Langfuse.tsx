import { CodeBlock } from '@/components/CodeBlock'

export function LangfuseComponent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="scroll-m-20 text-4xl font-bold tracking-tight">Langfuse</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Optional LLM observability with explicit generation logging and OpenTelemetry tracing.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Installation
        </h2>
        <CodeBlock code={`nod add langfuse\npnpm install`} language="bash" />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          What it Generates
        </h2>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground">
          <li><code className="bg-muted px-1 rounded">@langfuse/core</code> ingestion logging via <code>langfuseService.logGeneration</code></li>
          <li><code className="bg-muted px-1 rounded">@langfuse/otel</code> OpenTelemetry initialization</li>
          <li>Environment-aware production and staging Langfuse keys</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Environment Variables
        </h2>
        <CodeBlock
          code={`LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_BASE_URL=https://cloud.langfuse.com

LANGFUSE_STAGING_PUBLIC_KEY=pk-lf-...
LANGFUSE_STAGING_SECRET_KEY=sk-lf-...
LANGFUSE_STAGING_BASE_URL=https://cloud.langfuse.com`}
          language="bash"
        />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Usage
        </h2>
        <CodeBlock
          tsCode={`import { langfuseService } from '../services/langfuse.service.js';

const startedAt = new Date().toISOString();
const input = 'Hello!';

const output = await generateText(input);

await langfuseService.logGeneration({
  name: 'chat.response',
  model: 'your-model-name',
  startedAt,
  endedAt: new Date().toISOString(),
  input,
  output,
  userId: 'user-123',
  sessionId: 'session-456',
});`}
          jsCode={`import { langfuseService } from '../services/langfuse.service.js';

const startedAt = new Date().toISOString();
const input = 'Hello!';

const output = await generateText(input);

await langfuseService.logGeneration({
  name: 'chat.response',
  model: 'your-model-name',
  startedAt,
  endedAt: new Date().toISOString(),
  input,
  output,
  userId: 'user-123',
  sessionId: 'session-456',
});`}
        />
      </section>
    </div>
  )
}
