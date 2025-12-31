import { useState, useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Menu, X, Moon, Sun, Github, Terminal, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CodeBlock } from './CodeBlock'

type Theme = 'light' | 'dark' | 'system'

export function DocsLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme') as Theme | null
      return stored || 'system'
    }
    return 'system'
  })
  const location = useLocation()

  // Apply theme on mount and when theme changes
  useEffect(() => {
    const root = document.documentElement

    const applyTheme = (newTheme: Theme) => {
      if (newTheme === 'system') {
        const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        root.classList.toggle('dark', systemDark)
      } else {
        root.classList.toggle('dark', newTheme === 'dark')
      }
    }

    applyTheme(theme)
    localStorage.setItem('theme', theme)

    // Listen for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme('system')
      }
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [theme])

  // Close sidebar when route changes
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  const cycleTheme = () => {
    const themes: Theme[] = ['light', 'dark', 'system']
    const currentIndex = themes.indexOf(theme)
    const nextIndex = (currentIndex + 1) % themes.length
    setTheme(themes[nextIndex])
  }

  const getThemeIcon = () => {
    if (theme === 'system') return <Monitor className="h-5 w-5" />
    if (theme === 'dark') return <Moon className="h-5 w-5" />
    return <Sun className="h-5 w-5" />
  }

  const isActive = (href: string) => {
    if (href === '/docs') {
      return location.pathname === '/docs'
    }
    return location.pathname === href
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center px-4 md:px-6 max-w-screen-2xl mx-auto">
          {/* Mobile menu button */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="inline-flex md:hidden items-center justify-center rounded-md text-sm font-medium h-9 w-9 hover:bg-accent hover:text-accent-foreground mr-2"
            aria-label="Toggle menu"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <Terminal className="h-6 w-6" />
            <span className="font-bold text-lg">nod-cli</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium ml-6">
            <Link
              to="/docs"
              className={cn(
                "transition-colors hover:text-foreground",
                location.pathname.startsWith('/docs') ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              Docs
            </Link>
            <Link
              to="/docs/components"
              className={cn(
                "transition-colors hover:text-foreground",
                location.pathname.startsWith('/docs/components') ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              Components
            </Link>
          </nav>

          {/* Right side actions */}
          <div className="flex items-center space-x-1 ml-auto">
            <a
              href="https://github.com/mshivam019/nod-cli"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 w-9 hover:bg-accent hover:text-accent-foreground"
              aria-label="GitHub"
            >
              <Github className="h-5 w-5" />
            </a>
            <button
              onClick={cycleTheme}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 w-9 hover:bg-accent hover:text-accent-foreground"
              aria-label={`Current theme: ${theme}. Click to change.`}
              title={`Theme: ${theme}`}
            >
              {getThemeIcon()}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex max-w-screen-2xl mx-auto">
        {/* Sidebar */}
        <aside
          className={cn(
            'fixed top-14 z-40 h-[calc(100vh-3.5rem)] w-64 shrink-0 overflow-y-auto border-r border-border bg-background transition-transform duration-200 ease-in-out md:sticky md:translate-x-0',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <div className="p-4 lg:p-6 space-y-6">
            {/* Getting Started */}
            <div className="space-y-1">
              <h4 className="px-2 text-sm font-semibold text-foreground">Getting Started</h4>
              <nav className="flex flex-col space-y-0.5">
                <Link
                  to="/docs"
                  className={cn(
                    'block rounded-md px-2 py-1.5 text-sm transition-colors',
                    isActive('/docs')
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                >
                  Introduction
                </Link>
                <Link
                  to="/docs/installation"
                  className={cn(
                    'block rounded-md px-2 py-1.5 text-sm transition-colors',
                    isActive('/docs/installation')
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                >
                  Installation
                </Link>
                <Link
                  to="/docs/cli"
                  className={cn(
                    'block rounded-md px-2 py-1.5 text-sm transition-colors',
                    isActive('/docs/cli')
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                >
                  CLI
                </Link>
                <Link
                  to="/docs/presets"
                  className={cn(
                    'block rounded-md px-2 py-1.5 text-sm transition-colors',
                    isActive('/docs/presets')
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                >
                  Presets
                </Link>
                <Link
                  to="/docs/faq"
                  className={cn(
                    'block rounded-md px-2 py-1.5 text-sm transition-colors',
                    isActive('/docs/faq')
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                >
                  FAQ
                </Link>
              </nav>
            </div>

            {/* Components */}
            <div className="space-y-1">
              <h4 className="px-2 text-sm font-semibold text-foreground">Components</h4>
              <nav className="flex flex-col space-y-0.5">
                <Link
                  to="/docs/components/route"
                  className={cn(
                    'block rounded-md px-2 py-1.5 text-sm transition-colors',
                    isActive('/docs/components/route')
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                >
                  Route
                </Link>
                <Link
                  to="/docs/components/middleware"
                  className={cn(
                    'block rounded-md px-2 py-1.5 text-sm transition-colors',
                    isActive('/docs/components/middleware')
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                >
                  Middleware
                </Link>
                <Link
                  to="/docs/components/service"
                  className={cn(
                    'block rounded-md px-2 py-1.5 text-sm transition-colors',
                    isActive('/docs/components/service')
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                >
                  Service
                </Link>
                <Link
                  to="/docs/components/supabase"
                  className={cn(
                    'block rounded-md px-2 py-1.5 text-sm transition-colors',
                    isActive('/docs/components/supabase')
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                >
                  Supabase
                </Link>
                <Link
                  to="/docs/components/drizzle"
                  className={cn(
                    'block rounded-md px-2 py-1.5 text-sm transition-colors',
                    isActive('/docs/components/drizzle')
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                >
                  Drizzle
                </Link>
                <Link
                  to="/docs/components/rag"
                  className={cn(
                    'block rounded-md px-2 py-1.5 text-sm transition-colors',
                    isActive('/docs/components/rag')
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                >
                  RAG
                </Link>
                <Link
                  to="/docs/components/chat"
                  className={cn(
                    'block rounded-md px-2 py-1.5 text-sm transition-colors',
                    isActive('/docs/components/chat')
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                >
                  Chat
                </Link>
                <Link
                  to="/docs/components/langfuse"
                  className={cn(
                    'block rounded-md px-2 py-1.5 text-sm transition-colors',
                    isActive('/docs/components/langfuse')
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                >
                  Langfuse
                </Link>
                <Link
                  to="/docs/components/pm2"
                  className={cn(
                    'block rounded-md px-2 py-1.5 text-sm transition-colors',
                    isActive('/docs/components/pm2')
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                >
                  PM2
                </Link>
                <Link
                  to="/docs/components/vercel-cron"
                  className={cn(
                    'block rounded-md px-2 py-1.5 text-sm transition-colors',
                    isActive('/docs/components/vercel-cron')
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                >
                  Vercel Cron
                </Link>
                <Link
                  to="/docs/components/github-actions"
                  className={cn(
                    'block rounded-md px-2 py-1.5 text-sm transition-colors',
                    isActive('/docs/components/github-actions')
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                >
                  GitHub Actions
                </Link>
                <Link
                  to="/docs/components/cron"
                  className={cn(
                    'block rounded-md px-2 py-1.5 text-sm transition-colors',
                    isActive('/docs/components/cron')
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                >
                  Cron
                </Link>
              </nav>
            </div>

            {/* Commands */}
            <div className="space-y-1">
              <h4 className="px-2 text-sm font-semibold text-foreground">Commands</h4>
              <nav className="flex flex-col space-y-0.5">
                <Link
                  to="/docs/add"
                  className={cn(
                    'block rounded-md px-2 py-1.5 text-sm transition-colors',
                    isActive('/docs/add')
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                >
                  Add Command
                </Link>
                <Link
                  to="/docs/transform"
                  className={cn(
                    'block rounded-md px-2 py-1.5 text-sm transition-colors',
                    isActive('/docs/transform')
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                >
                  Transform
                </Link>
                <Link
                  to="/docs/generators"
                  className={cn(
                    'block rounded-md px-2 py-1.5 text-sm transition-colors',
                    isActive('/docs/generators')
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                >
                  Generators
                </Link>
                <Link
                  to="/docs/configuration"
                  className={cn(
                    'block rounded-md px-2 py-1.5 text-sm transition-colors',
                    isActive('/docs/configuration')
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                >
                  Configuration
                </Link>
              </nav>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0 px-4 py-6 md:px-6 lg:px-8 lg:py-8">
          <div className="max-w-3xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}

export { CodeBlock }
