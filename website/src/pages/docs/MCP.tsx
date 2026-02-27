import { CodeBlock } from "@/components/CodeBlock";

export function MCP() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="scroll-m-20 text-4xl font-bold tracking-tight">
          MCP Server
        </h1>
        <p className="text-lg text-muted-foreground mt-2">
          Run nod-cli as a local MCP server with stdio transport.
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight">
          Installation
        </h2>

        <p>
          Install globally if you want the <code>nod</code> command available
          everywhere:
        </p>

        <CodeBlock code="npm install -g nod-cli" language="bash" />

        <p>Or run directly with npx (no global install required):</p>

        <CodeBlock code="npx -y nod-cli mcp" language="bash" />

        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-8">
          Usage
        </h2>

        <CodeBlock
          code={`# Start built-in MCP server over stdio
nod mcp

# Optional: customize the MCP server name
nod mcp --name nod-cli`}
          language="bash"
        />

        <p>
          This command starts a long-running stdio server process. Keep it
          running while your MCP host is connected.
        </p>

        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-8">
          Host Configuration
        </h2>

        <p>
          nod-cli MCP is host-agnostic. Use one of these officially documented
          host formats.
        </p>

        <h3 className="scroll-m-20 text-xl font-semibold tracking-tight mt-4">
          OpenAI Codex
        </h3>

        <p>Add via Codex CLI:</p>

        <CodeBlock
          code={`codex mcp add nod-cli -- npx -y nod-cli mcp`}
          language="bash"
        />

        <p>
          Or configure directly in <code>~/.codex/config.toml</code> (or project
          <code>.codex/config.toml</code>):
        </p>

        <CodeBlock
          code={`[mcp_servers.nod_cli]
command = "npx"
args = ["-y", "nod-cli", "mcp"]`}
          language="toml"
        />

        <h3 className="scroll-m-20 text-xl font-semibold tracking-tight mt-4">
          Anthropic Claude Code
        </h3>

        <p>Add a local stdio server:</p>

        <CodeBlock
          code={`claude mcp add --transport stdio nod-cli -- npx -y nod-cli mcp`}
          language="bash"
        />

        <p>
          For shared project config, Claude Code uses <code>.mcp.json</code>:
        </p>

        <CodeBlock
          code={`{
  "mcpServers": {
    "nod-cli": {
      "command": "npx",
      "args": ["-y", "nod-cli", "mcp"],
      "env": {}
    }
  }
}`}
          language="json"
        />

        <h3 className="scroll-m-20 text-xl font-semibold tracking-tight mt-4">
          OpenCode
        </h3>

        <p>
          Configure in global <code>~/.config/opencode/opencode.json</code> or
          project <code>opencode.json</code>:
        </p>

        <CodeBlock
          code={`{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "nod-cli": {
      "type": "local",
      "command": ["npx", "-y", "nod-cli", "mcp"],
      "enabled": true
    }
  }
}`}
          language="json"
        />

        <h3 className="scroll-m-20 text-xl font-semibold tracking-tight mt-4">
          Generic JSON host format
        </h3>

        <p>
          Many MCP hosts accept a JSON object with <code>command</code> and
          <code>args</code>:
        </p>

        <CodeBlock
          code={`{
  "mcpServers": {
    "nod-cli": {
      "command": "nod",
      "args": ["mcp"]
    }
  }
}`}
          language="json"
        />

        <p>If you do not install globally, use npx as the command:</p>

        <CodeBlock
          code={`{
  "mcpServers": {
    "nod-cli": {
      "command": "npx",
      "args": ["-y", "nod-cli", "mcp"]
    }
  }
}`}
          language="json"
        />

        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-8">
          Official References
        </h2>

        <ul className="list-disc pl-6 space-y-1 text-sm">
          <li>
            Codex MCP:{" "}
            <a
              className="underline"
              href="https://developers.openai.com/codex/mcp"
              target="_blank"
              rel="noreferrer"
            >
              developers.openai.com/codex/mcp
            </a>
          </li>
          <li>
            Claude Code MCP:{" "}
            <a
              className="underline"
              href="https://code.claude.com/docs/en/mcp"
              target="_blank"
              rel="noreferrer"
            >
              code.claude.com/docs/en/mcp
            </a>
          </li>
          <li>
            OpenCode MCP servers:{" "}
            <a
              className="underline"
              href="https://opencode.ai/docs/mcp-servers/"
              target="_blank"
              rel="noreferrer"
            >
              opencode.ai/docs/mcp-servers
            </a>
          </li>
        </ul>

        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-8">
          Available Tools
        </h2>

        <ul className="list-disc pl-6 space-y-1 text-sm">
          <li>
            <code>nod_help</code>: returns quick nod command examples.
          </li>
          <li>
            <code>nod_run</code>: runs local nod commands with inputs:
            <code>command</code> (<code>init</code>, <code>add</code>,{" "}
            <code>transform</code>, <code>validate</code>, <code>preset</code>),
            optional <code>args</code> (JSON string array), <code>cwd</code>,
            and <code>timeoutMs</code>.
          </li>
        </ul>

        <p>
          Example <code>nod_run</code> payload values:
        </p>

        <CodeBlock
          code={`command: "add"
args: "[\"route\",\"--name\",\"users\",\"--method\",\"get\",\"--path\",\"/users\",\"--yes\"]"
cwd: "./my-api"
timeoutMs: 120000`}
          language="plaintext"
        />

        <h2 className="scroll-m-20 border-b pb-2 text-2xl font-semibold tracking-tight mt-8">
          Troubleshooting
        </h2>

        <ul className="list-disc pl-6 space-y-1 text-sm">
          <li>
            If a host cannot find <code>nod</code>, switch to{" "}
            <code>npx -y nod-cli mcp</code> in the MCP command.
          </li>
          <li>
            For Claude Code on native Windows, wrap npx with <code>cmd /c</code>{" "}
            when adding stdio servers.
          </li>
          <li>
            Keep stdout clean in MCP servers; nod-cli MCP logs startup to stderr
            only.
          </li>
          <li>
            If startup times out, increase host-specific MCP startup timeout in
            that host&apos;s config.
          </li>
        </ul>
      </div>
    </div>
  );
}
