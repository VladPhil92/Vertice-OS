// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "./interfaces/IERC5192.sol";

/**
 * @title CivicSBT
 * @notice Soulbound Tokens cívicos de VÉRTICE OS — no transferibles, vinculados al DID.
 *
 * Cada token representa un logro cívico verificado on-chain:
 *
 *   CITIZEN_VERIFIED        — Identidad cívica verificada (nivel 1+)
 *   PROPOSAL_APPROVED       — El ciudadano presentó una propuesta que fue aprobada
 *   TERRITORY_CHAMPION      — Contribución verificada a mejoras territoriales
 *   DELEGATE                — Rol de delegado activo en gobernanza líquida
 *   GOVERNANCE_PARTICIPANT  — Participación sostenida en votaciones (≥5 votos)
 *
 * Soulbound (ERC-5192):
 *   - Los tokens son permanentemente no-transferibles una vez emitidos.
 *   - Solo el propietario o un BURNER_ROLE puede quemarlo.
 *   - Un ciudadano puede tener como máximo un badge de cada tipo.
 *
 * Privacidad — el DID NUNCA se escribe en claro:
 *   El contrato solo maneja `didCommitment = keccak256(pepper ‖ did)`, donde el
 *   pepper es un secreto del backend. Guardar el DID en claro habría creado un
 *   vínculo público y permanente entre wallet, identidad cívica y actividad
 *   política, correlacionable con los registros off-chain de votos, propuestas
 *   y reportes territoriales. Con el compromiso, quien observa la cadena no
 *   puede vincular un token a un ciudadano ni comprobar si un DID concreto
 *   posee badges, porque sin el pepper no puede reconstruir el compromiso.
 *   El backend sí puede hacerlo, de forma determinista, para prevenir
 *   duplicados y para probar selectivamente la titularidad cuando proceda.
 *
 * Control de acceso:
 *   - DEFAULT_ADMIN_ROLE → administración de la plataforma (multisig en Fase II)
 *   - MINTER_ROLE        → servicio de identidad (backend de VÉRTICE OS)
 *   - BURNER_ROLE        → admins y el propio propietario del token
 *
 * Metadata:
 *   - tokenURI apunta a un JSON ERC-721 almacenado en IPFS.
 *   - Los atributos incluyen: badge_type, did_commitment, locality, issued_at.
 *     El JSON es público igual que la cadena: nunca debe incluir el DID en
 *     claro ni datos que permitan reidentificar al ciudadano.
 */
contract CivicSBT is ERC721, ERC721URIStorage, AccessControl, IERC5192 {

    // ── Roles ─────────────────────────────────────────────────────────────────

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    // ── Tipos de badge ────────────────────────────────────────────────────────

    enum BadgeType {
        CITIZEN_VERIFIED,       // 0 — Identidad verificada
        PROPOSAL_APPROVED,      // 1 — Propuesta aprobada por la comunidad
        TERRITORY_CHAMPION,     // 2 — Impacto territorial verificado
        DELEGATE,               // 3 — Rol de delegado activo
        GOVERNANCE_PARTICIPANT  // 4 — Participación sostenida en gobernanza
    }

    // ── Datos por token ───────────────────────────────────────────────────────

    struct SBTData {
        /// @dev Compromiso del DID: keccak256(pepper ‖ did) calculado off-chain.
        ///      Nunca el DID en claro — ver nota de privacidad en el encabezado.
        bytes32  didCommitment;
        BadgeType badgeType;
        uint256  issuedAt;   // Unix timestamp de emisión
        bool     burned;
    }

    // ── Estado ────────────────────────────────────────────────────────────────

    uint256 private _nextTokenId;

    /// @notice Datos de cada token emitido.
    mapping(uint256 => SBTData) private _sbtData;

    /// @notice Previene que un mismo DID obtenga el mismo badge dos veces.
    ///         didCommitment → badgeType (uint256) → emitido
    mapping(bytes32 => mapping(uint256 => bool)) private _didHasBadge;

    // ── Errores ───────────────────────────────────────────────────────────────

    error TransferDisabled();
    error DIDAlreadyHasBadge(bytes32 didCommitment, uint256 badgeType);
    error NotTokenOwnerOrAdmin();
    error InvalidInput(string reason);

    // ── Eventos ───────────────────────────────────────────────────────────────

    event BadgeMinted(
        address   indexed recipient,
        uint256   indexed tokenId,
        bytes32   indexed didCommitment,
        BadgeType badgeType,
        uint256   timestamp
    );

    event BadgeBurned(
        uint256   indexed tokenId,
        bytes32   indexed didCommitment,
        BadgeType badgeType
    );

    // ── Constructor ───────────────────────────────────────────────────────────

    /**
     * @param admin   Administrador de la plataforma
     * @param minter  Servicio de identidad autorizado a emitir badges
     */
    constructor(address admin, address minter)
        ERC721("VERTICE Civic Badge", "VCIVIC")
    {
        if (admin == address(0))  revert InvalidInput("admin is zero address");
        if (minter == address(0)) revert InvalidInput("minter is zero address");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, minter);
        _grantRole(BURNER_ROLE, admin);
    }

    // ── ERC-5192 — Soulbound ──────────────────────────────────────────────────

    /**
     * @notice Todos los tokens de este contrato son permanentemente soulbound.
     * @dev Reverts si `tokenId` no existe (delegado a _requireOwned).
     */
    function locked(uint256 tokenId) external view override returns (bool) {
        _requireOwned(tokenId);
        return true;
    }

    // ── Mint ──────────────────────────────────────────────────────────────────

    /**
     * @notice Emite un nuevo Soulbound Badge al ciudadano.
     *
     * @param recipient      Dirección del wallet del ciudadano en Polygon
     * @param didCommitment  keccak256(pepper ‖ did) calculado por el backend
     * @param badgeType      Tipo de logro cívico
     * @param uri            URI de IPFS con metadata JSON (ERC-721 metadata standard)
     * @return tokenId       ID del token recién emitido
     *
     * @dev Reverts si el DID ya tiene un badge del mismo tipo.
     *      Solo MINTER_ROLE puede llamar esta función.
     */
    function mintBadge(
        address   recipient,
        bytes32   didCommitment,
        BadgeType badgeType,
        string    calldata uri
    )
        external
        onlyRole(MINTER_ROLE)
        returns (uint256 tokenId)
    {
        if (recipient == address(0))  revert InvalidInput("recipient is zero address");
        if (didCommitment == bytes32(0)) revert InvalidInput("didCommitment is empty");

        uint256 badgeIndex = uint256(badgeType);
        if (_didHasBadge[didCommitment][badgeIndex]) {
            revert DIDAlreadyHasBadge(didCommitment, badgeIndex);
        }

        tokenId = _nextTokenId;
        unchecked { _nextTokenId++; }

        _safeMint(recipient, tokenId);
        _setTokenURI(tokenId, uri);

        _sbtData[tokenId] = SBTData({
            didCommitment: didCommitment,
            badgeType:     badgeType,
            issuedAt:      block.timestamp,
            burned:        false
        });

        _didHasBadge[didCommitment][badgeIndex] = true;

        emit Locked(tokenId);
        emit BadgeMinted(recipient, tokenId, didCommitment, badgeType, block.timestamp);
    }

    // ── Burn ──────────────────────────────────────────────────────────────────

    /**
     * @notice Quema un badge. Puede ser llamado por el propietario o un BURNER_ROLE.
     *
     * @param tokenId ID del token a quemar
     *
     * @dev Tras la quema, el DID puede recibir un nuevo badge del mismo tipo
     *      (p.ej., si se revoca y se re-emite por una corrección).
     */
    function burn(uint256 tokenId) external {
        address owner = _requireOwned(tokenId);

        if (msg.sender != owner && !hasRole(BURNER_ROLE, msg.sender)) {
            revert NotTokenOwnerOrAdmin();
        }

        SBTData storage data = _sbtData[tokenId];
        bytes32 commitment = data.didCommitment;
        BadgeType badgeType = data.badgeType;

        // Liberar el slot para posible re-emisión
        _didHasBadge[commitment][uint256(badgeType)] = false;
        data.burned = true;

        emit BadgeBurned(tokenId, commitment, badgeType);
        _burn(tokenId);
    }

    // ── Soulbound override ────────────────────────────────────────────────────

    /**
     * @dev Bloquea toda transferencia entre direcciones distintas de la zero address.
     *      Permite mint (from = 0) y burn (to = 0), rechaza cualquier otro movimiento.
     */
    function _update(
        address to,
        uint256 tokenId,
        address auth
    )
        internal
        override(ERC721)
        returns (address)
    {
        address from = _ownerOf(tokenId);

        // Rechazar transferencias (from ≠ 0 y to ≠ 0)
        if (from != address(0) && to != address(0)) {
            revert TransferDisabled();
        }

        return super._update(to, tokenId, auth);
    }

    // ── Views ─────────────────────────────────────────────────────────────────

    /**
     * @notice Devuelve los metadatos on-chain de un badge.
     * @dev Reverts si el token no existe.
     */
    function getSBTData(uint256 tokenId) external view returns (SBTData memory) {
        _requireOwned(tokenId);
        return _sbtData[tokenId];
    }

    /**
     * @notice Verifica si un DID ya posee un badge de cierto tipo.
     * @param didCommitment keccak256(pepper ‖ did). Sin el pepper (secreto del
     *        backend) esta función no permite comprobar DIDs arbitrarios.
     */
    function hasBadge(bytes32 didCommitment, BadgeType badgeType) external view returns (bool) {
        return _didHasBadge[didCommitment][uint256(badgeType)];
    }

    /**
     * @notice Total de tokens emitidos (incluyendo los quemados).
     */
    function totalSupplyMinted() external view returns (uint256) {
        return _nextTokenId;
    }

    // ── Required overrides ────────────────────────────────────────────────────

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage, AccessControl)
        returns (bool)
    {
        return
            interfaceId == type(IERC5192).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}
