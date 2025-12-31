import { useState, useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Menu, X, Moon, Sun, Github, Terminal, Monitor } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CodeBlock } from './CodeBlock'

const navigation = [
  { name: 'Introduction', href: '/docs' },
  { name: 'Installation', href: '/docs/installation' },
  { name: 'CLI', href: '/docs/cli' },
  { name: 'Presets', href: '/docs/presets' },
  { name: 'Components', href: '/docs/components' },
  { name: 'Add Command', href: '/docs/add' },
  { name: 'Transform', href: '/docs/transform' },
  { name: 'Generators', href: '/docs/generators' },
  { name: 'Configuration', href: '/docs/configuration' },
]

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center px-4 md:px-6 max-w-screen-2xl mx-auto">
          {/* Mobile menu button - moved to left */}
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
              to="/docs/generators"
              className={cn(
                "transition-colors hover:text-foreground",
                location.pathname === '/docs/generators' ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              Generators
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
          <div className="p-4 lg:p-6">
            <div className="flex flex-col space-y-1">
              <h4 className="mb-2 px-2 text-sm font-semibold text-foreground">Getting Started</h4>
              {navigation.slice(0, 5).map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    'block rounded-md px-3 py-2 text-sm transition-colors',
                    location.pathname === item.href
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                >
                  {item.name}
                </Link>
              ))}
            </div>
            <div className="flex flex-col space-y-1 mt-6">
              <h4 className="mb-2 px-2 text-sm font-semibold text-foreground">Commands</h4>
              {navigation.slice(5).map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={cn(
                    'block rounded-md px-3 py-2 text-sm transition-colors',
                    location.pathname === item.href
                      ? 'bg-accent font-medium text-accent-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                  )}
                >
                  {item.name}
                </Link>
              ))}
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
