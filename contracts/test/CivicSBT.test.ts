import { expect } from "chai";
import { ethers } from "hardhat";
import { ZeroAddress } from "ethers";
import type { CivicSBT } from "../typechain-types";
import type { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("CivicSBT", function () {
  let sbt: CivicSBT;
  let admin: SignerWithAddress;
  let minter: SignerWithAddress;
  let citizen: SignerWithAddress;
  let stranger: SignerWithAddress;

  const MINTER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("MINTER_ROLE"));
  const BURNER_ROLE = ethers.keccak256(ethers.toUtf8Bytes("BURNER_ROLE"));

  // ERC-165 interface IDs
  const IERC5192_ID  = "0xb45a3c0e"; // bytes4(keccak256("locked(uint256)"))
  const IERC721_ID   = "0x80ac58cd";

  const DID      = "did:vertice:550e8400-e29b-41d4-a716-446655440000";
  const TOKEN_URI = "ipfs://QmSBTMetadata";

  enum BadgeType {
    CITIZEN_VERIFIED       = 0,
    PROPOSAL_APPROVED      = 1,
    TERRITORY_CHAMPION     = 2,
    DELEGATE               = 3,
    GOVERNANCE_PARTICIPANT = 4,
  }

  beforeEach(async function () {
    [admin, minter, citizen, stranger] = await ethers.getSigners();

    const CivicSBTFactory = await ethers.getContractFactory("CivicSBT");
    sbt = await CivicSBTFactory.deploy(admin.address, minter.address) as CivicSBT;
    await sbt.waitForDeployment();
  });

  // ── Deployment ──────────────────────────────────────────────────────────────

  describe("deployment", function () {
    it("has correct name and symbol", async function () {
      expect(await sbt.name()).to.equal("VERTICE Civic Badge");
      expect(await sbt.symbol()).to.equal("VCIVIC");
    });

    it("grants DEFAULT_ADMIN_ROLE to admin", async function () {
      const adminRole = await sbt.DEFAULT_ADMIN_ROLE();
      expect(await sbt.hasRole(adminRole, admin.address)).to.be.true;
    });

    it("grants MINTER_ROLE to minter", async function () {
      expect(await sbt.hasRole(MINTER_ROLE, minter.address)).to.be.true;
    });

    it("grants BURNER_ROLE to admin", async function () {
      expect(await sbt.hasRole(BURNER_ROLE, admin.address)).to.be.true;
    });

    it("reverts if admin is zero address", async function () {
      const Factory = await ethers.getContractFactory("CivicSBT");
      await expect(Factory.deploy(ZeroAddress, minter.address))
        .to.be.revertedWithCustomError(sbt, "InvalidInput")
        .withArgs("admin is zero address");
    });

    it("reverts if minter is zero address", async function () {
      const Factory = await ethers.getContractFactory("CivicSBT");
      await expect(Factory.deploy(admin.address, ZeroAddress))
        .to.be.revertedWithCustomError(sbt, "InvalidInput")
        .withArgs("minter is zero address");
    });

    it("starts with totalSupplyMinted = 0", async function () {
      expect(await sbt.totalSupplyMinted()).to.equal(0n);
    });
  });

  // ── mintBadge ───────────────────────────────────────────────────────────────

  describe("mintBadge", function () {
    it("mints a badge and assigns it to recipient", async function () {
      await sbt.connect(minter).mintBadge(citizen.address, DID, BadgeType.CITIZEN_VERIFIED, TOKEN_URI);
      expect(await sbt.ownerOf(0n)).to.equal(citizen.address);
    });

    it("emits Locked event on mint", async function () {
      await expect(
        sbt.connect(minter).mintBadge(citizen.address, DID, BadgeType.CITIZEN_VERIFIED, TOKEN_URI)
      ).to.emit(sbt, "Locked").withArgs(0n);
    });

    it("emits BadgeMinted event with correct data", async function () {
      await expect(
        sbt.connect(minter).mintBadge(citizen.address, DID, BadgeType.CITIZEN_VERIFIED, TOKEN_URI)
      )
        .to.emit(sbt, "BadgeMinted")
        .withArgs(citizen.address, 0n, DID, BadgeType.CITIZEN_VERIFIED, expect.anything());
    });

    it("sets tokenURI correctly", async function () {
      await sbt.connect(minter).mintBadge(citizen.address, DID, BadgeType.CITIZEN_VERIFIED, TOKEN_URI);
      expect(await sbt.tokenURI(0n)).to.equal(TOKEN_URI);
    });

    it("increments totalSupplyMinted after each mint", async function () {
      await sbt.connect(minter).mintBadge(citizen.address, DID, BadgeType.CITIZEN_VERIFIED, TOKEN_URI);
      expect(await sbt.totalSupplyMinted()).to.equal(1n);

      await sbt.connect(minter).mintBadge(citizen.address, DID, BadgeType.PROPOSAL_APPROVED, TOKEN_URI);
      expect(await sbt.totalSupplyMinted()).to.equal(2n);
    });

    it("allows same DID to hold multiple different badge types", async function () {
      await sbt.connect(minter).mintBadge(citizen.address, DID, BadgeType.CITIZEN_VERIFIED, TOKEN_URI);
      await expect(
        sbt.connect(minter).mintBadge(citizen.address, DID, BadgeType.DELEGATE, TOKEN_URI)
      ).not.to.be.reverted;
    });

    it("reverts on duplicate badge type for same DID", async function () {
      await sbt.connect(minter).mintBadge(citizen.address, DID, BadgeType.CITIZEN_VERIFIED, TOKEN_URI);
      await expect(
        sbt.connect(minter).mintBadge(citizen.address, DID, BadgeType.CITIZEN_VERIFIED, TOKEN_URI)
      )
        .to.be.revertedWithCustomError(sbt, "DIDAlreadyHasBadge")
        .withArgs(DID, BadgeType.CITIZEN_VERIFIED);
    });

    it("reverts when called by non-MINTER_ROLE", async function () {
      await expect(
        sbt.connect(stranger).mintBadge(citizen.address, DID, BadgeType.CITIZEN_VERIFIED, TOKEN_URI)
      ).to.be.reverted;
    });

    it("reverts if recipient is zero address", async function () {
      await expect(
        sbt.connect(minter).mintBadge(ZeroAddress, DID, BadgeType.CITIZEN_VERIFIED, TOKEN_URI)
      )
        .to.be.revertedWithCustomError(sbt, "InvalidInput")
        .withArgs("recipient is zero address");
    });

    it("reverts if citizenDID is empty", async function () {
      await expect(
        sbt.connect(minter).mintBadge(citizen.address, "", BadgeType.CITIZEN_VERIFIED, TOKEN_URI)
      )
        .to.be.revertedWithCustomError(sbt, "InvalidInput")
        .withArgs("citizenDID is empty");
    });
  });

  // ── hasBadge ────────────────────────────────────────────────────────────────

  describe("hasBadge", function () {
    it("returns false before minting", async function () {
      expect(await sbt.hasBadge(DID, BadgeType.CITIZEN_VERIFIED)).to.be.false;
    });

    it("returns true after minting", async function () {
      await sbt.connect(minter).mintBadge(citizen.address, DID, BadgeType.CITIZEN_VERIFIED, TOKEN_URI);
      expect(await sbt.hasBadge(DID, BadgeType.CITIZEN_VERIFIED)).to.be.true;
    });

    it("returns false for a different badge type not yet minted", async function () {
      await sbt.connect(minter).mintBadge(citizen.address, DID, BadgeType.CITIZEN_VERIFIED, TOKEN_URI);
      expect(await sbt.hasBadge(DID, BadgeType.DELEGATE)).to.be.false;
    });
  });

  // ── getSBTData ──────────────────────────────────────────────────────────────

  describe("getSBTData", function () {
    it("returns correct on-chain metadata", async function () {
      await sbt.connect(minter).mintBadge(citizen.address, DID, BadgeType.TERRITORY_CHAMPION, TOKEN_URI);
      const data = await sbt.getSBTData(0n);
      expect(data.citizenDID).to.equal(DID);
      expect(data.badgeType).to.equal(BadgeType.TERRITORY_CHAMPION);
      expect(data.burned).to.be.false;
      expect(data.issuedAt).to.be.gt(0n);
    });

    it("reverts for nonexistent tokenId", async function () {
      await expect(sbt.getSBTData(99n)).to.be.reverted;
    });
  });

  // ── Transfer disabled (Soulbound) ───────────────────────────────────────────

  describe("transfer disabled", function () {
    beforeEach(async function () {
      await sbt.connect(minter).mintBadge(citizen.address, DID, BadgeType.CITIZEN_VERIFIED, TOKEN_URI);
    });

    it("reverts transferFrom", async function () {
      await expect(
        sbt.connect(citizen).transferFrom(citizen.address, stranger.address, 0n)
      ).to.be.revertedWithCustomError(sbt, "TransferDisabled");
    });

    it("reverts safeTransferFrom", async function () {
      await expect(
        sbt.connect(citizen)["safeTransferFrom(address,address,uint256)"](
          citizen.address, stranger.address, 0n
        )
      ).to.be.revertedWithCustomError(sbt, "TransferDisabled");
    });
  });

  // ── locked (ERC-5192) ───────────────────────────────────────────────────────

  describe("locked (ERC-5192)", function () {
    it("returns true for a minted token", async function () {
      await sbt.connect(minter).mintBadge(citizen.address, DID, BadgeType.CITIZEN_VERIFIED, TOKEN_URI);
      expect(await sbt.locked(0n)).to.be.true;
    });

    it("reverts for nonexistent tokenId", async function () {
      await expect(sbt.locked(99n)).to.be.reverted;
    });
  });

  // ── burn ────────────────────────────────────────────────────────────────────

  describe("burn", function () {
    beforeEach(async function () {
      await sbt.connect(minter).mintBadge(citizen.address, DID, BadgeType.CITIZEN_VERIFIED, TOKEN_URI);
    });

    it("allows owner to burn their token", async function () {
      await expect(sbt.connect(citizen).burn(0n))
        .to.emit(sbt, "BadgeBurned")
        .withArgs(0n, DID, BadgeType.CITIZEN_VERIFIED);
    });

    it("allows BURNER_ROLE (admin) to burn any token", async function () {
      await expect(sbt.connect(admin).burn(0n))
        .to.emit(sbt, "BadgeBurned");
    });

    it("reverts when non-owner non-admin tries to burn", async function () {
      await expect(sbt.connect(stranger).burn(0n))
        .to.be.revertedWithCustomError(sbt, "NotTokenOwnerOrAdmin");
    });

    it("clears hasBadge after burn, allowing re-mint", async function () {
      await sbt.connect(citizen).burn(0n);
      expect(await sbt.hasBadge(DID, BadgeType.CITIZEN_VERIFIED)).to.be.false;

      // Re-mint should succeed
      await expect(
        sbt.connect(minter).mintBadge(citizen.address, DID, BadgeType.CITIZEN_VERIFIED, TOKEN_URI)
      ).not.to.be.reverted;
    });

    it("reverts getSBTData after burn (token no longer exists)", async function () {
      await sbt.connect(citizen).burn(0n);
      await expect(sbt.getSBTData(0n)).to.be.reverted;
    });
  });

  // ── supportsInterface ───────────────────────────────────────────────────────

  describe("supportsInterface", function () {
    it("supports IERC721", async function () {
      expect(await sbt.supportsInterface(IERC721_ID)).to.be.true;
    });

    it("supports IERC5192", async function () {
      expect(await sbt.supportsInterface(IERC5192_ID)).to.be.true;
    });

    it("does not support random interface", async function () {
      expect(await sbt.supportsInterface("0xdeadbeef")).to.be.false;
    });
  });
});
