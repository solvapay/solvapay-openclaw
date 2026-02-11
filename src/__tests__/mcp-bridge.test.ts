import { McpBridge } from '../mcp-bridge'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

// ── Mocks ───────────────────────────────────────────────────────────
// jest.mock is hoisted above imports, so the mocked versions are used.

const mockConnect = jest.fn()
const mockListTools = jest.fn()
const mockCallTool = jest.fn()
const mockTransportClose = jest.fn()

jest.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    listTools: mockListTools,
    callTool: mockCallTool,
  })),
}))

jest.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: jest.fn().mockImplementation(() => ({
    close: mockTransportClose,
  })),
}))

// ── Tests ───────────────────────────────────────────────────────────

describe('McpBridge', () => {
  const opts = {
    endpoint: 'https://mcp.example.com/mcp',
    apiKey: 'sk_sandbox_test_key',
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  // ── constructor ─────────────────────────────────────────────────

  it('stores endpoint and apiKey from options', () => {
    const bridge = new McpBridge(opts)
    expect(bridge).toBeDefined()
  })

  // ── connect() ───────────────────────────────────────────────────

  it('creates Client with correct name and version', async () => {
    const bridge = new McpBridge(opts)
    await bridge.connect()

    expect(Client).toHaveBeenCalledWith(
      { name: 'solvapay-openclaw', version: '1.0.0' },
      { capabilities: {} },
    )
  })

  it('creates Transport with correct URL and X-API-Key header', async () => {
    const bridge = new McpBridge(opts)
    await bridge.connect()

    expect(StreamableHTTPClientTransport).toHaveBeenCalledWith(
      expect.any(URL),
      {
        requestInit: {
          headers: {
            'X-API-Key': opts.apiKey,
          },
        },
      },
    )

    // Verify the URL value
    const MockedTransport = jest.mocked(StreamableHTTPClientTransport)
    const urlArg = MockedTransport.mock.calls[0][0] as URL
    expect(urlArg.toString()).toBe(opts.endpoint)
  })

  it('calls client.connect with the transport', async () => {
    const bridge = new McpBridge(opts)
    await bridge.connect()

    expect(mockConnect).toHaveBeenCalledTimes(1)
  })

  // ── listTools() ─────────────────────────────────────────────────

  it('throws "Not connected" when called before connect()', async () => {
    const bridge = new McpBridge(opts)
    await expect(bridge.listTools()).rejects.toThrow('Not connected')
  })

  it('maps SDK tools response to McpTool[] shape', async () => {
    mockListTools.mockResolvedValueOnce({
      tools: [
        {
          name: 'create_customer',
          description: 'Create a customer',
          inputSchema: { type: 'object', properties: { email: { type: 'string' } } },
        },
        {
          name: 'list_plans',
          description: undefined,
          inputSchema: { type: 'object', properties: {} },
        },
      ],
    })

    const bridge = new McpBridge(opts)
    await bridge.connect()
    const tools = await bridge.listTools()

    expect(tools).toEqual([
      {
        name: 'create_customer',
        description: 'Create a customer',
        inputSchema: { type: 'object', properties: { email: { type: 'string' } } },
      },
      {
        name: 'list_plans',
        description: undefined,
        inputSchema: { type: 'object', properties: {} },
      },
    ])
  })

  // ── callTool() ──────────────────────────────────────────────────

  it('throws "Not connected" when called before connect()', async () => {
    const bridge = new McpBridge(opts)
    await expect(bridge.callTool('foo', {})).rejects.toThrow('Not connected')
  })

  it('extracts and joins text content blocks', async () => {
    mockCallTool.mockResolvedValueOnce({
      content: [
        { type: 'text', text: 'Hello' },
        { type: 'text', text: 'World' },
      ],
    })

    const bridge = new McpBridge(opts)
    await bridge.connect()
    const result = await bridge.callTool('some_tool', { key: 'value' })

    expect(result).toBe('Hello\nWorld')
    expect(mockCallTool).toHaveBeenCalledWith({
      name: 'some_tool',
      arguments: { key: 'value' },
    })
  })

  it('returns single text block without newlines', async () => {
    mockCallTool.mockResolvedValueOnce({
      content: [{ type: 'text', text: '{"id": "cust_123"}' }],
    })

    const bridge = new McpBridge(opts)
    await bridge.connect()
    const result = await bridge.callTool('get_customer', { reference: 'cust_123' })

    expect(result).toBe('{"id": "cust_123"}')
  })

  it('falls back to JSON.stringify when no text blocks are found', async () => {
    const content = [{ type: 'image', data: 'base64...' }]
    mockCallTool.mockResolvedValueOnce({ content })

    const bridge = new McpBridge(opts)
    await bridge.connect()
    const result = await bridge.callTool('some_tool', {})

    expect(result).toBe(JSON.stringify(content))
  })

  it('skips non-text content blocks', async () => {
    mockCallTool.mockResolvedValueOnce({
      content: [
        { type: 'image', data: 'base64...' },
        { type: 'text', text: 'only this' },
        { type: 'resource', uri: 'file://x' },
      ],
    })

    const bridge = new McpBridge(opts)
    await bridge.connect()
    const result = await bridge.callTool('some_tool', {})

    expect(result).toBe('only this')
  })

  // ── close() ─────────────────────────────────────────────────────

  it('calls transport.close() and nulls references', async () => {
    const bridge = new McpBridge(opts)
    await bridge.connect()
    await bridge.close()

    expect(mockTransportClose).toHaveBeenCalledTimes(1)

    // After close, listTools should throw "Not connected"
    await expect(bridge.listTools()).rejects.toThrow('Not connected')
  })

  it('is safe to call when not connected (no-op)', async () => {
    const bridge = new McpBridge(opts)
    await bridge.close()

    expect(mockTransportClose).not.toHaveBeenCalled()
  })

  it('is safe to call multiple times', async () => {
    const bridge = new McpBridge(opts)
    await bridge.connect()
    await bridge.close()
    await bridge.close()

    // Only called once because transport is nulled after first close
    expect(mockTransportClose).toHaveBeenCalledTimes(1)
  })
})
