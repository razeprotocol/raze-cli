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
