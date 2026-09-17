# HARDHAT QA TEST LOGS


  BanditDogFusion — gacha commit/reveal, Web2.5 bridge, soul shards
    configuration
      ✔ exposes the documented defaults (851ms)
      ✔ rejects a zero backend signer at construction
    commit / reveal gacha
      ✔ burns the pull cost on commit and blocks a second pending commit
      ✔ rejects reveal before MIN_REVEAL_BLOCKS
      ✔ rejects a wrong secret once the delay has elapsed
      ✔ mints exactly one dog on a valid reveal
      ✔ rejects reveal without a pending commit
      ✔ rejects reveal after the 256-block window
    tokenizeDog — Web2.5 shop-dog bridge
      ✔ burns the single-dog cost and mints one Chihuahua
      ✔ charges the bulk 3x price and mints three dogs
      ✔ rejects counts other than 1 or 3
      ✔ rejects a replayed nonce
      ✔ rejects a signature from anyone but the backend signer
      ✔ binds the signature to the caller
    redeemShards — 100 shards for a guaranteed tier 3-5 dog
      ✔ burns 100 shards and mints exactly one tier 3-5 dog
      ✔ rejects count 0 and counts above MAX_REDEEM_PER_TX
      ✔ reverts when the player does not hold enough shards
      ✔ rejects a replayed redemption nonce
    admin
      ✔ restricts privileged setters to the owner
      ✔ rejects a zero backend signer on rotation
      ✔ freezes commit, tokenize and redeem while paused

  BanditMarket — EIP-712 orders & marketplace safety
    ✔ khớp mã hash on-chain với EIP-712 off-chain (70ms)
    ✔ khớp lệnh mua NFT: chuyển NFT, trừ 5% phí treasury, đốt nonce

  FarmToken — holdings-based tiered tax
    getTierOf — dựa trên số dư ví, không phải pool
      ✔ ánh xạ chính xác số dư ví vào các tier 1, 2, 3
    chiều Mua (pair → wallet)
      ✔ thu 3% từ buyer tier-1 và chuyển vào treasury pool
      ✔ tính tier dựa trên số dư TRƯỚC giao dịch: whale chịu thuế thấp hơn minnow
    chiều Bán (wallet → pair)
      ✔ thu 5% từ seller tier-1
    bảo mật và ngoại lệ
      ✔ revert giao dịch chịu thuế khi treasury pool chưa được thiết lập
      ✔ chặn hoàn toàn mọi chuyển token khi bị pause (Kill Switch)

  FarmToken
    deployment
      ✔ has correct name and symbol
      ✔ mints full supply to deployer
      ✔ sets MAX_SUPPLY constant correctly
      ✔ owner is deployer
    transfers
      ✔ allows normal transfer
      ✔ reverts transfer with insufficient balance
    burn
      ✔ allows token holder to burn
      ✔ allows burnFrom with allowance
    pause
      ✔ owner can pause and unpause
      ✔ non-owner cannot pause
      ✔ transfer reverts when paused
      ✔ transfer works again after unpause
    permit
      ✔ supports DOMAIN_SEPARATOR
      ✔ allows gasless approval via permit
    tiered tax (holdings-based)
      ✔ exposes the documented thresholds and rates
      ✔ maps wallet balances to tiers at the exact boundaries
      ✔ taxes a tier-1 buy at 3% and routes it to the treasury pool
      ✔ taxes a tier-3 buy at 1% while a fresh wallet pays 3% (41ms)
      ✔ taxes a tier-1 sell at 5% (45ms)
      ✔ taxes a tier-3 sell at only 1.5%
      ✔ never taxes wallet→wallet transfers or excluded accounts
      ✔ applies no tax at all while the pair is unset
      ✔ reverts a taxable swap when the treasury pool is unset
      ✔ freezes every transfer while paused (kill switch)
      ✔ restricts every parameter setter to the owner (43ms)
      ✔ caps every tax rate at 5% and requires tier2 < tier3

  FarmTokenClaim — off-chain GOLD to on-chain FARM gate
    ✔ cho phép claim hợp lệ, lưu nonce và phát sự kiện TokensClaimed (39ms)
    ✔ chặn tấn công Replay Attack với cùng một nonce
    ✔ vô hiệu hóa chữ ký cũ ngay lập tức khi rotate signer mới

  GuardDogNFT
    deployment
      ✔ has 6 breeds
      ✔ breed 1 (Chihuahua) has correct stats
      ✔ breed 6 (Pitbull) has correct stats
      ✔ defaults burnOnPurchase to true
    buyDog
      ✔ mints token to buyer
      ✔ emits DogPurchased event
      ✔ burns FARM on purchase (burnOnPurchase=true)
      ✔ sends FARM to treasury when burnOnPurchase=false
      ✔ deducts correct FARM from buyer
      ✔ reverts on invalid tokenId = 0
      ✔ reverts on invalid tokenId = 7
      ✔ reverts on zero amount
      ✔ reverts when max supply exceeded
      ✔ tracks total supply via ERC1155Supply
      ✔ remainingSupply decreases after purchase
      ✔ reverts when paused
    totalDefensePower
      ✔ returns 0 for address with no dogs
      ✔ returns correct power for single dog
      ✔ stacks power from multiple breed types
      ✔ stacks power from multiples of same breed
      ✔ caps total defense power at 80
    URI
      ✔ returns correct URI for tokenId 1
      ✔ returns correct URI for tokenId 6
      ✔ owner can update base URI
    admin
      ✔ owner can update price
      ✔ non-owner cannot update price
      ✔ owner can set treasury
      ✔ setTreasury reverts on zero address
      ✔ owner can mintTo for airdrops
      ✔ mintTo reverts over maxSupply
      ✔ owner can toggle burn mode
      ✔ owner can pause and unpause
    fusion authorisation
      ✔ reverts mint() for any caller that is not the fusion contract
      ✔ lets the fusion contract mint a capped breed through mint()
      ✔ lets the fusion contract mint unlimited Soul Shards (id 9999)
      ✔ still enforces maxSupply for capped breeds minted via the fusion contract
      ✔ rejects an out-of-range breed id from the fusion contract
      ✔ restricts burnShard() to the fusion contract
      ✔ restricts setFusionContract() to the owner

  LiquidityLocker
    deployment
      ✔ sets owner correctly
      ✔ exposes MIN_LOCK_DURATION = 6 months
      ✔ starts with zero locks
    lockTokens()
      ✔ locks tokens and emits TokensLocked
      ✔ stores correct lock metadata
      ✔ reverts if duration is less than 6 months
      ✔ reverts on zero amount
      ✔ reverts if caller is not owner
      ✔ can create multiple locks
    withdraw()
      ✔ reverts before unlock time
      ✔ reverts when caller is not the beneficiary
      ✔ transfers tokens to beneficiary after unlock time
      ✔ marks lock as withdrawn
      ✔ emits TokensWithdrawn
      ✔ reverts on double-withdraw
    getActiveLocks()
      ✔ returns only non-withdrawn locks
      ✔ returns empty array when all locks are withdrawn
    exact 6-month boundary
      ✔ accepts exactly 6 months
      ✔ rejects one second below 6 months

  BanditMarket — EIP-712 orders & marketplace safety
    ✔ khớp mã hash on-chain với EIP-712 off-chain (56ms)
    ✔ khớp lệnh mua NFT: chuyển NFT, trừ 5% phí treasury, đốt nonce

  FarmToken — holdings-based tiered tax
    getTierOf — dựa trên số dư ví, không phải pool
      ✔ ánh xạ chính xác số dư ví vào các tier 1, 2, 3
    chiều Mua (pair → wallet)
      ✔ thu 3% từ buyer tier-1 và chuyển vào treasury pool
      ✔ tính tier dựa trên số dư TRƯỚC giao dịch: whale chịu thuế thấp hơn minnow
    chiều Bán (wallet → pair)
      ✔ thu 5% từ seller tier-1
    bảo mật và ngoại lệ
      ✔ revert giao dịch chịu thuế khi treasury pool chưa được thiết lập
      ✔ chặn hoàn toàn mọi chuyển token khi bị pause (Kill Switch)

  FarmTokenClaim — off-chain GOLD to on-chain FARM gate
    ✔ cho phép claim hợp lệ, lưu nonce và phát sự kiện TokensClaimed (38ms)
    ✔ chặn tấn công Replay Attack với cùng một nonce
    ✔ vô hiệu hóa chữ ký cũ ngay lập tức khi rotate signer mới


  127 passing (5s)

