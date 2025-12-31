import { useState } from 'react'
import { Highlight, themes } from 'prism-react-renderer'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CodeBlockProps {
  /** Single code block (no toggle) */
  code?: string
  language?: string
  filename?: string
  showLineNumbers?: boolean
  /** For JS/TS toggle - provide both versions */
  tsCode?: string
  jsCode?: string
}

export function CodeBlock({
  code,
  language = 'bash',
  filename,
  showLineNumbers = false,
  tsCode,
  jsCode,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'ts' | 'js'>('ts')

  // Determine if we should show the toggle
  const showToggle = tsCode && jsCode
  const displayCode = showToggle ? (activeTab === 'ts' ? tsCode : jsCode) : (code || '')
  const displayLanguage = showToggle ? (activeTab === 'ts' ? 'typescript' : 'javascript') : language

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(displayCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group rounded-lg border border-border bg-muted">
      {/* Header with filename and/or toggle */}
      {(filename || showToggle) && (
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <span className="text-sm text-muted-foreground font-mono">
            {filename || ''}
          </span>
          {showToggle && (
            <div className="flex items-center gap-1 bg-background/50 rounded-md p-0.5">
              <button
                onClick={() => setActiveTab('ts')}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded transition-colors',
                  activeTab === 'ts'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                TypeScript
              </button>
              <button
                onClick={() => setActiveTab('js')}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded transition-colors',
                  activeTab === 'js'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                JavaScript
              </button>
            </div>
          )}
        </div>
      )}
      <div className="relative">
        <button
          onClick={copyToClipboard}
          className={cn(
            'absolute right-3 top-3 z-10 h-8 w-8 rounded-md flex items-center justify-center',
            'bg-background/80 hover:bg-background border border-border',
            'opacity-0 group-hover:opacity-100 transition-opacity'
          )}
          aria-label="Copy code"
        >
          {copied ? (
            <Check className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
        <Highlight theme={themes.nightOwl} code={displayCode.trim()} language={displayLanguage}>
          {({ className, style, tokens, getLineProps, getTokenProps }) => (
            <pre
              className={cn(className, 'p-4 overflow-x-auto text-sm')}
              style={{ ...style, background: 'transparent' }}
            >
              {tokens.map((line, i) => (
                <div key={i} {...getLineProps({ line })}>
                  {showLineNumbers && (
                    <span className="inline-block w-8 text-muted-foreground select-none">
                      {i + 1}
                    </span>
                  )}
                  {line.map((token, key) => (
                    <span key={key} {...getTokenProps({ token })} />
                  ))}
                </div>
              ))}
            </pre>
          )}
        </Highlight>
      </div>
    </div>
  )
}
