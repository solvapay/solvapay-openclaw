import { McpBridge } from './mcp-bridge.js'
import type { McpTool } from './mcp-bridge.js'

const DEFAULT_ENDPOINT = 'https://mcp.solvapay.com/mcp'

/**
 * SolvaPay plugin for OpenClaw.
 *
 * Connects to the hosted SolvaPay MCP server, discovers available
 * tools, and registers each one as an OpenClaw agent tool so the
 * AI can manage payments, customers, plans, and more through chat.
 */

// OpenClaw plugin API types (minimal, inferred from docs)
interface PluginApi {
  config: {
    plugins?: {
      entries?: Record<string, {
        enabled?: boolean
        config?: Record<string, unknown>
      }>
    }
  }
  logger: {
    info: (msg: string) => void
    warn: (msg: string) => void
    error: (msg: string) => void
  }
  registerTool: (
    tool: {
      name: string
      description: string
      parameters: Record<string, unknown>
      execute: (id: string, params: Record<string, unknown>) => Promise<{
        content: Array<{ type: string; text: string }>
      }>
    },
    opts?: { optional?: boolean },
  ) => void
  registerService: (svc: {
    id: string
    start: () => void | Promise<void>
    stop: () => void | Promise<void>
  }) => void
}

export default function register(api: PluginApi) {
  const pluginConfig = api.config.plugins?.entries?.solvapay?.config as
    | { apiKey?: string; endpoint?: string }
    | undefined

  const apiKey = pluginConfig?.apiKey || process.env.SOLVAPAY_API_KEY
  const endpoint = pluginConfig?.endpoint || process.env.SOLVAPAY_MCP_ENDPOINT || DEFAULT_ENDPOINT

  if (!apiKey) {
    api.logger.warn(
      '[SolvaPay] No API key configured. Set plugins.entries.solvapay.config.apiKey or SOLVAPAY_API_KEY env var.',
    )
    return
  }

  const bridge = new McpBridge({ endpoint, apiKey })
  let connected = false

  // Register as a background service for lifecycle management
  api.registerService({
    id: 'solvapay-mcp',
    start: async () => {
      try {
        await bridge.connect()
        connected = true
        api.logger.info(`[SolvaPay] Connected to MCP server at ${endpoint}`)

        const tools = await bridge.listTools()
        api.logger.info(`[SolvaPay] Discovered ${tools.length} tools`)

        for (const tool of tools) {
          registerOpenClawTool(api, bridge, tool)
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        api.logger.error(`[SolvaPay] Failed to connect: ${message}`)
      }
    },
    stop: async () => {
      if (connected) {
        await bridge.close()
        connected = false
        api.logger.info('[SolvaPay] Disconnected from MCP server')
      }
    },
  })
}

/**
 * Register a single MCP tool as an OpenClaw agent tool.
 *
 * Tools are prefixed with `solvapay_` to avoid name collisions
 * and marked as optional so users opt in via tools.allow.
 */
function registerOpenClawTool(
  api: PluginApi,
  bridge: McpBridge,
  tool: McpTool,
) {
  const name = `solvapay_${tool.name}`

  api.registerTool(
    {
      name,
      description: tool.description || `SolvaPay: ${tool.name}`,
      parameters: tool.inputSchema,
      execute: async (_id, params) => {
        try {
          const result = await bridge.callTool(tool.name, params)
          return { content: [{ type: 'text', text: result }] }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          return {
            content: [{ type: 'text', text: `Error: ${message}` }],
          }
        }
      },
    },
    { optional: true },
  )
}
