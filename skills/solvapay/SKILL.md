---
name: solvapay
description: Payment management tools for SolvaPay — manage customers, agents, plans, subscriptions, payments, usage, and transactions.
metadata: {"openclaw":{"emoji":"💳","primaryEnv":"SOLVAPAY_API_KEY"}}
---

# SolvaPay Payment Management

You have access to SolvaPay payment tools (prefixed `solvapay_`). Use them to manage the provider's payment platform.

## Tool Domains

### Customers
- `solvapay_create_customer` — Create a customer (requires email)
- `solvapay_get_customer` — Get by reference
- `solvapay_list_customers` — List/search with pagination
- `solvapay_update_customer` — Update name, email, telephone, metadata
- `solvapay_delete_customer` — Delete by reference
- `solvapay_ensure_customer` — Idempotent create-or-get by email

### Agents (AI agents / services)
- `solvapay_create_agent` — Create an agent (requires name)
- `solvapay_get_agent` — Get by reference
- `solvapay_list_agents` — List/search agents
- `solvapay_update_agent` — Update name, description, categories
- `solvapay_delete_agent` — Delete by reference

### Plans (pricing)
- `solvapay_create_plan` — Create a pricing plan (name, type, price)
- `solvapay_get_plan` — Get by reference
- `solvapay_list_plans` — List plans, filter by type/status
- `solvapay_update_plan` — Update name, description, features, price
- `solvapay_delete_plan` — Delete by reference
- `solvapay_list_plans_for_agent` — List plans assigned to an agent

### Subscriptions
- `solvapay_list_subscriptions` — List all subscriptions
- `solvapay_get_subscription` — Get by ID
- `solvapay_get_subscriptions_by_customer` — By customer reference
- `solvapay_get_subscriptions_by_agent` — By agent reference
- `solvapay_cancel_subscription` — Cancel with optional reason

### Payments & Checkout
- `solvapay_check_limits` — Check usage limits for customer/agent pair
- `solvapay_create_checkout_session` — Create a Stripe checkout session
- `solvapay_create_customer_session` — Create a customer portal session

### Wallet & Revenue
- `solvapay_get_wallet_balance` — Provider wallet balance
- `solvapay_get_agent_balance` — Revenue for a specific agent
- `solvapay_get_wallet_stats` — Wallet statistics

### Usage Tracking
- `solvapay_record_usage` — Record a single usage event
- `solvapay_record_bulk_usage` — Record multiple events at once

### Transactions & Refunds
- `solvapay_list_transactions` — List with date/status filters
- `solvapay_get_transaction` — Get by ID
- `solvapay_get_transaction_stats` — Transaction count and statistics
- `solvapay_create_refund` — Refund a transaction

## Common Workflows

**Onboard a new customer:**
1. `solvapay_ensure_customer` with their email
2. `solvapay_list_plans` to show available plans
3. `solvapay_create_checkout_session` to generate a payment link

**Check business health:**
1. `solvapay_get_wallet_balance` for total revenue
2. `solvapay_get_wallet_stats` for period stats
3. `solvapay_get_transaction_stats` for transaction overview

**Investigate a customer issue:**
1. `solvapay_list_customers` to find them by search
2. `solvapay_get_subscriptions_by_customer` to see their subscriptions
3. `solvapay_list_transactions` to review payment history
4. `solvapay_create_refund` if a refund is needed

## Environment

- API keys starting with `sk_sandbox_` use test data (sandbox environment)
- API keys starting with `sk_live_` use real data (production environment)
- All operations are scoped to the authenticated provider account
