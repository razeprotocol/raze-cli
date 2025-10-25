````markdown
# Celo Developer Tooling in Raze CLI

Raze CLI adds first-class support for building on Celo: scaffold projects, fetch real-time chain analytics, stablecoin rates, and perform identity lookups right from your terminal.

## Commands

### Scaffold Celo dApps

Generate a Celo-ready Hardhat project with templates:

```bash
# Interactive
raze celo scaffold

# Non-interactive
raze celo scaffold --name my-celo-drop --template nft-drop --network sepolia
raze celo scaffold --name microlend --template microfinance --network mainnet
```

Templates:
- NFT Drop (ERC721 with cUSD payments)
- Microfinance (cUSD-based microloans)

### Real-time Chain Analytics

```bash
# Pretty output
raze celo analytics

# JSON output
raze celo analytics --json
```

Shows: latest block, timestamp, gas/base fees, and average block time.

### Stablecoin Rates

```bash
raze celo rates           # pretty output
raze celo rates --json    # JSON output
```

Rates source: CoinGecko Simple Price (cUSD, cEUR, cREAL vs USD).

### Identity Lookup

```bash
# Non-interactive
raze celo identity --address 0x...

# Interactive prompt
raze celo identity
```

Displays:
- EOA vs Contract
- CELO, cUSD, cEUR balances
- If contract: attempts ERC20/721 name and symbol

---

## Upgrades

- Identity: CIP-8 metadata lookup via Accounts contract. Use `--metadata` with `raze celo identity`.
- Extended balances: Provide `tokens.celo.json` (optional) and use `--extended` to scan ERC20 balances.
- Live analytics: `raze celo analytics --watch` uses WebSocket (Forno) and auto-reconnects.
- Verification: `raze celo verify --address 0x... --network celo|celo_sepolia` runs Hardhat verification using customChains pointing to explorer.celo.org.

## Configuration

By default, the CLI uses Celo's public Forno endpoints (best-effort):
- Mainnet: https://forno.celo.org
- Sepolia Testnet: https://forno.celo-sepolia.celo-testnet.org

Override with environment variables:

```bash
export CELO_RPC_URL="https://your-mainnet-rpc"
export CELO_SEPOLIA_RPC_URL="https://your-sepolia-rpc"
```

Scaffolded projects write a .env.example with these values.

## Notes
- For production-grade apps, consider an RPC provider with SLAs.
- Identity via CIP-8 metadata and additional lookups may be added in future versions.


## Inside CLI Features (new / proposed additions)

Below are the higher-level features and the CLI surface we'd document and ship as Raze evolves. These are written as actionable command examples and short implementation notes you can include in the project README or roadmap.

A. NLP (Natural Language Processing)

Implementation:
- Integrate a LLM provider (Google Gemini or OpenAI) as a backend for NLU. Use the MCP server (see below) to mediate access and safe execution.
- Accept natural-language commands, parse intent, map to CLI actions and perform safe prompts/confirmations.

Examples:
- raze "deploy an NFT contract on Celo"
- raze "send 10 cUSD to +91-9876543210"
- raze "audit my smart contract for vulnerabilities"

Notes / Benefits:
- Lowers the barrier for non-technical users by translating plain language to actions.
- Speeds up workflows for experienced devs with shorthand/compound requests.
- Can be extended to voice command support (speech-to-text → raze command)

B. TEMPLATE System

Implementation:
- One-command scaffolding for curated project templates. Templates include chain-specific config, sensible defaults, and security checks.

Examples:
- raze create defi-protocol --chain celo
- raze create nft-marketplace --chain ethereum
- raze create dao --chain polygon

Template Categories:
- DeFi (DEX, lending, staking)
- NFT (marketplace, minting, collections)
- DAO (governance, treasury)
- Payment apps (Celo-focused)
- ReFi (regenerative finance, carbon credits)

Features:
- One-command scaffolding with CI-ready project layout
- Auto-configured for chosen blockchain (RPCs, oracles, tokens)
- Security checks pre-integrated (basic static analysis hooks, Slither integration optional)

C. MCP Integration (Model Context Protocol)

Implementation:
- Ship an optional MCP server that gives the AI controlled, auditable access to a development environment. The MCP server acts as the bridge between the LLM and the local system.
- Capabilities exposed to the model are configurable (execute commands, read/write files, spawn dev servers, run tests).

CLI Commands:
- raze mcp start    # Launch the MCP server
- raze mcp status   # Check server health
- raze mcp config   # Generate AI assistant config

Benefits:
- Enables safe automation (AI can run tests, create branches, open editors) while keeping human-in-the-loop controls.

4. USP: Phone Number Feature Integration (Celo-first)

Why this matters:
- Tightly aligns with Celo's mission to make crypto accessible via phone numbers. This can be a unique selling point for Raze.

Implementation Steps:

Phase 1: Basic Integration (on-chain mapping + simple send)
```bash
# Link phone to wallet
raze phone:link +91-9876543210

# Send to phone number (resolves to address)
raze send +91-9876543210 10 cUSD

# Check phone-to-address mapping
raze phone:lookup +91-9876543210
```

Phase 2: Advanced Features
```bash
# Import contacts
raze contacts:import

# Request payment via phone
raze request +91-9876543210 50 cUSD "Payment for services"

# Verify phone ownership (ODIS / SMS flow)
raze phone:verify
```

Technical Integration:
- Use Celo SocialConnect identity primitives and ODIS for privacy-preserving phone attestations.
- Optionally add SMS verification and an off-chain relayer for ownership proofs.
- Store mappings on-chain (or via a verifiable registry) with an on-chain lookup contract.

Why it's a USP:
- No other CLI provides first-class phone -> wallet tooling out-of-the-box.
- Makes blockchain accessible to billions used to phone-number UX.
- Mobile-first; useful for payment apps built on Celo.

FUTURE INTEGRATIONS (short-term roadmap, 3-6 months)

1. Cross-Chain Bridge Integration
- One-command asset bridging between chains (supporting Wormhole, LayerZero, Axelar).
- Example: raze bridge 100 USDC ethereum->celo

2. AI Security Auditor
- Real-time vulnerability scanning, gas-optimization hints and automated fix suggestions.
- Integrate Slither, MythX, Echidna and generate human-readable reports; optionally open PRs with suggested fixes.

3. DeFi Dashboard Generator
- Auto-generate analytics dashboards and a deployable frontend for portfolio tracking and multi-chain yield optimization.

4. Voice Command Interface
- Full voice control for CLI (speech-to-text) and audio feedback on transaction status.

5. Mobile App Companion
- iOS/Android app to monitor CLI operations, push notifications for transactions, and QR-code wallet connect.

---

Notes
- These additions are written as product/roadmap text that can be added to the repo README or product docs. They describe concrete CLI commands and the implementation approaches we'd take.
- If you'd like, I can also: add the template wiring in `commands/create.js`, stub MCP server code under `mcp-server.js`, and add the phone mapping commands in `commands/phone.js` so the features are scaffolded and ready for implementation.

---

_This file was updated to include planned CLI features, AI/NLP integration notes, a template system, MCP integration commands, and a Celo-first phone-number UX as the project's USP._

````
# Celo Developer Tooling in Raze CLI

Raze CLI adds first-class support for building on Celo: scaffold projects, fetch real-time chain analytics, stablecoin rates, and perform identity lookups right from your terminal.

## Commands

### Scaffold Celo dApps

Generate a Celo-ready Hardhat project with templates:

```bash
# Interactive
raze celo scaffold

# Non-interactive
raze celo scaffold --name my-celo-drop --template nft-drop --network sepolia
raze celo scaffold --name microlend --template microfinance --network mainnet
```

Templates:
- NFT Drop (ERC721 with cUSD payments)
- Microfinance (cUSD-based microloans)

### Real-time Chain Analytics

```bash
# Pretty output
raze celo analytics

# JSON output
raze celo analytics --json
```

Shows: latest block, timestamp, gas/base fees, and average block time.

### Stablecoin Rates

```bash
raze celo rates           # pretty output
raze celo rates --json    # JSON output
```

Rates source: CoinGecko Simple Price (cUSD, cEUR, cREAL vs USD).

### Identity Lookup

```bash
# Non-interactive
raze celo identity --address 0x...

# Interactive prompt
raze celo identity
```

Displays:
- EOA vs Contract
- CELO, cUSD, cEUR balances
- If contract: attempts ERC20/721 name and symbol

---

## Upgrades

- Identity: CIP-8 metadata lookup via Accounts contract. Use `--metadata` with `raze celo identity`.
- Extended balances: Provide `tokens.celo.json` (optional) and use `--extended` to scan ERC20 balances.
- Live analytics: `raze celo analytics --watch` uses WebSocket (Forno) and auto-reconnects.
- Verification: `raze celo verify --address 0x... --network celo|celo_sepolia` runs Hardhat verification using customChains pointing to explorer.celo.org.

## Configuration

By default, the CLI uses Celo's public Forno endpoints (best-effort):
- Mainnet: https://forno.celo.org
- Sepolia Testnet: https://forno.celo-sepolia.celo-testnet.org

Override with environment variables:

```bash
export CELO_RPC_URL="https://your-mainnet-rpc"
export CELO_SEPOLIA_RPC_URL="https://your-sepolia-rpc"
```

Scaffolded projects write a .env.example with these values.

## Notes
- For production-grade apps, consider an RPC provider with SLAs.
- Identity via CIP-8 metadata and additional lookups may be added in future versions.
