# Celo MCP (Model Context Protocol) — Raze CLI integration

This document explains how Raze integrates with the Celo MCP server and provides a small local stub to help you get started quickly for development and coding via the CLI.

Official docs and reference:
- https://docs.celo.org/build-on-celo/build-with-ai/mcp/celo-mcp

What Raze provides
- `raze mcp start` — attempts to start the official Celo MCP (`python -m celo_mcp.server`) and falls back to a lightweight Node stub if Python/package isn't available.
- `raze mcp run-stub` — explicitly run the Node MCP stub included in this repo (`mcp-server.js`).
- `raze mcp status` — checks `http://localhost:5005/health` to see if an MCP is responding.
- `raze mcp config` — writes a sample MCP client config for Cursor/Claude to `~/.cursor/mcp.json`.
- `raze mcp install` — prints recommended install instructions for the official server (pipx or from source).

Why use the official Celo MCP?
- The official server (python package `celo-mcp`) implements the full MCP toolset described in the docs: blockchain data access, token/NFT helpers, contract interactions, transaction estimation and governance tools.

Using the Node stub
- The stub is intentionally conservative and safe: it will not execute shell commands or arbitrary code. It provides endpoints:
  - GET /health
  - GET /tools
  - GET /get_network_status
  - GET /get_block?number=latest
  - GET /get_account?address=0x...
  - POST /execute  (no-op acknowledgement)

Start the stub locally (in the repo root):

```bash
node mcp-server.js --port 5005
# or via the CLI
raze mcp run-stub --port 5005
```

Configure developer IDEs
- To integrate with Cursor or Claude Desktop, add the MCP server command to their MCP client config as described in the official docs. `raze mcp config` writes a sample `~/.cursor/mcp.json` you can edit.

Recommended next steps
- Install the official Celo MCP server with pipx when you want the full feature set:

```bash
pip install pipx
pipx install celo-mcp
# then run the server
python -m celo_mcp.server
```

- Use the Node stub for quick demos, prototyping, and CLI-driven coding exercises when Python isn't available.

Security note
- The Node stub is safe-by-default and does not execute code. The official server may provide richer automation; be cautious with any MCP client that exposes command execution.

Feedback / Contribution
- If you'd like, I can wire the stub to implement more tools (token balances, contract call helpers) or add a secure, opt-in command execution mode guarded by user confirmation and audit logs.
