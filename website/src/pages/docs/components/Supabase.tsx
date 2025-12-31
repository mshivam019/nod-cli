import { CodeBlock } from '@/components/CodeBlock'

export function SupabaseComponent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="scroll-m-20 text-4xl font-bold tracking-tight">Supabase</h1>
        <p className="text-lg text-muted-foreground mt-2">
          Full Supabase client with storage helpers and optional JWT authentication.
        </p>
      </div>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Installation
        </h2>
        <CodeBlock code={`nod add supabase`} language="bash" />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Options
        </h2>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground">
          <li><strong>Include JWT Auth Middleware</strong> - JWKS-based JWT verification using jose library</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Generated Files
        </h2>
        
        <h3 className="font-semibold mt-4">Supabase Helper (src/helpers/supabase.helper.ts)</h3>
        <CodeBlock
          code={`import { createClient } from '@supabase/supabase-js';
import config from '../config/config.js';
import logger from '../utils/logger.js';

const sbApiKey = config.supabaseApiKey;
const sbUrl = config.supabaseUrl;

export const supabase = createClient(sbUrl!, sbApiKey!);
export const supabaseAuthAdmin = supabase.auth.admin;

export const downloadFromSupabase = async (bucketName: string, filePath: string) => {
  const { data, error } = await supabase.storage
    .from(bucketName)
    .download(filePath);
  
  if (error) throw error;
  return data;
};

export const uploadToSupabase = async (
  bucketName: string, 
  filePath: string, 
  fileBuffer: Buffer | Blob, 
  options: any = {}
) => {
  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, fileBuffer, { upsert: true, ...options });
  
  if (error) throw error;
  return data;
};

export const getSignedUrl = async (bucketName: string, filePath: string, expiresIn = 86400) => {
  const { data, error } = await supabase.storage
    .from(bucketName)
    .createSignedUrl(filePath, expiresIn);
  
  if (error) return null;
  return data.signedUrl;
};

export default supabase;`}
          language="typescript"
        />

        <h3 className="font-semibold mt-6">JWT Auth Middleware (src/middleware/jwtAuth.middleware.ts)</h3>
        <CodeBlock
          code={`import { jwtVerify, createRemoteJWKSet } from 'jose';
import config from '../config/config.js';

const SUPABASE_JWT_ISSUER = \`https://\${config.supabaseProject}.supabase.co/auth/v1\`;
const JWKS = createRemoteJWKSet(new URL(\`\${SUPABASE_JWT_ISSUER}/.well-known/jwks.json\`));

export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
  role?: string;
  app_metadata?: any;
  user_metadata?: any;
}

const jwtAuth = async (req: any, res: any, next: any) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: SUPABASE_JWT_ISSUER,
      algorithms: ['RS256', 'ES256'],
    });

    req.user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
      app_metadata: payload.app_metadata,
      user_metadata: payload.user_metadata,
    } as AuthUser;

    next();
  } catch (error: any) {
    if (error.code === 'ERR_JWT_EXPIRED') {
      return res.status(401).json({ message: 'Token expired' });
    }
    return res.status(401).json({ message: 'Invalid token' });
  }
};

export default jwtAuth;`}
          language="typescript"
        />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Environment Variables
        </h2>
        <CodeBlock
          code={`SUPABASE_URL=https://your-project.supabase.co
SUPABASE_API_KEY=your-anon-key
SUPABASE_PROJECT=your-project-id`}
          language="bash"
        />
      </section>

      <section className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Usage
        </h2>
        <CodeBlock
          code={`import supabase, { uploadToSupabase, getSignedUrl } from './helpers/supabase.helper.js';
import { METHODS } from '../config/router.js';

// Declarative route with JWT auth (from defaultMiddlewares)
const routes = [
  {
    method: METHODS.GET,
    path: '/profile',
    handler: profileController.getProfile
    // jwtAuth is applied from defaultMiddlewares
  },
];

// Upload file
const data = await uploadToSupabase('avatars', 'user-123/avatar.png', fileBuffer);

// Get signed URL
const url = await getSignedUrl('avatars', 'user-123/avatar.png', 3600);`}
          language="typescript"
        />
      </section>
    </div>
  )
}
