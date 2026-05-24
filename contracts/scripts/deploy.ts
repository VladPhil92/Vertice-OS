import fs from "fs";
import path from "path";
import { ethers, network, run } from "hardhat";

const DEPLOYMENTS_DIR = path.join(__dirname, "..", "deployments");

interface DeploymentRecord {
  network:              string;
  chainId:             number;
  deployedAt:          string;
  deployer:            string;
  VotingRegistry:      string;
  CivicSBT:            string;
  admin:               string;
  governanceEngine:    string;
  minter:              string;
  blockNumber:         number;
}

async function verify(address: string, constructorArgs: unknown[]) {
  if (network.name === "hardhat" || network.name === "localhost") return;
  console.log(`\nVerifying ${address} on Polygonscan…`);
  try {
    await run("verify:verify", { address, constructorArguments: constructorArgs });
    console.log("✅ Verified");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Already Verified")) {
      console.log("ℹ️  Already verified");
    } else {
      console.warn("⚠️  Verification failed:", msg);
    }
  }
}

async function main() {
  const [deployer] = await ethers.getSigners();
  const chainId    = Number((await ethers.provider.getNetwork()).chainId);
  const balance    = await ethers.provider.getBalance(deployer.address);
  const block      = await ethers.provider.getBlock("latest");

  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`  VÉRTICE OS — Contract Deployment`);
  console.log(`╚══════════════════════════════════════════════════════╝`);
  console.log(`  Network:   ${network.name} (chainId ${chainId})`);
  console.log(`  Deployer:  ${deployer.address}`);
  console.log(`  Balance:   ${ethers.formatEther(balance)} MATIC`);
  console.log(`  Block:     ${block?.number ?? "?"}\n`);

  if (balance === 0n && network.name !== "hardhat" && network.name !== "localhost") {
    throw new Error("Deployer has 0 MATIC — fund the wallet first");
  }

  const adminAddress            = process.env.ADMIN_ADDRESS            ?? deployer.address;
  const governanceEngineAddress = process.env.GOVERNANCE_ENGINE_ADDRESS ?? deployer.address;
  const minterAddress           = process.env.MINTER_ADDRESS           ?? deployer.address;

  // ── VotingRegistry ────────────────────────────────────────────────────────

  console.log("▶ Deploying VotingRegistry…");
  const VotingRegistry = await ethers.getContractFactory("VotingRegistry");
  const votingRegistry = await VotingRegistry.deploy(adminAddress, governanceEngineAddress);
  await votingRegistry.waitForDeployment();
  const votingRegistryAddress = await votingRegistry.getAddress();
  console.log(`  ✅ VotingRegistry: ${votingRegistryAddress}`);

  // ── CivicSBT ──────────────────────────────────────────────────────────────

  console.log("▶ Deploying CivicSBT…");
  const CivicSBT = await ethers.getContractFactory("CivicSBT");
  const civicSBT = await CivicSBT.deploy(adminAddress, minterAddress);
  await civicSBT.waitForDeployment();
  const civicSBTAddress = await civicSBT.getAddress();
  console.log(`  ✅ CivicSBT:       ${civicSBTAddress}`);

  // ── Guardar registro de deployment ───────────────────────────────────────

  const record: DeploymentRecord = {
    network:           network.name,
    chainId,
    deployedAt:        new Date().toISOString(),
    deployer:          deployer.address,
    VotingRegistry:    votingRegistryAddress,
    CivicSBT:          civicSBTAddress,
    admin:             adminAddress,
    governanceEngine:  governanceEngineAddress,
    minter:            minterAddress,
    blockNumber:       block?.number ?? 0,
  };

  if (!fs.existsSync(DEPLOYMENTS_DIR)) {
    fs.mkdirSync(DEPLOYMENTS_DIR, { recursive: true });
  }
  const outPath = path.join(DEPLOYMENTS_DIR, `${network.name}.json`);
  fs.writeFileSync(outPath, JSON.stringify(record, null, 2));
  console.log(`\n  📄 Deployment saved: ${outPath}`);

  // ── Resumen ───────────────────────────────────────────────────────────────

  console.log(`\n╔══════════════════════════════════════════════════════╗`);
  console.log(`  Deployment complete`);
  console.log(`╚══════════════════════════════════════════════════════╝`);
  console.log(`  VotingRegistry:    ${votingRegistryAddress}`);
  console.log(`  CivicSBT:          ${civicSBTAddress}`);
  console.log(`  Admin:             ${adminAddress}`);
  console.log(`  Governance engine: ${governanceEngineAddress}`);
  console.log(`  Minter:            ${minterAddress}`);
  console.log(`\n  Next steps:`);
  console.log(`    1. Set VOTING_REGISTRY_ADDRESS=${votingRegistryAddress} in .env`);
  console.log(`    2. Set CIVIC_SBT_ADDRESS=${civicSBTAddress} in .env`);
  if (network.name !== "hardhat" && network.name !== "localhost") {
    console.log(`    3. Run: pnpm --filter @vertice/contracts verify`);
  }
  console.log("");

  // ── Verificación automática en testnets/mainnet ───────────────────────────

  if (network.name !== "hardhat" && network.name !== "localhost") {
    // Esperar algunos bloques para que Polygonscan indexe el contrato
    console.log("Esperando 5 bloques para verificación…");
    await new Promise(r => setTimeout(r, 30_000));

    await verify(votingRegistryAddress, [adminAddress, governanceEngineAddress]);
    await verify(civicSBTAddress,       [adminAddress, minterAddress]);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
