// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title VotingRegistry
 * @notice Registro inmutable on-chain de resultados de votaciones ciudadanas de VÉRTICE OS.
 *
 * Diseño:
 *   - Los votos individuales son privados (nullifier en off-chain DB, ZKP en Fase II).
 *   - Solo el RESULTADO AGREGADO de cada propuesta se registra on-chain.
 *   - Los pesos se almacenan × 10 000 para evitar punto flotante
 *     (p.ej. 1.25 votos ponderados → 12 500).
 *   - El documento completo de la votación (con datos anonimizados) vive en IPFS;
 *     su URI se ancla aquí para garantizar su inmutabilidad.
 *
 * Control de acceso:
 *   - DEFAULT_ADMIN_ROLE  → equipo de VÉRTICE OS (multisig en Fase II)
 *   - GOVERNANCE_ROLE     → motor de gobernanza Fastify (wallet de servicio)
 *
 * Solo GOVERNANCE_ROLE puede escribir; cualquiera puede leer.
 */
contract VotingRegistry is AccessControl {

    // ── Roles ─────────────────────────────────────────────────────────────────

    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");

    // ── Tipos ─────────────────────────────────────────────────────────────────

    /**
     * @notice Registro completo de una votación finalizada.
     * @param proposalHash    keccak256 del contenido textual de la propuesta (verificabilidad)
     * @param timestamp       Unix timestamp del bloque de registro
     * @param totalVotes      Número de votantes únicos (para cálculo de quórum)
     * @param approveWeighted Suma de votos a favor × 10 000
     * @param rejectWeighted  Suma de votos en contra × 10 000
     * @param abstainWeighted Suma de abstenciones × 10 000
     * @param approved        true si la propuesta fue aprobada
     * @param quorumReached   true si se alcanzó el quórum mínimo requerido
     * @param ipfsResultsURI  URI de IPFS con resultados completos y auditables
     */
    struct VotingRecord {
        bytes32 proposalHash;
        uint256 timestamp;
        uint256 totalVotes;
        uint256 approveWeighted;
        uint256 rejectWeighted;
        uint256 abstainWeighted;
        bool    approved;
        bool    quorumReached;
        string  ipfsResultsURI;
    }

    // ── Estado ────────────────────────────────────────────────────────────────

    /// @notice Registro de cada propuesta por su ID (keccak256 del UUID off-chain).
    mapping(bytes32 => VotingRecord) private _records;

    /// @notice Previene registros duplicados.
    mapping(bytes32 => bool) private _recorded;

    /// @notice Total de votaciones registradas on-chain.
    uint256 public totalRecorded;

    // ── Errores ───────────────────────────────────────────────────────────────

    error AlreadyRecorded(bytes32 proposalId);
    error InvalidProposalId();
    error InvalidInput(string reason);

    // ── Eventos ───────────────────────────────────────────────────────────────

    event VotingFinalized(
        bytes32 indexed proposalId,
        bytes32 indexed proposalHash,
        bool    approved,
        bool    quorumReached,
        uint256 totalVotes,
        uint256 timestamp,
        string  ipfsURI
    );

    // ── Constructor ───────────────────────────────────────────────────────────

    /**
     * @param admin             Dirección admin (multisig recomendado en producción)
     * @param governanceEngine  Dirección del motor de gobernanza autorizado a registrar
     */
    constructor(address admin, address governanceEngine) {
        if (admin == address(0)) revert InvalidInput("admin is zero address");
        if (governanceEngine == address(0)) revert InvalidInput("governance engine is zero address");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GOVERNANCE_ROLE, governanceEngine);
    }

    // ── Escritura (solo GOVERNANCE_ROLE) ──────────────────────────────────────

    /**
     * @notice Registra el resultado inmutable de una votación finalizada.
     *
     * @param proposalId        keccak256 del UUID de la propuesta (off-chain ID)
     * @param proposalHash      keccak256 del contenido de la propuesta
     * @param totalVotes        Número de votantes únicos
     * @param approveWeighted   Votos a favor ponderados × 10 000
     * @param rejectWeighted    Votos en contra ponderados × 10 000
     * @param abstainWeighted   Abstenciones ponderadas × 10 000
     * @param approved          Resultado final de la votación
     * @param quorumReached     Si se alcanzó el quórum requerido
     * @param ipfsResultsURI    URI de IPFS con datos completos
     *
     * @dev Reverts si `proposalId` ya fue registrado o si es el hash vacío.
     */
    function recordVoting(
        bytes32 proposalId,
        bytes32 proposalHash,
        uint256 totalVotes,
        uint256 approveWeighted,
        uint256 rejectWeighted,
        uint256 abstainWeighted,
        bool    approved,
        bool    quorumReached,
        string  calldata ipfsResultsURI
    )
        external
        onlyRole(GOVERNANCE_ROLE)
    {
        if (proposalId == bytes32(0))   revert InvalidProposalId();
        if (_recorded[proposalId])      revert AlreadyRecorded(proposalId);
        if (quorumReached && totalVotes == 0) revert InvalidInput("quorum reached but totalVotes is 0");

        _records[proposalId] = VotingRecord({
            proposalHash:    proposalHash,
            timestamp:       block.timestamp,
            totalVotes:      totalVotes,
            approveWeighted: approveWeighted,
            rejectWeighted:  rejectWeighted,
            abstainWeighted: abstainWeighted,
            approved:        approved,
            quorumReached:   quorumReached,
            ipfsResultsURI:  ipfsResultsURI
        });

        _recorded[proposalId] = true;
        unchecked { totalRecorded++; }

        emit VotingFinalized(
            proposalId,
            proposalHash,
            approved,
            quorumReached,
            totalVotes,
            block.timestamp,
            ipfsResultsURI
        );
    }

    // ── Lectura (pública) ──────────────────────────────────────────────────────

    /**
     * @notice Devuelve el registro completo de una votación.
     * @dev Devuelve una struct vacía (con ceros) si la propuesta no existe.
     */
    function getRecord(bytes32 proposalId) external view returns (VotingRecord memory) {
        return _records[proposalId];
    }

    /**
     * @notice Verifica si una propuesta ya fue registrada on-chain.
     */
    function isRecorded(bytes32 proposalId) external view returns (bool) {
        return _recorded[proposalId];
    }

    /**
     * @notice Verifica que el hash de propuesta almacenado coincide con el provisto.
     *         Permite auditar la integridad del contenido sin revelar datos completos.
     *
     * @param proposalId  ID de la propuesta
     * @param claimedHash Hash que el auditor afirma corresponde a la propuesta
     * @return true si el hash coincide y la propuesta fue registrada
     */
    function verifyProposalHash(
        bytes32 proposalId,
        bytes32 claimedHash
    ) external view returns (bool) {
        return _recorded[proposalId] && _records[proposalId].proposalHash == claimedHash;
    }
}
