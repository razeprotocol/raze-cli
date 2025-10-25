const { ethers } = require("hardhat");

// cUSD mainnet: 0x765DE816845861e75A25fCA122bb6898B8B1282a
// cUSD sepolia may differ; pass via env or replace below for testnet
const CUSD = process.env.CUSD_ADDRESS || "0x765DE816845861e75A25fCA122bb6898B8B1282a";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const price = ethers.parseUnits("5", 18); // 5 cUSD
  const baseURI = "https://your.cdn/metadata/";

  const F = await ethers.getContractFactory("CeloNFTDrop");
  const c = await F.deploy(CUSD, price, baseURI);
  await c.waitForDeployment();
  console.log("CeloNFTDrop deployed:", await c.getAddress());
}

main().catch((e) => { console.error(e); process.exit(1); });
