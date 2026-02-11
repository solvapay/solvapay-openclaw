import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

export interface McpTool {
  name: string
  description?: string
  inputSchema: Record<string, unknown>
}

export interface McpBridgeOptions {
  endpoint: string
  apiKey: string
}

/**
 * Bridge to the SolvaPay MCP server.
 *
 * Connects via Streamable HTTP, discovers tools,
 * and forwards tool calls on behalf of the OpenClaw agent.
 */
export class McpBridge {
  private client: Client | null = null
  private transport: StreamableHTTPClientTransport | null = null
  private endpoint: string
  private apiKey: string

  constructor(opts: McpBridgeOptions) {
    this.endpoint = opts.endpoint
    this.apiKey = opts.apiKey
  }

  /** Connect to the MCP server and perform the handshake. */
  async connect(): Promise<void> {
    this.client = new Client(
      { name: 'solvapay-openclaw', version: '1.0.0' },
      { capabilities: {} },
    )

    this.transport = new StreamableHTTPClientTransport(
      new URL(this.endpoint),
      {
        requestInit: {
          headers: {
            'X-API-Key': this.apiKey,
          },
        },
      },
    )

    await this.client.connect(this.transport)
  }

  /** Discover all tools available on the MCP server. */
  async listTools(): Promise<McpTool[]> {
    if (!this.client) throw new Error('Not connected')

    const result = await this.client.listTools()
    return result.tools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema as Record<string, unknown>,
    }))
  }

  /** Forward a tool call to the MCP server and return the text result. */
  async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    if (!this.client) throw new Error('Not connected')

    const result = await this.client.callTool({ name, arguments: args })

    // Collect all text content blocks into a single string
    const parts: string[] = []
    for (const item of result.content as Array<{ type: string; text?: string }>) {
      if (item.type === 'text' && item.text) {
        parts.push(item.text)
      }
    }
    return parts.join('\n') || JSON.stringify(result.content)
  }

  /** Gracefully close the connection. */
  async close(): Promise<void> {
    if (this.transport) {
      await this.transport.close()
    }
    this.client = null
    this.transport = null
  }
}
