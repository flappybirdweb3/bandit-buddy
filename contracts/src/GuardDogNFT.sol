// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title GuardDogNFT
 * @notice ERC-1155 guard dog NFTs that protect players' farms from thieves.
 *
 * Each token ID maps to a dog breed. Breed metadata is stored on-chain.
 * The backend reads `defensePower` via event logs / RPC to apply game buffs.
 *
 * Token ID | Breed        | Defense | Price    | Max Supply
 * ---------|--------------|---------|----------|------------
 *    1     | Chihuahua    |  10%    |   50 $F  |  10,000
 *    2     | Corgi        |  20%    |  100 $F  |   5,000
 *    3     | Husky        |  35%    |  200 $F  |   3,000
 *    4     | Rottweiler   |  50%    |  500 $F  |   1,000
 *    5     | Doberman     |  65%    | 1000 $F  |     500
 *    6     | Pitbull      |  80%    | 2000 $F  |     100
 *
 * Revenue: FARM payments are burned (deflationary) via FarmToken.burn().
 *          Owner can change to treasury collection via setTreasury().
 */
contract GuardDogNFT is ERC1155, ERC1155Supply, Ownable, Pausable, ReentrancyGuard {
    using Strings for uint256;
    using SafeERC20 for IERC20;

    IERC20 public immutable farmToken;
    address public treasury;
    bool public burnOnPurchase = true; // burn FARM by default
    string private _baseUri;

    struct DogBreed {
        string  name;
        uint256 defensePower; // % deducted from 80% base steal rate
        uint256 priceInFarm;  // wei
        uint256 maxSupply;
    }

    uint256 public constant NUM_BREEDS = 6;
    mapping(uint256 => DogBreed) public breeds;

    // ─── Events ──────────────────────────────────────────────────────────────
    event DogPurchased(
        address indexed buyer,
        uint256 indexed tokenId,
        uint256 amount,
        uint256 totalCost
    );
    event PriceUpdated(uint256 indexed tokenId, uint256 newPrice);
    event TreasuryUpdated(address indexed newTreasury);
    event BurnModeUpdated(bool burnOnPurchase);
    event BaseURIUpdated(string newUri);

    // ─── Errors ──────────────────────────────────────────────────────────────
    error InvalidTokenId(uint256 id);
    error MaxSupplyReached(uint256 tokenId, uint256 maxSupply);
    error ZeroAmount();
    error ZeroAddress();
    error PaymentFailed();

    constructor(
        address _farmToken,
        address _initialOwner,
        address _treasury,
        string memory baseUri
    ) ERC1155(baseUri) Ownable(_initialOwner) {
        if (_farmToken == address(0) || _initialOwner == address(0) || _treasury == address(0)) revert ZeroAddress();
        farmToken = IERC20(_farmToken);
        treasury  = _treasury;
        _baseUri  = baseUri;

        // Initialise all 6 breeds
        breeds[1] = DogBreed("Chihuahua",   10,   50 * 1e18, 10_000);
        breeds[2] = DogBreed("Corgi",       20,  100 * 1e18,  5_000);
        breeds[3] = DogBreed("Husky",       35,  200 * 1e18,  3_000);
        breeds[4] = DogBreed("Rottweiler",  50,  500 * 1e18,  1_000);
        breeds[5] = DogBreed("Doberman",    65, 1000 * 1e18,    500);
        breeds[6] = DogBreed("Pitbull",     80, 2000 * 1e18,    100);
    }

    // ─── Purchase ────────────────────────────────────────────────────────────

    /**
     * @notice Buy guard dog NFT(s) by spending $FARM tokens.
     * @param tokenId  Breed ID (1–6).
     * @param amount   Number of dogs to buy (≥1).
     *
     * Caller must approve this contract to spend (priceInFarm * amount) FARM first.
     */
    function buyDog(uint256 tokenId, uint256 amount)
        external
        nonReentrant
        whenNotPaused
    {
        if (tokenId < 1 || tokenId > NUM_BREEDS) revert InvalidTokenId(tokenId);
        if (amount == 0) revert ZeroAmount();

        DogBreed storage breed = breeds[tokenId];
        uint256 newSupply = totalSupply(tokenId) + amount;
        if (newSupply > breed.maxSupply)
            revert MaxSupplyReached(tokenId, breed.maxSupply);

        uint256 totalCost = breed.priceInFarm * amount;

        // Pull payment
        farmToken.safeTransferFrom(msg.sender, address(this), totalCost);

        // Burn or route to treasury
        if (burnOnPurchase) {
            // FarmToken exposes burn() – call via low-level so we don't
            // need to import the full FarmToken interface here.
            (bool ok,) = address(farmToken).call(
                abi.encodeWithSignature("burn(uint256)", totalCost)
            );
            if (!ok) {
                // Fallback: send to treasury if token is not burnable
                farmToken.safeTransfer(treasury, totalCost);
            }
        } else {
            farmToken.safeTransfer(treasury, totalCost);
        }

        _mint(msg.sender, tokenId, amount, "");

        emit DogPurchased(msg.sender, tokenId, amount, totalCost);
    }

    // ─── View helpers ────────────────────────────────────────────────────────

    function uri(uint256 tokenId) public view override returns (string memory) {
        return string(abi.encodePacked(_baseUri, tokenId.toString(), ".json"));
    }

    /// @notice Total defense power from all dogs owned by an address.
    function totalDefensePower(address owner) external view returns (uint256 power) {
        for (uint256 i = 1; i <= NUM_BREEDS; i++) {
            uint256 bal = balanceOf(owner, i);
            if (bal > 0) {
                // Owning multiple of same breed stacks additively but is capped at 80
                power += breeds[i].defensePower * bal;
            }
        }
        // Cap total at 80 (same as base steal rate) → minimum 0% steal chance
        if (power > 80) power = 80;
    }

    function getBreed(uint256 tokenId) external view returns (DogBreed memory) {
        return breeds[tokenId];
    }

    function remainingSupply(uint256 tokenId) external view returns (uint256) {
        return breeds[tokenId].maxSupply - totalSupply(tokenId);
    }

    // ─── Admin ───────────────────────────────────────────────────────────────

    function setPrice(uint256 tokenId, uint256 newPrice) external onlyOwner {
        if (tokenId < 1 || tokenId > NUM_BREEDS) revert InvalidTokenId(tokenId);
        breeds[tokenId].priceInFarm = newPrice;
        emit PriceUpdated(tokenId, newPrice);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        treasury = newTreasury;
        emit TreasuryUpdated(newTreasury);
    }

    function setBurnMode(bool _burnOnPurchase) external onlyOwner {
        burnOnPurchase = _burnOnPurchase;
        emit BurnModeUpdated(_burnOnPurchase);
    }

    function setBaseURI(string calldata newUri) external onlyOwner {
        _baseUri = newUri;
        emit BaseURIUpdated(newUri);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ── Fusion contract ───────────────────────────────────────────────────────
    address public fusionContract;

    /// @dev Soul Shard — pity-system consolation item. No supply cap, not a breed.
    uint256 public constant SOUL_SHARD_ID = 9999;

    event FusionContractUpdated(address indexed newContract);
    event SoulShardBurned(address indexed from, uint256 amount);

    function setFusionContract(address _fusion) external onlyOwner {
        fusionContract = _fusion;
        emit FusionContractUpdated(_fusion);
    }

    /**
     * @notice Called by BanditDogFusion after commit-reveal resolves, or to mint Soul Shards.
     * - tokenId 1-6  : Guard Dog breeds (supply-capped)
     * - tokenId 9999 : Soul Shard (unlimited supply, no breed record)
     */
    function mint(address to, uint256 tokenId, uint256 amount, bytes calldata) external {
        require(msg.sender == fusionContract, "Not fusion contract");
        if (tokenId == SOUL_SHARD_ID) {
            _mint(to, tokenId, amount, "");
            return;
        }
        if (tokenId < 1 || tokenId > NUM_BREEDS) revert InvalidTokenId(tokenId);
        if (totalSupply(tokenId) + amount > breeds[tokenId].maxSupply)
            revert MaxSupplyReached(tokenId, breeds[tokenId].maxSupply);
        _mint(to, tokenId, amount, "");
    }

    /**
     * @notice Burn Soul Shards on behalf of a user during shard redemption.
     * Only callable by the fusion contract (which is authorised by the owner).
     */
    function burnShard(address from, uint256 amount) external {
        require(msg.sender == fusionContract, "Not fusion contract");
        _burn(from, SOUL_SHARD_ID, amount);
        emit SoulShardBurned(from, amount);
    }

    // Owner-mint for giveaways / airdrops
    function mintTo(address to, uint256 tokenId, uint256 amount) external onlyOwner {
        if (tokenId == SOUL_SHARD_ID) {
            _mint(to, tokenId, amount, "");
            return;
        }
        if (tokenId < 1 || tokenId > NUM_BREEDS) revert InvalidTokenId(tokenId);
        if (totalSupply(tokenId) + amount > breeds[tokenId].maxSupply)
            revert MaxSupplyReached(tokenId, breeds[tokenId].maxSupply);
        _mint(to, tokenId, amount, "");
    }

    // ─── Internal overrides ──────────────────────────────────────────────────

    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override(ERC1155, ERC1155Supply) whenNotPaused {
        super._update(from, to, ids, values);
    }
}
