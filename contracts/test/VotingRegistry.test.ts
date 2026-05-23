import { expect } from "chai";
import { ethers } from "hardhat";
import { ZeroAddress } from "ethers";
import type { VotingRegistry } from "../typechain-types";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("VotingRegistry", function () {
  let registry: VotingRegistry;
  let admin: SignerWithAddress;
  let governance: SignerWithAddress;
  let stranger: SignerWithAddress;

  const GOVERNANCE_ROLE = ethers.keccak256(ethers.toUtf8Bytes("GOVERNANCE_ROLE"));

  // Sample proposal data
  const proposalId   = ethers.keccak256(ethers.toUtf8Bytes("proposal-uuid-001"));
  const proposalHash = ethers.keccak256(ethers.toUtf8Bytes("proposal content text"));
  const ipfsURI      = "ipfs://QmExampleHash";

  beforeEach(async function () {
    [admin, governance, stranger] = await ethers.getSigners();

    const VotingRegistryFactory = await ethers.getContractFactory("VotingRegistry");
    registry = await VotingRegistryFactory.deploy(admin.address, governance.address) as VotingRegistry;
    await registry.waitForDeployment();
  });

  // ── Deployment ──────────────────────────────────────────────────────────────

  describe("deployment", function () {
    it("grants DEFAULT_ADMIN_ROLE to admin", async function () {
      const adminRole = await registry.DEFAULT_ADMIN_ROLE();
      expect(await registry.hasRole(adminRole, admin.address)).to.be.true;
    });

    it("grants GOVERNANCE_ROLE to governance engine", async function () {
      expect(await registry.hasRole(GOVERNANCE_ROLE, governance.address)).to.be.true;
    });

    it("reverts if admin is zero address", async function () {
      const Factory = await ethers.getContractFactory("VotingRegistry");
      await expect(Factory.deploy(ZeroAddress, governance.address))
        .to.be.revertedWithCustomError(registry, "InvalidInput")
        .withArgs("admin is zero address");
    });

    it("reverts if governance engine is zero address", async function () {
      const Factory = await ethers.getContractFactory("VotingRegistry");
      await expect(Factory.deploy(admin.address, ZeroAddress))
        .to.be.revertedWithCustomError(registry, "InvalidInput")
        .withArgs("governance engine is zero address");
    });

    it("starts with totalRecorded = 0", async function () {
      expect(await registry.totalRecorded()).to.equal(0n);
    });
  });

  // ── recordVoting ────────────────────────────────────────────────────────────

  describe("recordVoting", function () {
    it("records a voting result and emits VotingFinalized", async function () {
      await expect(
        registry.connect(governance).recordVoting(
          proposalId, proposalHash,
          100,        // totalVotes
          600_000,    // approveWeighted (60 % × 10000)
          300_000,    // rejectWeighted
          100_000,    // abstainWeighted
          true,       // approved
          true,       // quorumReached
          ipfsURI,
        )
      )
        .to.emit(registry, "VotingFinalized")
        .withArgs(proposalId, proposalHash, true, true, 100n, expect.anything(), ipfsURI);
    });

    it("increments totalRecorded after each record", async function () {
      await registry.connect(governance).recordVoting(
        proposalId, proposalHash, 10, 60_000, 30_000, 10_000, true, true, ipfsURI,
      );
      expect(await registry.totalRecorded()).to.equal(1n);

      const pid2 = ethers.keccak256(ethers.toUtf8Bytes("proposal-uuid-002"));
      await registry.connect(governance).recordVoting(
        pid2, proposalHash, 5, 50_000, 50_000, 0, false, false, ipfsURI,
      );
      expect(await registry.totalRecorded()).to.equal(2n);
    });

    it("reverts when called by non-GOVERNANCE_ROLE", async function () {
      await expect(
        registry.connect(stranger).recordVoting(
          proposalId, proposalHash, 10, 60_000, 30_000, 10_000, true, true, ipfsURI,
        )
      ).to.be.reverted;
    });

    it("reverts on duplicate proposalId", async function () {
      await registry.connect(governance).recordVoting(
        proposalId, proposalHash, 10, 60_000, 30_000, 10_000, true, true, ipfsURI,
      );
      await expect(
        registry.connect(governance).recordVoting(
          proposalId, proposalHash, 10, 60_000, 30_000, 10_000, true, true, ipfsURI,
        )
      )
        .to.be.revertedWithCustomError(registry, "AlreadyRecorded")
        .withArgs(proposalId);
    });

    it("reverts when proposalId is zero bytes32", async function () {
      await expect(
        registry.connect(governance).recordVoting(
          ethers.ZeroHash, proposalHash, 10, 60_000, 30_000, 10_000, true, true, ipfsURI,
        )
      ).to.be.revertedWithCustomError(registry, "InvalidProposalId");
    });

    it("reverts when quorumReached=true but totalVotes=0", async function () {
      await expect(
        registry.connect(governance).recordVoting(
          proposalId, proposalHash, 0, 0, 0, 0, false, true, ipfsURI,
        )
      )
        .to.be.revertedWithCustomError(registry, "InvalidInput")
        .withArgs("quorum reached but totalVotes is 0");
    });

    it("allows quorumReached=false with totalVotes=0 (quorum_failed case)", async function () {
      await expect(
        registry.connect(governance).recordVoting(
          proposalId, proposalHash, 0, 0, 0, 0, false, false, ipfsURI,
        )
      ).not.to.be.reverted;
    });
  });

  // ── getRecord ───────────────────────────────────────────────────────────────

  describe("getRecord", function () {
    it("returns correct fields for a recorded proposal", async function () {
      await registry.connect(governance).recordVoting(
        proposalId, proposalHash, 100, 600_000, 300_000, 100_000, true, true, ipfsURI,
      );

      const record = await registry.getRecord(proposalId);
      expect(record.proposalHash).to.equal(proposalHash);
      expect(record.totalVotes).to.equal(100n);
      expect(record.approveWeighted).to.equal(600_000n);
      expect(record.rejectWeighted).to.equal(300_000n);
      expect(record.abstainWeighted).to.equal(100_000n);
      expect(record.approved).to.be.true;
      expect(record.quorumReached).to.be.true;
      expect(record.ipfsResultsURI).to.equal(ipfsURI);
      expect(record.timestamp).to.be.gt(0n);
    });

    it("returns zero-valued struct for unknown proposalId", async function () {
      const unknown = ethers.keccak256(ethers.toUtf8Bytes("nonexistent"));
      const record = await registry.getRecord(unknown);
      expect(record.totalVotes).to.equal(0n);
      expect(record.approved).to.be.false;
    });
  });

  // ── isRecorded ──────────────────────────────────────────────────────────────

  describe("isRecorded", function () {
    it("returns false before recording", async function () {
      expect(await registry.isRecorded(proposalId)).to.be.false;
    });

    it("returns true after recording", async function () {
      await registry.connect(governance).recordVoting(
        proposalId, proposalHash, 10, 60_000, 30_000, 10_000, true, true, ipfsURI,
      );
      expect(await registry.isRecorded(proposalId)).to.be.true;
    });
  });

  // ── verifyProposalHash ──────────────────────────────────────────────────────

  describe("verifyProposalHash", function () {
    beforeEach(async function () {
      await registry.connect(governance).recordVoting(
        proposalId, proposalHash, 50, 400_000, 500_000, 100_000, false, true, ipfsURI,
      );
    });

    it("returns true when hash matches", async function () {
      expect(await registry.verifyProposalHash(proposalId, proposalHash)).to.be.true;
    });

    it("returns false when hash does not match", async function () {
      const wrongHash = ethers.keccak256(ethers.toUtf8Bytes("tampered content"));
      expect(await registry.verifyProposalHash(proposalId, wrongHash)).to.be.false;
    });

    it("returns false for unrecorded proposal", async function () {
      const unknown = ethers.keccak256(ethers.toUtf8Bytes("unknown"));
      expect(await registry.verifyProposalHash(unknown, proposalHash)).to.be.false;
    });
  });
});
