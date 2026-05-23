// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IERC5192 — Minimal Soulbound NFT
 * @notice EIP-5192: interfaz mínima para tokens no-transferibles vinculados a una dirección.
 * @dev Ref: https://eips.ethereum.org/EIPS/eip-5192
 */
interface IERC5192 {
    /// @notice Emitido cuando un token pasa a estado bloqueado (soulbound).
    event Locked(uint256 tokenId);

    /// @notice Emitido cuando un token se desbloquea (si el contrato lo permite).
    event Unlocked(uint256 tokenId);

    /**
     * @notice Devuelve true si el token está bloqueado (no transferible).
     * @dev Reverts if `tokenId` does not exist.
     */
    function locked(uint256 tokenId) external view returns (bool);
}
