import { ethers, network } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`\nDeploying to: ${network.name}`);
  console.log(`Deployer:     ${deployer.address}`);
  console.log(`Balance:      ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} MATIC\n`);

  const adminAddress           = process.env.ADMIN_ADDRESS           ?? deployer.address;
  const governanceEngineAddress = process.env.GOVERNANCE_ENGINE_ADDRESS ?? deployer.address;
  const minterAddress          = process.env.MINTER_ADDRESS          ?? deployer.address;

  // ── VotingRegistry ──────────────────────────────────────────────────────────

  console.log("Deploying VotingRegistry...");
  const VotingRegistry = await ethers.getContractFactory("VotingRegistry");
  const votingRegistry = await VotingRegistry.deploy(adminAddress, governanceEngineAddress);
  await votingRegistry.waitForDeployment();
  const votingRegistryAddress = await votingRegistry.getAddress();
  console.log(`VotingRegistry deployed: ${votingRegistryAddress}`);

  // ── CivicSBT ────────────────────────────────────────────────────────────────

  console.log("\nDeploying CivicSBT...");
  const CivicSBT = await ethers.getContractFactory("CivicSBT");
  const civicSBT = await CivicSBT.deploy(adminAddress, minterAddress);
  await civicSBT.waitForDeployment();
  const civicSBTAddress = await civicSBT.getAddress();
  console.log(`CivicSBT deployed:       ${civicSBTAddress}`);

  // ── Summary ─────────────────────────────────────────────────────────────────

  console.log("\n── Deployment complete ──────────────────────────────────────────");
  console.log(`Network:          ${network.name}`);
  console.log(`VotingRegistry:   ${votingRegistryAddress}`);
  console.log(`CivicSBT:         ${civicSBTAddress}`);
  console.log(`Admin:            ${adminAddress}`);
  console.log(`Governance engine: ${governanceEngineAddress}`);
  console.log(`Minter:           ${minterAddress}`);
  console.log("────────────────────────────────────────────────────────────────\n");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
