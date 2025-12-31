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
        <Route path="components" element={<Components />} />
      </Route>
    </Routes>
  )
}
