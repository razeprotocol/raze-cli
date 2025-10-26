import fetch from "node-fetch";
import { ethers } from "ethers";

// Celo network RPCs via Forno (best-effort public endpoints)
export const CELO_NETWORKS = {
  mainnet: {
    name: "celo-mainnet",
    rpcUrl: process.env.CELO_RPC_URL || "https://forno.celo.org",
    wsUrl: process.env.CELO_WS_URL || "wss://forno.celo.org/ws",
    chainId: 42220,
  },
  sepolia: {
    name: "celo-sepolia",
    // Prefer Ankr public RPC for Sepolia (higher availability); override with CELO_SEPOLIA_RPC_URL
    rpcUrl:
      process.env.CELO_SEPOLIA_RPC_URL ||
      "https://rpc.ankr.com/celo_sepolia",
    wsUrl:
      process.env.CELO_SEPOLIA_WS_URL ||
      "wss://forno.celo-sepolia.celo-testnet.org/ws",
    chainId: 44787, // NOTE: update if different on L2 Sepolia
  },
};

export function getProvider(network = "mainnet") {
  const net = CELO_NETWORKS[network] || CELO_NETWORKS.mainnet;
  // Do not force a network object here — let the RPC respond with its chainId.
  // Passing an explicit network object can cause `network changed` errors when a RPC's
  // chainId doesn't match the expected value (common with testnets / proxies).
  return new ethers.JsonRpcProvider(net.rpcUrl);
}

export function getWebSocketProvider(network = "mainnet") {
  const net = CELO_NETWORKS[network] || CELO_NETWORKS.mainnet;
  if (!ethers.WebSocketProvider) return null;
  try {
    // Let the websocket connection negotiate the network rather than forcing a chainId
    return new ethers.WebSocketProvider(net.wsUrl);
  } catch (e) {
    return null;
  }
}

// Known Celo stable tokens (mainnet)
export const CELO_STABLE_TOKENS = {
  cUSD: "0x765DE816845861e75A25fCA122bb6898B8B1282a",
  cEUR: "0xD8763CBa276a3738E6De85b4b3BF5FDed6D6cA73",
  cREAL: "0xE4d517785D091D3c54818832dB6094bcc2744545",
};

export const ERC20_MIN_ABI = [
  "function symbol() view returns (string)",
  "function name() view returns (string)",
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function totalSupply() view returns (uint256)",
];

export const ERC165_ABI = [
  "function supportsInterface(bytes4 interfaceId) external view returns (bool)",
];

export const ERC721_MIN_ABI = [
  ...ERC165_ABI,
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function balanceOf(address owner) view returns (uint256)",
];

export async function getStableRates(fiat = "usd") {
  // Coingecko IDs for Celo stable assets
  const ids = ["celo-dollar", "celo-euro", "celo-real"];
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=${encodeURIComponent(
    fiat
  )}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch rates: ${res.status}`);
  const data = await res.json();
  return {
    cUSD: data["celo-dollar"]?.[fiat] ?? null,
    cEUR: data["celo-euro"]?.[fiat] ?? null,
    cREAL: data["celo-real"]?.[fiat] ?? null,
    fiat,
    source: "coingecko",
  };
}

export async function getAnalytics(provider) {
  const [blockNumber, feeData] = await Promise.all([
    provider.getBlockNumber(),
    provider.getFeeData(),
  ]);
  const latest = await provider.getBlock(blockNumber);
  // Sample a few blocks for avg block time
  const sample = 20;
  const first = await provider.getBlock(Math.max(blockNumber - sample, 1));
  const avgBlockTime = latest && first && latest.timestamp && first.timestamp
    ? (Number(latest.timestamp) - Number(first.timestamp)) /
      Math.max(blockNumber - Math.max(blockNumber - sample, 1), 1)
    : null;

  return {
    blockNumber,
    timestamp: latest?.timestamp ? new Date(Number(latest.timestamp) * 1000).toISOString() : null,
    baseFeePerGas: feeData?.maxFeePerGas?.toString?.() ?? null,
    gasPrice: feeData?.gasPrice?.toString?.() ?? null,
    priorityFee: feeData?.maxPriorityFeePerGas?.toString?.() ?? null,
    avgBlockTime,
  };
}

export async function getBalances(address, provider) {
  const [wei, cUSD, cEUR] = await Promise.all([
    provider.getBalance(address),
    readErc20Balance(CELO_STABLE_TOKENS.cUSD, address, provider),
    readErc20Balance(CELO_STABLE_TOKENS.cEUR, address, provider),
  ]);
  return {
    CELO: Number(ethers.formatEther(wei)),
    cUSD: cUSD,
    cEUR: cEUR,
  };
}

export async function readErc20Balance(token, address, provider) {
  try {
    const erc20 = new ethers.Contract(token, ERC20_MIN_ABI, provider);
    const [bal, decimals] = await Promise.all([
      erc20.balanceOf(address),
      erc20.decimals(),
    ]);
    const value = Number(ethers.formatUnits(bal, decimals));
    return value;
  } catch (e) {
    return null;
  }
}

export async function identifyAddress(address, provider) {
  const code = await provider.getCode(address);
  const isContract = code && code !== "0x";
  let contractInfo = null;
  if (isContract) {
    try {
      const c20 = new ethers.Contract(address, ERC20_MIN_ABI, provider);
      const [name, symbol] = await Promise.all([
        c20.name().catch(() => null),
        c20.symbol().catch(() => null),
      ]);
      contractInfo = { standard: "ERC20?", name, symbol };
    } catch {}

    if (!contractInfo?.name && !contractInfo?.symbol) {
      try {
        const c721 = new ethers.Contract(address, ERC721_MIN_ABI, provider);
        const [name, symbol] = await Promise.all([
          c721.name().catch(() => null),
          c721.symbol().catch(() => null),
        ]);
        contractInfo = { standard: "ERC721?", name, symbol };
      } catch {}
    }
  }

  const balances = await getBalances(address, provider);

  return { isContract, contractInfo, balances };
}

// -------- CIP-8 Metadata (Accounts) --------
export const REGISTRY_ABI = [
  "function getAddressForString(string identifier) view returns (address)",
];

export const ACCOUNTS_ABI = [
  "function getMetadataURL(address account) view returns (string)",
];

export const DEFAULT_REGISTRY_ADDRESS =
  process.env.CELO_REGISTRY_ADDRESS || "0x000000000000000000000000000000000000ce10";

export const DEFAULT_ACCOUNTS_ADDRESS = process.env.CELO_ACCOUNTS_ADDRESS || null; // prefer registry lookup

export async function getAccountsAddress(provider) {
  if (DEFAULT_ACCOUNTS_ADDRESS) return DEFAULT_ACCOUNTS_ADDRESS;
  try {
    const registry = new ethers.Contract(
      DEFAULT_REGISTRY_ADDRESS,
      REGISTRY_ABI,
      provider
    );
    const addr = await registry.getAddressForString("Accounts");
    if (addr && addr !== ethers.ZeroAddress) return addr;
  } catch {}
  return null;
}

export async function getCIP8MetadataURL(account, provider) {
  const accountsAddr = await getAccountsAddress(provider);
  if (!accountsAddr) return null;
  try {
    const accounts = new ethers.Contract(accountsAddr, ACCOUNTS_ABI, provider);
    const url = await accounts.getMetadataURL(account);
    return url || null;
  } catch (e) {
    return null;
  }
}

export function resolveIpfs(url) {
  if (!url) return null;
  if (url.startsWith("ipfs://")) {
    const cid = url.replace("ipfs://", "");
    const gw = process.env.IPFS_GATEWAY || "https://ipfs.io/ipfs/";
    return gw + cid;
  }
  return url;
}

export async function fetchCIP8Metadata(url) {
  const http = resolveIpfs(url);
  if (!http) return null;
  try {
    const res = await fetch(http);
    if (!res.ok) return null;
    const json = await res.json();
    return json;
  } catch {
    return null;
  }
}

// -------- Extended token scanning --------
export const DEFAULT_TOKEN_LIST = [
  { symbol: "cUSD", address: CELO_STABLE_TOKENS.cUSD, decimals: 18 },
  { symbol: "cEUR", address: CELO_STABLE_TOKENS.cEUR, decimals: 18 },
  { symbol: "cREAL", address: CELO_STABLE_TOKENS.cREAL, decimals: 18 },
  // Add more popular tokens here if desired (USDC, WETH on Celo, etc.)
];

export function loadLocalTokenList(cwd = process.cwd()) {
  try {
    const fs = require("fs");
    const path = require("path");
    const p = path.join(cwd, "tokens.celo.json");
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, "utf8"));
      if (Array.isArray(data)) return data;
      if (Array.isArray(data.tokens)) return data.tokens;
    }
  } catch {}
  return [];
}

export async function scanTokenBalances(address, provider, { threshold = 0, extraTokens = [] } = {}) {
  const tokens = [...DEFAULT_TOKEN_LIST, ...extraTokens];
  const results = [];
  await Promise.all(
    tokens.map(async (t) => {
      try {
        const erc20 = new ethers.Contract(t.address, ERC20_MIN_ABI, provider);
        const [balRaw, decRaw, name, symbol] = await Promise.all([
          erc20.balanceOf(address),
          erc20.decimals().catch(() => t.decimals || 18),
          erc20.name().catch(() => null),
          erc20.symbol().catch(() => t.symbol || null),
        ]);
        const decimals = Number(decRaw);
        const bal = Number(ethers.formatUnits(balRaw, decimals));
        if (bal > threshold) {
          results.push({ symbol: symbol || t.symbol, name, address: t.address, balance: bal, decimals });
        }
      } catch {}
    })
  );
  return results.sort((a, b) => b.balance - a.balance);
}
