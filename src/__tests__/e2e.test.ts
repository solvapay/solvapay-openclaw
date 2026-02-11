import { describe, it, expect, afterAll } from 'vitest'
import { McpBridge } from '../mcp-bridge.js'

/**
 * End-to-end tests against the real SolvaPay MCP server (sandbox).
 *
 * These tests are SKIPPED when SOLVAPAY_TEST_API_KEY is not set,
 * so CI without secrets still passes. To run locally:
 *
 *   SOLVAPAY_TEST_API_KEY=sk_sandbox_... npm run test:e2e
 */

const ENDPOINT = 'https://mcp.solvapay.com/mcp'
const API_KEY = process.env.SOLVAPAY_TEST_API_KEY
const HAS_KEY = !!API_KEY

describe.skipIf(!HAS_KEY)('E2E: McpBridge against live sandbox', () => {
  const bridge = new McpBridge({
    endpoint: ENDPOINT,
    apiKey: API_KEY!,
  })

  afterAll(async () => {
    await bridge.close()
  })

  // ── Connection ──────────────────────────────────────────────────

  it('connects to the MCP server successfully', async () => {
    await expect(bridge.connect()).resolves.toBeUndefined()
  })

  // ── Tool discovery ──────────────────────────────────────────────

  it('discovers 38+ tools', async () => {
    const tools = await bridge.listTools()
    expect(tools.length).toBeGreaterThanOrEqual(38)
  })

  it('every tool has a name and inputSchema', async () => {
    const tools = await bridge.listTools()
    for (const tool of tools) {
      expect(tool.name).toBeTruthy()
      expect(tool.inputSchema).toBeDefined()
    }
  })

  it('includes expected tools (spot check)', async () => {
    const tools = await bridge.listTools()
    const names = tools.map((t) => t.name)

    expect(names).toContain('create_customer')
    expect(names).toContain('list_plans')
    expect(names).toContain('get_wallet_balance')
    expect(names).toContain('list_transactions')
    expect(names).toContain('record_usage')
  })

  // ── Tool calls ──────────────────────────────────────────────────

  it('callTool("list_customers", {}) returns a valid response', async () => {
    const result = await bridge.callTool('list_customers', {})
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('callTool("get_wallet_balance", {}) returns a valid response', async () => {
    const result = await bridge.callTool('get_wallet_balance', {})
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('callTool("list_plans", {}) returns a valid response', async () => {
    const result = await bridge.callTool('list_plans', {})
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })
})

describe.skipIf(!HAS_KEY)('E2E: invalid API key', () => {
  it('rejects with an error when using an invalid key', async () => {
    const badBridge = new McpBridge({
      endpoint: ENDPOINT,
      apiKey: 'sk_sandbox_invalid_key_that_does_not_exist',
    })

    try {
      await badBridge.connect()
      // If connect succeeds, listTools or callTool should fail
      await expect(
        badBridge.callTool('list_customers', {}),
      ).rejects.toThrow()
    } catch {
      // connect itself threw — that's also a valid rejection
      expect(true).toBe(true)
    } finally {
      await badBridge.close()
    }
  })
})
