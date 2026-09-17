// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/utils/ERC1155Holder.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title BanditDogFusion v4.2 (Soul Forge & Gacha Fusion with BNB Revenue Engine)
 * @notice Guard Dog Fusion (Soul Forge), Gacha Commit-Reveal, Web2.5 Bridge, Pity System,
 *         Golden Lucky Pulls, Mega Bulk Pulls x10, Divine Insurance, and Pull-Payment Referrals.
 *
 * Revenue Allocation:
 *   - 75% -> TreasuryBuyBack.sol (Auto Buyback & Burn $FARM threshold: 2.0 BNB)
 *   - 15% -> Pull-payment referral balances for referrers
 *   - 10% -> Community Lucky Red Packet / Jackpot pool
 */
contract BanditDogFusion is ReentrancyGuard, Ownable, Pausable, ERC1155Holder {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;

    // ── External contracts ───────────────────────────────────────────────────
    IERC20       public immutable farmToken;
    IMintableNFT public nftContract;

    // ── Config ───────────────────────────────────────────────────────────────
    uint256 public pullCost        = 50 * 10 ** 18;  // 50 FARM per Gacha pull
    uint256 public tokenizeCost    = 15 * 10 ** 18;  // 15 FARM to tokenize 1 shop dog
    uint256 public tokenizeCost3x  = 40 * 10 ** 18;  // 40 FARM to tokenize 3 shop dogs (bulk)
    uint256 public tokenizeBnbFee    = 0.002 ether;  // 0.002 BNB Oracle & Service Fee per dog
    uint256 public tokenizeBnbFee3x  = 0.005 ether;  // 0.005 BNB bulk 3x fee
    address public treasuryAddress;
    address public backendSigner;

    // ── Revenue Allocation Constants (BPS) ───────────────────────────────────
    uint256 public constant REVENUE_VAULT_BPS   = 7500; // 75%
    uint256 public constant REVENUE_REF_BPS     = 1500; // 15%
    uint256 public constant REVENUE_JACKPOT_BPS = 1000; // 10%
    uint256 public constant BPS_DENOMINATOR     = 10000;

    // ── Pull-Payment Referral & Jackpot Pools ────────────────────────────────
    mapping(address => uint256) public referralBalances;
    uint256 public jackpotPoolBnb;

    // ── Golden & Mega Bulk Pull Config ───────────────────────────────────────
    uint256 public goldenPullBnbFee = 0.002 ether;
    uint256 public bulk10PullBnbFee = 0.015 ether;
    uint256 public bulk10FarmCost   = 450 * 10 ** 18; // 10% discount on FARM

    // ── Fusion & Booster Fees ────────────────────────────────────────────────
    mapping(uint256 => uint256) public fusionFees;
    mapping(uint256 => uint256) public forgeInsuranceFees;
    uint256 public luckyBoneFee = 50 * 10 ** 18;   // +15% success chance
    uint256 public collarFee    = 150 * 10 ** 18;  // Preserves 3 dogs on fail

    address public constant DEAD_ADDRESS      = 0x000000000000000000000000000000000000dEaD;
    uint256 public constant MIN_REVEAL_BLOCKS  = 2;
    uint256 public constant REVEAL_WINDOW      = 256;   // ~13 min on BSC
    uint256 public constant SOUL_SHARD_ID      = 9999;
    uint256 public constant SHARDS_PER_REDEEM  = 100;
    uint256 public constant MAX_REDEEM_PER_TX  = 10;

    // ── Drop Weights (Cumulative out of 10000) ────────────────────────────────
    // Standard: Tier 1: 60%, Tier 2: 24%, Tier 3: 10%, Tier 4: 4%, Tier 5: 1.5%, Tier 6: 0.5%
    uint16[6] public weights       = [6000, 8400, 9400, 9800, 9950, 10000];
    // Golden:   Tier 1: 30%, Tier 2: 30%, Tier 3: 20%, Tier 4: 12%, Tier 5: 5.5%, Tier 6: 2.5%
    uint16[6] public goldenWeights = [3000, 6000, 8000, 9200, 9750, 10000];

    // ── Gacha Pull State ─────────────────────────────────────────────────────
    struct PendingPull {
        bytes32 commitment;
        uint256 commitBlock;
        bool    revealed;
        bool    isGolden;
        bool    isBulk10;
        address referrer;
    }

    mapping(address => PendingPull) public pendingPulls;
    mapping(address => uint256)     public pityCounter;
    mapping(bytes32 => bool)        public usedTokenizeNonces;
    mapping(bytes32 => bool)        public usedRedeemNonces;

    // ── Soul Forge Fusion State ──────────────────────────────────────────────
    struct FusionRequest {
        address player;
        uint256 baseTierId;
        bool    useLuckyBone;
        bool    useCollar;
        bool    useDivineInsurance;
        bool    resolved;
        uint256 requestBlock;
        uint256 totalCost;
    }

    uint256 public nextRequestId = 1;
    mapping(uint256 => FusionRequest) public fusionRequests;

    // ── Events ───────────────────────────────────────────────────────────────
    event Committed(address indexed player, bytes32 commitment, uint256 commitBlock);
    event GoldenCommitted(address indexed player, bytes32 commitment, address indexed referrer, uint256 commitBlock);
    event BulkCommitted(address indexed player, bytes32 commitment, address indexed referrer, uint256 commitBlock);
    event Revealed(address indexed player, uint256 indexed tokenId, uint256 pity);
    event BulkRevealed(address indexed player, uint256[] tokenIds, uint256 pity);
    event SoulShardMinted(address indexed player, uint256 amount);
    event ShardsRedeemed(address indexed player, uint256 count, uint256[] tiers);
    event DogTokenized(address indexed player, uint256 count, uint256 nonce);
    event ReferralBnbCredited(address indexed referrer, address indexed player, uint256 amount);
    event ReferralBnbClaimed(address indexed referrer, uint256 amount);
    event JackpotFunded(uint256 amountAdded, uint256 totalJackpot);
    event JackpotTriggered(address indexed winner, uint256 indexed tokenId, uint256 jackpotAmount);

    event FusionRequested(
        uint256 indexed requestId,
        address indexed player,
        uint256 indexed baseTierId,
        bool useLuckyBone,
        bool useCollar,
        bool useDivineInsurance,
        uint256 totalCost
    );
    event FusionResolved(
        uint256 indexed requestId,
        address indexed player,
        bool isSuccess,
        uint256 upgradedTier,
        uint256 shardsRewarded
    );

    event PullCostUpdated(uint256 newCost);
    event TokenizeCostUpdated(uint256 single, uint256 bulk3x);
    event TokenizeBnbFeeUpdated(uint256 newFee);
    event TreasuryAddressUpdated(address indexed newTreasury);
    event BackendSignerUpdated(address indexed signer);
    event FusionFeeUpdated(uint256 indexed tier, uint256 newFee);
    event BoosterFeesUpdated(uint256 luckyBoneFee, uint256 collarFee);
    event ForgeInsuranceFeeUpdated(uint256 indexed tier, uint256 fee);

    // ── Errors ───────────────────────────────────────────────────────────────
    error AlreadyPending();
    error NoPendingCommit();
    error TooEarly();
    error CommitExpired();
    error WrongSecret();
    error InvalidSignature();
    error NonceUsed();
    error InvalidCount();
    error ZeroSigner();
    error InsufficientShards(uint256 have, uint256 need);
    error InsufficientBnbFee(uint256 sent, uint256 required);
    error CountExceedsMax();
    error InvalidTier();
    error Unauthorized();
    error InvalidRequestId();
    error RequestAlreadyResolved();
    error NoReferralBnbToClaim();
    error TransferFailed();

    constructor(address _farmToken, address _nftContract, address _owner, address _backendSigner)
        Ownable(_owner)
    {
        if (_backendSigner == address(0)) revert ZeroSigner();
        farmToken     = IERC20(_farmToken);
        nftContract   = IMintableNFT(_nftContract);
        backendSigner = _backendSigner;

        // Base fusion fees ($FARM)
        fusionFees[1] = 20 * 10 ** 18;   // T1 -> T2: 20 FARM
        fusionFees[2] = 80 * 10 ** 18;   // T2 -> T3: 80 FARM
        fusionFees[3] = 250 * 10 ** 18;  // T3 -> T4: 250 FARM
        fusionFees[4] = 800 * 10 ** 18;  // T4 -> T5: 800 FARM

        // Divine Insurance fees (BNB) according to Architecture Review
        forgeInsuranceFees[1] = 0.002 ether; // T1 -> T2
        forgeInsuranceFees[2] = 0.004 ether; // T2 -> T3
        forgeInsuranceFees[3] = 0.008 ether; // T3 -> T4
        forgeInsuranceFees[4] = 0.015 ether; // T4 -> T5
    }

    // ── Internal BNB Revenue Router ──────────────────────────────────────────

    function _routeBnbRevenue(uint256 totalBnb, address referrer) internal {
        if (totalBnb == 0) return;

        uint256 vaultShare   = (totalBnb * REVENUE_VAULT_BPS) / BPS_DENOMINATOR;
        uint256 refShare     = (totalBnb * REVENUE_REF_BPS) / BPS_DENOMINATOR;
        uint256 jackpotShare = totalBnb - vaultShare - refShare;

        // Pull-Payment Referral: credit balance mapping (Pull Payment as directed by Architecture Review)
        if (referrer != address(0) && referrer != msg.sender && refShare > 0) {
            referralBalances[referrer] += refShare;
            emit ReferralBnbCredited(referrer, msg.sender, refShare);
        } else {
            // If no referrer, reroute refShare to Treasury Vault
            vaultShare += refShare;
        }

        // 75% (or 90%) sent directly to TreasuryBuyBack Vault
        if (treasuryAddress != address(0) && vaultShare > 0) {
            (bool ok, ) = treasuryAddress.call{value: vaultShare}("");
            require(ok, "BNB transfer to Treasury Vault failed");
        }

        // 10% kept in contract for Community Jackpot / Red Packet
        jackpotPoolBnb += jackpotShare;
        emit JackpotFunded(jackpotShare, jackpotPoolBnb);
    }

    // ── Pull-Payment Referral Claim ──────────────────────────────────────────

    function claimReferralBnb() external nonReentrant {
        uint256 bal = referralBalances[msg.sender];
        if (bal == 0) revert NoReferralBnbToClaim();

        referralBalances[msg.sender] = 0;

        (bool ok, ) = msg.sender.call{value: bal}("");
        if (!ok) revert TransferFailed();

        emit ReferralBnbClaimed(msg.sender, bal);
    }

    // ── Standard Single Pull Gacha (Commit-Reveal) ───────────────────────────

    function commit(bytes32 commitment) external nonReentrant whenNotPaused {
        _commitPull(commitment, false, false, address(0), pullCost);
        emit Committed(msg.sender, commitment, block.number);
    }

    // ── Golden Lucky Pull (Commit-Reveal) ────────────────────────────────────

    function commitGolden(bytes32 commitment, address referrer)
        external
        payable
        nonReentrant
        whenNotPaused
    {
        if (msg.value < goldenPullBnbFee) revert InsufficientBnbFee(msg.value, goldenPullBnbFee);
        _commitPull(commitment, true, false, referrer, pullCost);
        _routeBnbRevenue(msg.value, referrer);
        emit GoldenCommitted(msg.sender, commitment, referrer, block.number);
    }

    // ── Mega Bulk Pull x10 (Commit-Reveal) ───────────────────────────────────

    function commitBulk10(bytes32 commitment, address referrer)
        external
        payable
        nonReentrant
        whenNotPaused
    {
        if (msg.value < bulk10PullBnbFee) revert InsufficientBnbFee(msg.value, bulk10PullBnbFee);
        _commitPull(commitment, true, true, referrer, bulk10FarmCost);
        _routeBnbRevenue(msg.value, referrer);
        emit BulkCommitted(msg.sender, commitment, referrer, block.number);
    }

    function _commitPull(
        bytes32 commitment,
        bool isGolden,
        bool isBulk10,
        address referrer,
        uint256 farmCost
    ) internal {
        bool hasActivePending = pendingPulls[msg.sender].commitBlock != 0 &&
            !pendingPulls[msg.sender].revealed &&
            (block.number - pendingPulls[msg.sender].commitBlock <= REVEAL_WINDOW);
        if (hasActivePending) revert AlreadyPending();

        pendingPulls[msg.sender] = PendingPull({
            commitment:  commitment,
            commitBlock: block.number,
            revealed:    false,
            isGolden:    isGolden,
            isBulk10:    isBulk10,
            referrer:    referrer
        });

        farmToken.safeTransferFrom(msg.sender, address(this), farmCost);
        _burn(farmCost);
    }

    // ── Reveal Logic ─────────────────────────────────────────────────────────

    function reveal(bytes32 secret) external nonReentrant whenNotPaused {
        PendingPull storage pull = pendingPulls[msg.sender];
        if (pull.commitBlock == 0 || pull.revealed) revert NoPendingCommit();

        uint256 elapsed = block.number - pull.commitBlock;
        if (elapsed < MIN_REVEAL_BLOCKS) revert TooEarly();
        if (elapsed > REVEAL_WINDOW)     revert CommitExpired();

        bytes32 expected = keccak256(abi.encodePacked(secret, msg.sender));
        if (expected != pull.commitment) revert WrongSecret();

        pull.revealed = true;

        if (pull.isBulk10) {
            _executeBulk10Reveal(secret, pull.commitBlock);
        } else {
            _executeSingleReveal(secret, pull.commitBlock, pull.isGolden);
        }
    }

    function _executeSingleReveal(bytes32 secret, uint256 commitBlock, bool isGolden) internal {
        bytes32 rand = keccak256(abi.encodePacked(
            blockhash(commitBlock + 1),
            secret,
            msg.sender
        ));

        uint256 tokenId = isGolden
            ? _resolveGoldenTokenId(uint256(rand), msg.sender)
            : _resolveTokenId(uint256(rand), msg.sender);

        if (tokenId < 3) {
            pityCounter[msg.sender] += isGolden ? 2 : 1;
        } else {
            pityCounter[msg.sender] = 0;
        }

        emit Revealed(msg.sender, tokenId, pityCounter[msg.sender]);
        nftContract.mint(msg.sender, tokenId, 1, "");

        // Pity drops
        if (tokenId < 3) {
            uint256 shards = isGolden ? 3 : 1;
            nftContract.mint(msg.sender, SOUL_SHARD_ID, shards, "");
            emit SoulShardMinted(msg.sender, shards);
        } else if (tokenId >= 5 && isGolden && jackpotPoolBnb > 0) {
            // Trigger jackpot broadcast for Tier 5 & 6
            emit JackpotTriggered(msg.sender, tokenId, jackpotPoolBnb);
        }
    }

    function _executeBulk10Reveal(bytes32 secret, uint256 commitBlock) internal {
        uint256[] memory tokenIds = new uint256[](10);
        bool hasTier3Plus = false;
        bytes32 baseHash = blockhash(commitBlock + 1);

        for (uint256 i = 0; i < 10; i++) {
            bytes32 rand = keccak256(abi.encodePacked(baseHash, secret, msg.sender, i));
            uint256 tid = _resolveGoldenTokenId(uint256(rand), msg.sender);
            if (tid >= 3) hasTier3Plus = true;
            tokenIds[i] = tid;
        }

        // Guaranteed Tier 3+ rule for Bulk x10: if none rolled Tier 3+, force 10th dog to Tier 3 Husky
        if (!hasTier3Plus) {
            tokenIds[9] = 3;
            hasTier3Plus = true;
        }

        // Mint all 10 dogs & award pity
        uint256 shardsToAward = 0;
        bool wonJackpot = false;
        uint256 highestTier = 0;

        for (uint256 i = 0; i < 10; i++) {
            uint256 tid = tokenIds[i];
            nftContract.mint(msg.sender, tid, 1, "");
            if (tid < 3) {
                shardsToAward += 3; // Golden shard consolation
            } else if (tid >= 5) {
                wonJackpot = true;
                if (tid > highestTier) highestTier = tid;
            }
        }

        pityCounter[msg.sender] = 0; // Reset pity after guaranteed Tier 3+

        if (shardsToAward > 0) {
            nftContract.mint(msg.sender, SOUL_SHARD_ID, shardsToAward, "");
            emit SoulShardMinted(msg.sender, shardsToAward);
        }

        if (wonJackpot && jackpotPoolBnb > 0) {
            emit JackpotTriggered(msg.sender, highestTier, jackpotPoolBnb);
        }

        emit BulkRevealed(msg.sender, tokenIds, pityCounter[msg.sender]);
    }

    // ── Soul Forge (Dog Fusion) ──────────────────────────────────────────────

    function requestFusion(
        uint256 baseTierId,
        bool useLuckyBone,
        bool useCollar
    ) external payable nonReentrant whenNotPaused returns (uint256 requestId) {
        return _requestFusion(baseTierId, useLuckyBone, useCollar, false, address(0));
    }

    function requestFusion(
        uint256 baseTierId,
        bool useLuckyBone,
        bool useCollar,
        bool useDivineInsurance,
        address referrer
    ) external payable nonReentrant whenNotPaused returns (uint256 requestId) {
        return _requestFusion(baseTierId, useLuckyBone, useCollar, useDivineInsurance, referrer);
    }

    function _requestFusion(
        uint256 baseTierId,
        bool useLuckyBone,
        bool useCollar,
        bool useDivineInsurance,
        address referrer
    ) internal returns (uint256 requestId) {
        if (baseTierId < 1 || baseTierId > 4) revert InvalidTier();

        if (useDivineInsurance) {
            uint256 reqBnb = forgeInsuranceFees[baseTierId];
            if (msg.value < reqBnb) revert InsufficientBnbFee(msg.value, reqBnb);
            _routeBnbRevenue(msg.value, referrer);
        }

        uint256 cost = fusionFees[baseTierId];
        if (useLuckyBone) cost += luckyBoneFee;
        if (useCollar)    cost += collarFee;

        // Pull total FARM cost from player
        farmToken.safeTransferFrom(msg.sender, address(this), cost);

        if (useDivineInsurance) {
            // Burn 50% immediately, retain 50% in contract in case of failure refund
            uint256 burnNow = cost / 2;
            _burn(burnNow);
        } else {
            // Normal: burn 100%
            _burn(cost);
        }

        // Lock 3 base dog NFTs into this contract
        IERC1155(address(nftContract)).safeTransferFrom(
            msg.sender,
            address(this),
            baseTierId,
            3,
            ""
        );

        requestId = nextRequestId++;
        fusionRequests[requestId] = FusionRequest({
            player: msg.sender,
            baseTierId: baseTierId,
            useLuckyBone: useLuckyBone,
            useCollar: useCollar,
            useDivineInsurance: useDivineInsurance,
            resolved: false,
            requestBlock: block.number,
            totalCost: cost
        });

        emit FusionRequested(requestId, msg.sender, baseTierId, useLuckyBone, useCollar, useDivineInsurance, cost);
    }

    function resolveFusion(uint256 requestId, bool isSuccess, uint256 shardsToReward)
        external
        nonReentrant
        whenNotPaused
    {
        if (msg.sender != backendSigner && msg.sender != owner()) revert Unauthorized();

        FusionRequest storage req = fusionRequests[requestId];
        if (req.requestBlock == 0) revert InvalidRequestId();
        if (req.resolved) revert RequestAlreadyResolved();

        req.resolved = true;

        if (isSuccess) {
            // Burn remaining 50% FARM if Divine Insurance was active
            if (req.useDivineInsurance) {
                uint256 remainingCost = req.totalCost - (req.totalCost / 2);
                _burn(remainingCost);
            }

            // Burn 3 base dogs
            IERC1155(address(nftContract)).safeTransferFrom(
                address(this),
                DEAD_ADDRESS,
                req.baseTierId,
                3,
                ""
            );

            // Mint 1 upgraded dog
            nftContract.mint(req.player, req.baseTierId + 1, 1, "");

            emit FusionResolved(requestId, req.player, true, req.baseTierId + 1, 0);
        } else {
            if (req.useDivineInsurance) {
                // Divine Insurance: Preserves all 3 dogs + Refund 50% FARM + 30 Shards
                IERC1155(address(nftContract)).safeTransferFrom(
                    address(this),
                    req.player,
                    req.baseTierId,
                    3,
                    ""
                );

                // Refund 50% FARM
                uint256 refundAmount = req.totalCost - (req.totalCost / 2);
                farmToken.safeTransfer(req.player, refundAmount);

                // Compensate 30 Soul Shards
                uint256 totalShards = shardsToReward >= 30 ? shardsToReward : 30;
                nftContract.mint(req.player, SOUL_SHARD_ID, totalShards, "");
                emit SoulShardMinted(req.player, totalShards);

                emit FusionResolved(requestId, req.player, false, 0, totalShards);
            } else if (req.useCollar) {
                // Protection collar preserves 3 dogs
                IERC1155(address(nftContract)).safeTransferFrom(
                    address(this),
                    req.player,
                    req.baseTierId,
                    3,
                    ""
                );
                if (shardsToReward > 0) {
                    nftContract.mint(req.player, SOUL_SHARD_ID, shardsToReward, "");
                    emit SoulShardMinted(req.player, shardsToReward);
                }
                emit FusionResolved(requestId, req.player, false, 0, shardsToReward);
            } else {
                // Without collar: 1 returned, 2 burned
                IERC1155(address(nftContract)).safeTransferFrom(
                    address(this),
                    req.player,
                    req.baseTierId,
                    1,
                    ""
                );
                IERC1155(address(nftContract)).safeTransferFrom(
                    address(this),
                    DEAD_ADDRESS,
                    req.baseTierId,
                    2,
                    ""
                );
                if (shardsToReward > 0) {
                    nftContract.mint(req.player, SOUL_SHARD_ID, shardsToReward, "");
                    emit SoulShardMinted(req.player, shardsToReward);
                }
                emit FusionResolved(requestId, req.player, false, 0, shardsToReward);
            }
        }
    }

    // ── Soul Shard Redemption (Pity Exchange) ────────────────────────────────

    function redeemShards() external nonReentrant whenNotPaused {
        _executeRedeem(msg.sender, 1);
    }

    function redeemShards(uint256 count) external nonReentrant whenNotPaused {
        if (count == 0 || count > MAX_REDEEM_PER_TX) revert InvalidCount();
        _executeRedeem(msg.sender, count);
    }

    function redeemShards(uint256 count, uint256 nonce, bytes calldata sig)
        external
        nonReentrant
        whenNotPaused
    {
        if (count == 0 || count > MAX_REDEEM_PER_TX) revert InvalidCount();

        bytes32 nonceKey = keccak256(abi.encodePacked("redeem", msg.sender, nonce));
        if (usedRedeemNonces[nonceKey]) revert NonceUsed();

        bytes32 hash = keccak256(abi.encodePacked("redeem", msg.sender, count, nonce));
        address recovered = MessageHashUtils.toEthSignedMessageHash(hash).recover(sig);
        if (recovered != backendSigner) revert InvalidSignature();

        usedRedeemNonces[nonceKey] = true;
        _executeRedeem(msg.sender, count);
    }

    function _executeRedeem(address player, uint256 count) internal {
        uint256 totalShards = count * SHARDS_PER_REDEEM;
        ISoulShardNFT(address(nftContract)).burnShard(player, totalShards);

        uint256[] memory tiers = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            uint256 rand = uint256(keccak256(abi.encodePacked(
                block.prevrandao, blockhash(block.number - 1), player, i
            ))) % 10;
            uint256 tier = rand <= 5 ? 3 : (rand <= 8 ? 4 : 5);
            tiers[i] = tier;
            nftContract.mint(player, tier, 1, "");
        }

        emit ShardsRedeemed(player, count, tiers);
    }

    // ── Tokenize Shop Dog → On-chain NFT ─────────────────────────────────────

    function tokenizeDog(uint256 count, uint256 nonce, bytes calldata sig)
        external
        payable
        nonReentrant
        whenNotPaused
    {
        if (count != 1 && count != 3) revert InvalidCount();

        uint256 requiredBnb = count == 3 ? tokenizeBnbFee3x : tokenizeBnbFee;
        if (msg.value < requiredBnb) revert InsufficientBnbFee(msg.value, requiredBnb);

        bytes32 nonceKey = keccak256(abi.encodePacked(msg.sender, nonce));
        if (usedTokenizeNonces[nonceKey]) revert NonceUsed();

        bytes32 hash = keccak256(abi.encodePacked(msg.sender, count, nonce));
        address recovered = MessageHashUtils.toEthSignedMessageHash(hash).recover(sig);
        if (recovered != backendSigner) revert InvalidSignature();

        usedTokenizeNonces[nonceKey] = true;

        uint256 cost = count == 3 ? tokenizeCost3x : tokenizeCost;
        farmToken.safeTransferFrom(msg.sender, address(this), cost);
        _burn(cost);

        // Forward BNB fee directly to TreasuryBuyBack vault
        if (treasuryAddress != address(0) && msg.value > 0) {
            (bool success, ) = treasuryAddress.call{value: msg.value}("");
            require(success, "BNB transfer to Treasury failed");
        }

        nftContract.mint(msg.sender, 1, count, "");

        emit DogTokenized(msg.sender, count, nonce);
    }

    // ── View Helpers ─────────────────────────────────────────────────────────

    function getFusionRequest(uint256 requestId) external view returns (FusionRequest memory) {
        return fusionRequests[requestId];
    }

    function getFusionFee(uint256 tierId) external view returns (uint256) {
        return fusionFees[tierId];
    }

    function _resolveTokenId(uint256 rand, address player) internal view returns (uint256) {
        if (pityCounter[player] >= 10) return 3;

        uint256 roll = rand % 10_000;
        for (uint256 i = 0; i < 6; i++) {
            if (roll < weights[i]) return i + 1;
        }
        return 6;
    }

    function _resolveGoldenTokenId(uint256 rand, address player) internal view returns (uint256) {
        if (pityCounter[player] >= 10) return 3;

        uint256 roll = rand % 10_000;
        for (uint256 i = 0; i < 6; i++) {
            if (roll < goldenWeights[i]) return i + 1;
        }
        return 6;
    }

    function _burn(uint256 amount) internal {
        IBurnable(address(farmToken)).burn(amount);
    }

    // ── Admin ────────────────────────────────────────────────────────────────

    function setFusionFee(uint256 tier, uint256 fee) external onlyOwner {
        fusionFees[tier] = fee;
        emit FusionFeeUpdated(tier, fee);
    }

    function setForgeInsuranceFee(uint256 tier, uint256 fee) external onlyOwner {
        forgeInsuranceFees[tier] = fee;
        emit ForgeInsuranceFeeUpdated(tier, fee);
    }

    function setBoosterFees(uint256 _luckyBoneFee, uint256 _collarFee) external onlyOwner {
        luckyBoneFee = _luckyBoneFee;
        collarFee    = _collarFee;
        emit BoosterFeesUpdated(_luckyBoneFee, _collarFee);
    }

    function setGoldenPullBnbFee(uint256 _fee) external onlyOwner { goldenPullBnbFee = _fee; }
    function setBulk10PullBnbFee(uint256 _fee) external onlyOwner { bulk10PullBnbFee = _fee; }
    function setBulk10FarmCost(uint256 _cost)  external onlyOwner { bulk10FarmCost = _cost; }

    function setPullCost(uint256 _cost) external onlyOwner {
        pullCost = _cost;
        emit PullCostUpdated(_cost);
    }

    function setTokenizeCost(uint256 _single, uint256 _bulk3x) external onlyOwner {
        tokenizeCost   = _single;
        tokenizeCost3x = _bulk3x;
        emit TokenizeCostUpdated(_single, _bulk3x);
    }

    function setBackendSigner(address _signer) external onlyOwner {
        if (_signer == address(0)) revert ZeroSigner();
        backendSigner = _signer;
        emit BackendSignerUpdated(_signer);
    }

    function setTreasuryAddress(address _treasury) external onlyOwner {
        treasuryAddress = _treasury;
        emit TreasuryAddressUpdated(_treasury);
    }

    function setTokenizeBnbFee(uint256 _fee) external onlyOwner {
        tokenizeBnbFee = _fee;
        emit TokenizeBnbFeeUpdated(_fee);
    }

    function setWeights(uint16[6] calldata _w) external onlyOwner { weights = _w; }
    function setGoldenWeights(uint16[6] calldata _w) external onlyOwner { goldenWeights = _w; }
    function setNftContract(address _nft) external onlyOwner { nftContract = IMintableNFT(_nft); }
    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}

// ── Minimal interfaces ────────────────────────────────────────────────────────

interface IMintableNFT {
    function mint(address to, uint256 id, uint256 amount, bytes calldata data) external;
}

interface ISoulShardNFT {
    function burnShard(address from, uint256 amount) external;
}

interface IBurnable {
    function burn(uint256 amount) external;
}
