import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod/v3";

type RunResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
};

export async function mcpCommand(options: { name?: string }) {
  const server = new McpServer({
    name: options?.name || "nod-cli",
    version: "0.1.0",
  });

  server.tool("nod_help", "Get core nod-cli command examples", async () => {
    return {
      content: [
        {
          type: "text",
          text: [
            "nod init my-api --preset api --yes",
            "nod add route --name users --method get --path /users --yes",
            "nod transform --features drizzle,github --yes",
            "nod validate",
            "nod preset list",
          ].join("\n"),
        },
      ],
    };
  });

  server.tool(
    "nod_run",
    "Run a nod-cli command locally and return output",
    {
      command: z
        .string()
        .describe("Top-level nod command: init|add|transform|validate|preset"),
      args: z
        .string()
        .optional()
        .describe('JSON string array of args, e.g. ["--name","users","--yes"]'),
      cwd: z
        .string()
        .optional()
        .describe("Working directory to run command from"),
      timeoutMs: z
        .number()
        .int()
        .optional()
        .describe("Timeout in milliseconds"),
    },
    async ({ command, args, cwd, timeoutMs }) => {
      const allowedCommands = new Set([
        "init",
        "add",
        "transform",
        "validate",
        "preset",
      ]);
      if (!allowedCommands.has(command)) {
        return {
          content: [
            {
              type: "text",
              text: `Invalid command '${command}'. Allowed: ${Array.from(allowedCommands).join(", ")}`,
            },
          ],
        };
      }

      const parsedArgs = parseArgsJson(args);
      if (parsedArgs.error) {
        return {
          content: [{ type: "text", text: parsedArgs.error }],
        };
      }

      const baseCwd = cwd ? path.resolve(process.cwd(), cwd) : process.cwd();
      const cliEntry = getCliEntryPath();
      const finalArgs = [cliEntry, command, ...parsedArgs.args];

      const result = await runNodeCommand(
        finalArgs,
        baseCwd,
        timeoutMs || 120000,
      );

      const output = [
        `exitCode: ${result.exitCode}`,
        "stdout:",
        result.stdout || "",
        "stderr:",
        result.stderr || "",
      ].join("\n");

      return {
        content: [{ type: "text", text: output.trim() }],
      };
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("nod MCP server running on stdio");
}

function parseArgsJson(rawArgs?: string): { args: string[]; error?: string } {
  if (!rawArgs) {
    return { args: [] };
  }

  try {
    const parsed = JSON.parse(rawArgs);
    if (
      !Array.isArray(parsed) ||
      parsed.some((item) => typeof item !== "string")
    ) {
      return { args: [], error: "args must be a JSON array of strings" };
    }
    return { args: parsed };
  } catch {
    return {
      args: [],
      error:
        'args must be valid JSON (array of strings), e.g. ["--name","users"]',
    };
  }
}

function getCliEntryPath(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  return path.resolve(currentDir, "../cli.js");
}

function runNodeCommand(
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, timeoutMs);

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        stderr = `${stderr}\nCommand timed out after ${timeoutMs}ms`.trim();
      }

      resolve({
        exitCode: code ?? (timedOut ? 124 : 1),
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      });
    });

    child.on("error", (error: Error) => {
      clearTimeout(timer);
      resolve({
        exitCode: 1,
        stdout: stdout.trim(),
        stderr: `${stderr}\n${error.message}`.trim(),
      });
    });
  });
}
