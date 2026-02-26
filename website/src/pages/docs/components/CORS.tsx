import { CodeBlock } from '@/components/CodeBlock'

export function CORSComponent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="scroll-m-20 text-4xl font-bold tracking-tight">CORS</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Add CORS middleware quickly with sensible defaults and apply it globally.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Installation
        </h2>
        <CodeBlock code={`nod add cors`} language="bash" />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          What it does
        </h2>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground">
          <li>Creates <code>src/middleware/cors.ts</code> (or <code>.js</code>).</li>
          <li>Adds CORS middleware import and applies it as default in <code>src/app</code>.</li>
          <li>Works for both Express and Hono projects.</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Generated Middleware
        </h2>
        <CodeBlock
          tsCode={`import { Request, Response, NextFunction } from 'express';

export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }

  next();
}`}
          jsCode={`export function corsMiddleware(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }

  next();
}`}
        />
      </section>
    </div>
  )
}
