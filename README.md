# @solvapay/openclaw

OpenClaw plugin that connects the [SolvaPay](https://solvapay.com) MCP server to your OpenClaw gateway, giving your AI agent payment management tools across WhatsApp, Telegram, Discord, and any other connected channel.

## What it does

The plugin connects to the hosted SolvaPay MCP server, discovers all available tools at startup, and registers them as native OpenClaw agent tools. Your AI can then manage customers, plans, subscriptions, payments, usage tracking, and transactions through natural conversation.

## Prerequisites

- An OpenClaw gateway (v2.4+)
- A SolvaPay account — [sign up at solvapay.com/sign-up](https://app.solvapay.com/sign-up), then grab your API key from the dashboard under **Developers > Secret Keys**
- To process real payments, you must verify your account with our payment processor (Stripe) via the dashboard. Sandbox mode works immediately without verification.

## Quick start (vibe prompt)

If you use Cursor, Claude Code, or another AI coding assistant with access to a terminal, paste this prompt to have it do the setup for you:

> Install the @solvapay/solvapay OpenClaw plugin on my gateway. Run `openclaw plugins install @solvapay/solvapay`, then add the solvapay plugin to my ~/.openclaw/openclaw.json with `plugins.entries.solvapay.enabled: true` and `plugins.entries.solvapay.config.apiKey` set to my key (I'll provide it). Also add `"solvapay"` to `tools.allow`. Then restart the gateway with `openclaw gateway restart` and check the logs for "[SolvaPay] Discovered 38 tools".

Your assistant will walk you through each step and ask for your API key.

## Installation

### Option 1: npm (recommended)

```bash
openclaw plugins install @solvapay/openclaw
```

### Option 2: Local link (for development)

```bash
# From the solvapay-openclaw directory
npm install && npm run build
openclaw plugins install -l .
```

### Option 3: Manual copy

```bash
cp -r solvapay-openclaw ~/.openclaw/extensions/solvapay
cd ~/.openclaw/extensions/solvapay && npm install && npm run build
```

## Configuration

Add the plugin config to your `~/.openclaw/openclaw.json`:

```json5
{
  plugins: {
    entries: {
      solvapay: {
        enabled: true,
        config: {
          apiKey: "${SOLVAPAY_API_KEY}",
        },
      },
    },
  },
}
```

Then set the environment variable:

```bash
# In ~/.openclaw/.env
SOLVAPAY_API_KEY=sk_sandbox_your_key_here
```

Or paste the key directly in the config (not recommended for shared configs):

```json5
{
  plugins: {
    entries: {
      solvapay: {
        enabled: true,
        config: {
          apiKey: "sk_sandbox_your_key_here",
        },
      },
    },
  },
}
```

### Enable the tools

SolvaPay tools are registered as **optional** to avoid cluttering the tool set. Enable them for your agent:

```json5
{
  tools: {
    allow: ["solvapay"],  // enables all solvapay_* tools
  },
}
```

Or enable specific tools only:

```json5
{
  tools: {
    allow: [
      "solvapay_list_customers",
      "solvapay_get_wallet_balance",
      "solvapay_list_transactions",
    ],
  },
}
```

### Custom endpoint (optional)

To point at a different MCP server (e.g. local development):

```json5
{
  plugins: {
    entries: {
      solvapay: {
        enabled: true,
        config: {
          apiKey: "sk_sandbox_...",
          endpoint: "http://localhost:3001/mcp",
        },
      },
    },
  },
}
```

## Restart the gateway

After configuration, restart the gateway:

```bash
openclaw gateway restart
```

Check the logs to verify the connection:

```bash
openclaw gateway logs | grep SolvaPay
```

You should see:

```
[SolvaPay] Connected to MCP server at https://mcp.solvapay.com/mcp
[SolvaPay] Discovered 38 tools
```

## Verify

Message your bot on WhatsApp, Telegram, or any connected channel:

> "List my SolvaPay customers"

The agent should call `solvapay_list_customers` and return the results.

## Available tools

The plugin dynamically discovers all tools from the MCP server. As of v1.0, this includes 38 tools across 8 domains:

| Domain | Tools | Examples |
|---|---|---|
| Customers | 6 | create, get, list, update, delete, ensure |
| Agents | 5 | create, get, list, update, delete |
| Plans | 6 | create, get, list, update, delete, list_for_agent |
| Subscriptions | 5 | list, get, by_customer, by_agent, cancel |
| Payments | 7 | checkout, payment intents, process, portal |
| Wallet | 3 | balance, agent_balance, stats |
| Usage | 2 | record, bulk_record |
| Transactions | 4 | list, get, stats, refund |

All tools are prefixed with `solvapay_` (e.g. `solvapay_create_customer`).

## Environments

The SolvaPay API key determines the environment:

| Key prefix | Environment | Data |
|---|---|---|
| `sk_sandbox_` | Sandbox | Test data only |
| `sk_live_` | Production | Real data |

Both use the same MCP endpoint — the server routes to the correct environment based on the key.

**Note:** Sandbox keys work immediately after sign-up. To use live keys and process real payments, you must first complete account verification with our payment processor (Stripe) in the [SolvaPay dashboard](https://app.solvapay.com).

## Troubleshooting

**"No API key configured" warning in logs**

Set `plugins.entries.solvapay.config.apiKey` in your config or export `SOLVAPAY_API_KEY` in `~/.openclaw/.env`.

**"Failed to connect" error**

Check that the endpoint is reachable from your gateway host. If running on a VM, ensure outbound HTTPS is allowed.

**Tools not appearing for the agent**

Add `"solvapay"` to `tools.allow` in your config. SolvaPay tools are optional and must be explicitly allowed.

**Tools appear but calls fail with auth errors**

Verify your API key is valid in the [SolvaPay dashboard](https://app.solvapay.com) under Developers > Secret Keys.

## Development

```bash
npm install
npm run dev    # watch mode
npm run build  # production build
npm run lint   # type check
```

## License

MIT
