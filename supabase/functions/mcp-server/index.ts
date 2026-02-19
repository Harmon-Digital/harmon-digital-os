import { Hono } from "hono";
import { cors } from "hono/cors";
import { authenticate, AuthError } from "./lib/auth.ts";
import { getAllTools, type ToolDef } from "./tools/registry.ts";
import { getAllResources, type ResourceDef } from "./resources/index.ts";
import { getAllPrompts, type PromptDef } from "./prompts/index.ts";
import openApiSpec from "./openapi/spec.json" with { type: "json" };

const SERVER_INFO = {
  name: "harmon-digital-os",
  version: "1.0.0",
};

const PROTOCOL_VERSION = "2024-11-05";

// Pre-register all tools, resources, prompts
const allTools: ToolDef[] = getAllTools();
const allResources: ResourceDef[] = getAllResources();
const allPrompts: PromptDef[] = getAllPrompts();

const toolMap = new Map(allTools.map((t) => [t.name, t]));

// --- MCP JSON-RPC handler ---

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

function jsonRpcError(id: string | number | null, code: number, message: string, data?: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message, data } };
}

function jsonRpcResult(id: string | number | null, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

async function handleMcpRequest(req: Request): Promise<Response> {
  // Authenticate
  let auth;
  try {
    auth = await authenticate(req);
  } catch (err) {
    if (err instanceof AuthError) {
      return Response.json(
        jsonRpcError(null, -32000, err.message),
        { status: err.status }
      );
    }
    throw err;
  }

  // Parse JSON-RPC
  let rpcReq: JsonRpcRequest;
  try {
    rpcReq = await req.json();
  } catch {
    return Response.json(jsonRpcError(null, -32700, "Parse error"));
  }

  const { id, method, params } = rpcReq;

  try {
    switch (method) {
      // --- Lifecycle ---
      case "initialize": {
        return Response.json(
          jsonRpcResult(id, {
            protocolVersion: PROTOCOL_VERSION,
            capabilities: {
              tools: { listChanged: false },
              resources: { subscribe: false, listChanged: false },
              prompts: { listChanged: false },
            },
            serverInfo: SERVER_INFO,
          })
        );
      }

      case "notifications/initialized":
      case "initialized": {
        // Client acknowledgment — no response needed for notifications
        return Response.json(jsonRpcResult(id, {}));
      }

      case "ping": {
        return Response.json(jsonRpcResult(id, {}));
      }

      // --- Tools ---
      case "tools/list": {
        const cursor = params?.cursor as string | undefined;
        // Simple pagination: no cursor = all tools
        const tools = allTools.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        }));
        return Response.json(jsonRpcResult(id, { tools }));
      }

      case "tools/call": {
        const toolName = params?.name as string;
        const toolArgs = (params?.arguments as Record<string, unknown>) || {};

        const tool = toolMap.get(toolName);
        if (!tool) {
          return Response.json(
            jsonRpcResult(id, {
              content: [{ type: "text", text: `Unknown tool: ${toolName}` }],
              isError: true,
            })
          );
        }

        try {
          const result = await tool.handler(toolArgs, auth.client);
          return Response.json(
            jsonRpcResult(id, {
              content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
            })
          );
        } catch (err) {
          return Response.json(
            jsonRpcResult(id, {
              content: [{ type: "text", text: `Error: ${(err as Error).message}` }],
              isError: true,
            })
          );
        }
      }

      // --- Resources ---
      case "resources/list": {
        const resources = allResources.map((r) => ({
          uri: r.uri,
          name: r.name,
          description: r.description,
          mimeType: r.mimeType,
        }));
        return Response.json(jsonRpcResult(id, { resources }));
      }

      case "resources/read": {
        const uri = params?.uri as string;
        const resource = allResources.find((r) => r.uri === uri);
        if (!resource) {
          return Response.json(jsonRpcError(id, -32602, `Unknown resource: ${uri}`));
        }
        const content = await resource.handler(auth.client);
        return Response.json(
          jsonRpcResult(id, {
            contents: [{ uri, mimeType: resource.mimeType, text: content }],
          })
        );
      }

      // --- Prompts ---
      case "prompts/list": {
        const prompts = allPrompts.map((p) => ({
          name: p.name,
          description: p.description,
          arguments: p.arguments,
        }));
        return Response.json(jsonRpcResult(id, { prompts }));
      }

      case "prompts/get": {
        const promptName = params?.name as string;
        const promptArgs = (params?.arguments as Record<string, string>) || {};
        const prompt = allPrompts.find((p) => p.name === promptName);
        if (!prompt) {
          return Response.json(jsonRpcError(id, -32602, `Unknown prompt: ${promptName}`));
        }
        const text = prompt.template(promptArgs);
        return Response.json(
          jsonRpcResult(id, {
            description: prompt.description,
            messages: [{ role: "user", content: { type: "text", text } }],
          })
        );
      }

      default: {
        return Response.json(jsonRpcError(id, -32601, `Method not found: ${method}`));
      }
    }
  } catch (err) {
    return Response.json(jsonRpcError(id, -32603, (err as Error).message));
  }
}

// --- Hono App ---

// Supabase forwards path as /mcp-server/* to the function
const app = new Hono().basePath("/mcp-server");

app.use("/*", cors());

// Health / info
app.get("/", (c) => {
  return c.json({
    name: SERVER_INFO.name,
    version: SERVER_INFO.version,
    protocol: PROTOCOL_VERSION,
    tools: allTools.length,
    resources: allResources.length,
    prompts: allPrompts.length,
    endpoints: {
      mcp: "/functions/v1/mcp-server/mcp",
      openapi: "/functions/v1/mcp-server/openapi.json",
    },
  });
});

// OpenAPI spec — imported as JSON module so it's bundled with the function
app.get("/openapi.json", (c) => {
  return c.json(openApiSpec);
});

// MCP endpoint — handles POST (Streamable HTTP transport)
app.post("/mcp", async (c) => {
  return handleMcpRequest(c.req.raw);
});

// MCP endpoint — GET for SSE (server-sent events for streaming)
app.get("/mcp", (c) => {
  // For Streamable HTTP, GET establishes an SSE stream.
  // Return a simple SSE endpoint that sends a ping and stays open.
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(`event: endpoint\ndata: /functions/v1/mcp-server/mcp\n\n`));
      // Keep alive
      const interval = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(interval);
        }
      }, 30000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});

// DELETE for session cleanup (no-op for stateless)
app.delete("/mcp", (c) => {
  return c.json({ ok: true });
});

Deno.serve(app.fetch);
