import register from '../index'
import { McpBridge } from '../mcp-bridge'

// ── Mocks ───────────────────────────────────────────────────────────

const mockConnect = jest.fn()
const mockListTools = jest.fn()
const mockCallTool = jest.fn()
const mockClose = jest.fn()

jest.mock('../mcp-bridge', () => ({
  McpBridge: jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    listTools: mockListTools,
    callTool: mockCallTool,
    close: mockClose,
  })),
}))

// ── Helpers ─────────────────────────────────────────────────────────

function createMockApi(configOverrides: Record<string, unknown> = {}) {
  return {
    config: {
      plugins: {
        entries: {
          solvapay: {
            enabled: true,
            config: {
              apiKey: 'sk_sandbox_test_key',
              ...configOverrides,
            },
          },
        },
      },
    },
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    registerTool: jest.fn(),
    registerService: jest.fn(),
  }
}

/** Extract the service object passed to registerService and call its start/stop. */
function getRegisteredService(api: ReturnType<typeof createMockApi>) {
  expect(api.registerService).toHaveBeenCalledTimes(1)
  return api.registerService.mock.calls[0][0] as {
    id: string
    start: () => Promise<void>
    stop: () => Promise<void>
  }
}

// ── Tests ───────────────────────────────────────────────────────────

describe('register() — plugin entry point', () => {
  const savedEnv: Record<string, string | undefined> = {}

  beforeEach(() => {
    jest.clearAllMocks()
    // Save and clear relevant env vars
    savedEnv.SOLVAPAY_API_KEY = process.env.SOLVAPAY_API_KEY
    savedEnv.SOLVAPAY_MCP_ENDPOINT = process.env.SOLVAPAY_MCP_ENDPOINT
    delete process.env.SOLVAPAY_API_KEY
    delete process.env.SOLVAPAY_MCP_ENDPOINT
  })

  afterEach(() => {
    // Restore env vars
    if (savedEnv.SOLVAPAY_API_KEY !== undefined) {
      process.env.SOLVAPAY_API_KEY = savedEnv.SOLVAPAY_API_KEY
    }
    if (savedEnv.SOLVAPAY_MCP_ENDPOINT !== undefined) {
      process.env.SOLVAPAY_MCP_ENDPOINT = savedEnv.SOLVAPAY_MCP_ENDPOINT
    }
  })

  // ── Config resolution ───────────────────────────────────────────

  describe('API key resolution', () => {
    it('warns and returns early when no API key in config or env', () => {
      const api = createMockApi({ apiKey: undefined })
      register(api)

      expect(api.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No API key configured'),
      )
      expect(api.registerService).not.toHaveBeenCalled()
    })

    it('reads API key from plugin config', () => {
      const api = createMockApi({ apiKey: 'sk_sandbox_from_config' })
      register(api)

      expect(McpBridge).toHaveBeenCalledWith({
        endpoint: 'https://mcp.solvapay.com/mcp',
        apiKey: 'sk_sandbox_from_config',
      })
    })

    it('falls back to SOLVAPAY_API_KEY env var when config is empty', () => {
      process.env.SOLVAPAY_API_KEY = 'sk_sandbox_from_env'
      const api = createMockApi({ apiKey: undefined })
      register(api)

      expect(api.registerService).toHaveBeenCalled()
      expect(McpBridge).toHaveBeenCalledWith({
        endpoint: 'https://mcp.solvapay.com/mcp',
        apiKey: 'sk_sandbox_from_env',
      })
    })
  })

  describe('endpoint resolution', () => {
    it('uses plugin config endpoint when provided', () => {
      const api = createMockApi({ endpoint: 'https://custom.example.com/mcp' })
      register(api)

      expect(McpBridge).toHaveBeenCalledWith({
        endpoint: 'https://custom.example.com/mcp',
        apiKey: 'sk_sandbox_test_key',
      })
    })

    it('falls back to SOLVAPAY_MCP_ENDPOINT env var', () => {
      process.env.SOLVAPAY_MCP_ENDPOINT = 'https://env.example.com/mcp'
      const api = createMockApi()
      register(api)

      expect(McpBridge).toHaveBeenCalledWith({
        endpoint: 'https://env.example.com/mcp',
        apiKey: 'sk_sandbox_test_key',
      })
    })

    it('defaults to https://mcp.solvapay.com/mcp', () => {
      const api = createMockApi()
      register(api)

      expect(McpBridge).toHaveBeenCalledWith({
        endpoint: 'https://mcp.solvapay.com/mcp',
        apiKey: 'sk_sandbox_test_key',
      })
    })
  })

  // ── Service registration ────────────────────────────────────────

  it('registers a service with id "solvapay-mcp"', () => {
    const api = createMockApi()
    register(api)

    const service = getRegisteredService(api)
    expect(service.id).toBe('solvapay-mcp')
  })

  // ── Service start ───────────────────────────────────────────────

  describe('service start', () => {
    it('connects bridge, discovers tools, and registers each one', async () => {
      mockListTools.mockResolvedValueOnce([
        { name: 'create_customer', description: 'Create a customer', inputSchema: { type: 'object' } },
        { name: 'list_plans', description: 'List plans', inputSchema: { type: 'object' } },
      ])

      const api = createMockApi()
      register(api)

      const service = getRegisteredService(api)
      await service.start()

      expect(mockConnect).toHaveBeenCalledTimes(1)
      expect(mockListTools).toHaveBeenCalledTimes(1)
      expect(api.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Connected to MCP server'),
      )
      expect(api.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Discovered 2 tools'),
      )
      expect(api.registerTool).toHaveBeenCalledTimes(2)
    })

    it('catches connection errors and logs them', async () => {
      mockConnect.mockRejectedValueOnce(new Error('Connection refused'))

      const api = createMockApi()
      register(api)

      const service = getRegisteredService(api)
      await service.start()

      expect(api.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to connect: Connection refused'),
      )
    })

    it('handles non-Error thrown values', async () => {
      mockConnect.mockRejectedValueOnce('string error')

      const api = createMockApi()
      register(api)

      const service = getRegisteredService(api)
      await service.start()

      expect(api.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to connect: string error'),
      )
    })
  })

  // ── Service stop ────────────────────────────────────────────────

  describe('service stop', () => {
    it('closes bridge when connected and logs disconnection', async () => {
      mockListTools.mockResolvedValueOnce([])
      const api = createMockApi()
      register(api)

      const service = getRegisteredService(api)
      await service.start()
      await service.stop()

      expect(mockClose).toHaveBeenCalledTimes(1)
      expect(api.logger.info).toHaveBeenCalledWith(
        '[SolvaPay] Disconnected from MCP server',
      )
    })

    it('is a no-op when not connected', async () => {
      const api = createMockApi()
      register(api)

      const service = getRegisteredService(api)
      await service.stop()

      expect(mockClose).not.toHaveBeenCalled()
    })
  })

  // ── Tool registration ───────────────────────────────────────────

  describe('registered tools', () => {
    it('prefixes tool names with solvapay_', async () => {
      mockListTools.mockResolvedValueOnce([
        { name: 'create_customer', description: 'Create', inputSchema: {} },
      ])

      const api = createMockApi()
      register(api)
      await getRegisteredService(api).start()

      const toolCall = api.registerTool.mock.calls[0]
      expect(toolCall[0].name).toBe('solvapay_create_customer')
    })

    it('passes tool inputSchema as parameters', async () => {
      const schema = { type: 'object', properties: { email: { type: 'string' } } }
      mockListTools.mockResolvedValueOnce([
        { name: 'create_customer', description: 'Create', inputSchema: schema },
      ])

      const api = createMockApi()
      register(api)
      await getRegisteredService(api).start()

      const toolCall = api.registerTool.mock.calls[0]
      expect(toolCall[0].parameters).toBe(schema)
    })

    it('marks tools as optional', async () => {
      mockListTools.mockResolvedValueOnce([
        { name: 'create_customer', description: 'Create', inputSchema: {} },
      ])

      const api = createMockApi()
      register(api)
      await getRegisteredService(api).start()

      const toolCall = api.registerTool.mock.calls[0]
      expect(toolCall[1]).toEqual({ optional: true })
    })

    it('falls back to "SolvaPay: <name>" when description is undefined', async () => {
      mockListTools.mockResolvedValueOnce([
        { name: 'mystery_tool', description: undefined, inputSchema: {} },
      ])

      const api = createMockApi()
      register(api)
      await getRegisteredService(api).start()

      const toolCall = api.registerTool.mock.calls[0]
      expect(toolCall[0].description).toBe('SolvaPay: mystery_tool')
    })

    it('uses the provided description when available', async () => {
      mockListTools.mockResolvedValueOnce([
        { name: 'create_customer', description: 'Create a new customer', inputSchema: {} },
      ])

      const api = createMockApi()
      register(api)
      await getRegisteredService(api).start()

      const toolCall = api.registerTool.mock.calls[0]
      expect(toolCall[0].description).toBe('Create a new customer')
    })

    // ── execute() ───────────────────────────────────────────────

    it('execute() returns text content on success', async () => {
      mockListTools.mockResolvedValueOnce([
        { name: 'get_balance', description: 'Balance', inputSchema: {} },
      ])
      mockCallTool.mockResolvedValueOnce('{"balance": 100}')

      const api = createMockApi()
      register(api)
      await getRegisteredService(api).start()

      const toolDef = api.registerTool.mock.calls[0][0]
      const result = await toolDef.execute('req-1', { foo: 'bar' })

      expect(result).toEqual({
        content: [{ type: 'text', text: '{"balance": 100}' }],
      })
      expect(mockCallTool).toHaveBeenCalledWith('get_balance', { foo: 'bar' })
    })

    it('execute() returns "Error: ..." on failure', async () => {
      mockListTools.mockResolvedValueOnce([
        { name: 'get_balance', description: 'Balance', inputSchema: {} },
      ])
      mockCallTool.mockRejectedValueOnce(new Error('Unauthorized'))

      const api = createMockApi()
      register(api)
      await getRegisteredService(api).start()

      const toolDef = api.registerTool.mock.calls[0][0]
      const result = await toolDef.execute('req-1', {})

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Error: Unauthorized' }],
      })
    })

    it('execute() handles non-Error thrown values', async () => {
      mockListTools.mockResolvedValueOnce([
        { name: 'get_balance', description: 'Balance', inputSchema: {} },
      ])
      mockCallTool.mockRejectedValueOnce('raw string error')

      const api = createMockApi()
      register(api)
      await getRegisteredService(api).start()

      const toolDef = api.registerTool.mock.calls[0][0]
      const result = await toolDef.execute('req-1', {})

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Error: raw string error' }],
      })
    })
  })
})
