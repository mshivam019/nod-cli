import { Routes, Route, Navigate } from 'react-router-dom'
import { DocsLayout } from './components/DocsLayout'
import { Introduction } from './pages/docs/Introduction'
import { Installation } from './pages/docs/Installation'
import { CLI } from './pages/docs/CLI'
import { Presets } from './pages/docs/Presets'
import { AddCommand } from './pages/docs/AddCommand'
import { TransformCommand } from './pages/docs/TransformCommand'
import { Generators } from './pages/docs/Generators'
import { Configuration } from './pages/docs/Configuration'
import { Components } from './pages/docs/Components'
// Component pages
import { RouteComponent } from './pages/docs/components/Route'
import { MiddlewareComponent } from './pages/docs/components/Middleware'
import { ServiceComponent } from './pages/docs/components/Service'
import { SupabaseComponent } from './pages/docs/components/Supabase'
import { DrizzleComponent } from './pages/docs/components/Drizzle'
import { RAGComponent } from './pages/docs/components/RAG'
import { ChatComponent } from './pages/docs/components/Chat'
import { LangfuseComponent } from './pages/docs/components/Langfuse'
import { PM2Component } from './pages/docs/components/PM2'
import { VercelCronComponent } from './pages/docs/components/VercelCron'
import { GitHubActionsComponent } from './pages/docs/components/GitHubActions'
import { CronComponent } from './pages/docs/components/Cron'
import { FAQ } from './pages/docs/FAQ'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/docs" replace />} />
      <Route path="/docs" element={<DocsLayout />}>
        <Route index element={<Introduction />} />
        <Route path="installation" element={<Installation />} />
        <Route path="cli" element={<CLI />} />
        <Route path="presets" element={<Presets />} />
        <Route path="add" element={<AddCommand />} />
        <Route path="transform" element={<TransformCommand />} />
        <Route path="generators" element={<Generators />} />
        <Route path="configuration" element={<Configuration />} />
        <Route path="faq" element={<FAQ />} />
        <Route path="components" element={<Components />} />
        {/* Component pages */}
        <Route path="components/route" element={<RouteComponent />} />
        <Route path="components/middleware" element={<MiddlewareComponent />} />
        <Route path="components/service" element={<ServiceComponent />} />
        <Route path="components/supabase" element={<SupabaseComponent />} />
        <Route path="components/drizzle" element={<DrizzleComponent />} />
        <Route path="components/rag" element={<RAGComponent />} />
        <Route path="components/chat" element={<ChatComponent />} />
        <Route path="components/langfuse" element={<LangfuseComponent />} />
        <Route path="components/pm2" element={<PM2Component />} />
        <Route path="components/vercel-cron" element={<VercelCronComponent />} />
        <Route path="components/github-actions" element={<GitHubActionsComponent />} />
        <Route path="components/cron" element={<CronComponent />} />
      </Route>
    </Routes>
  )
}
