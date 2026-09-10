import {
  Injectable, BadRequestException, ForbiddenException,
  InternalServerErrorException, Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ethers } from 'ethers';
import { Cron } from '@nestjs/schedule';
import { User } from '../user/entities/user.entity';
import { NftGuardDog } from '../farm/entities/nft-guard-dog.entity';

const ERC1155_ABI = [
  'function balanceOf(address account, uint256 id) view returns (uint256)',
  'function balanceOfBatch(address[] accounts, uint256[] ids) view returns (uint256[])',
];

const DOG_DEFENSE_MAP: Record<number, { dogType: string; defensePower: number }> = {
  1: { dogType: 'Chihuahua',  defensePower: 10 },
  2: { dogType: 'Corgi',      defensePower: 20 },
  3: { dogType: 'Husky',      defensePower: 35 },
  4: { dogType: 'Rottweiler', defensePower: 50 },
  5: { dogType: 'Doberman',   defensePower: 65 },
  6: { dogType: 'Pitbull',    defensePower: 80 },
};

const TOKEN_IDS = [1, 2, 3, 4, 5, 6];

export type NftSyncResult = {
  synced: number;
  totalNftDefense: number;
  dogs: Array<{ tokenId: number; dogType: string; defensePower: number; balance: number }>;
};

@Injectable()
export class Web3Service {
  private readonly logger = new Logger(Web3Service.name);
  private adminWallet: ethers.Wallet | null = null;
  private provider: ethers.FallbackProvider | null = null;

  constructor(
    private readonly config: ConfigService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {
    const privateKey = this.config.get<string>('web3.signerPrivateKey');
    if (privateKey && privateKey.length > 0 && privateKey !== '') {
      try {
        this.provider = this._buildFallbackProvider();
        this.adminWallet = new ethers.Wallet(privateKey).connect(this.provider);
        this.logger.log(`Signer wallet: ${this.adminWallet.address}`);
      } catch {
        this.logger.warn('Failed to initialize admin wallet - Web3 features disabled');
      }
    }
  }

  /** #44: Ethers.js v6 FallbackProvider with ordered RPC endpoints. */
  private _buildFallbackProvider(): ethers.FallbackProvider {
    const primary   = this.config.get<string>('web3.bscRpcUrl') ?? 'https://bsc-dataseed1.binance.org/';
    const secondary = 'https://bsc-dataseed2.binance.org/';
    const tertiary  = 'https://bsc-dataseed3.binance.org/';

    const networks = [primary, secondary, tertiary].map((url, i) => ({
      provider: new ethers.JsonRpcProvider(url),
      priority: i + 1,
      stallTimeout: 2000,
      weight: 1,
    }));
    return new ethers.FallbackProvider(networks, undefined, { quorum: 1 });
  }

  async generateClaimSignature(user: User, amountToClaim: number) {
    const minTrustScore = (this.config.get<number>('game.minTrustScore')) ?? 30;

    if (user.trustScore < minTrustScore) {
      throw new ForbiddenException(
        `Account flagged as bot. Trust score ${user.trustScore} < ${minTrustScore}`,
      );
    }

    if (!user.walletAddress) {
      throw new BadRequestException('No wallet address linked. Please link your BSC wallet first.');
    }

    if (Number(user.goldBalance) < amountToClaim) {
      throw new BadRequestException(
        `Insufficient GOLD. Have ${user.goldBalance}, need ${amountToClaim}`,
      );
    }

    if (!this.adminWallet) {
      throw new InternalServerErrorException('Signing service not configured');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const lockedUser = await queryRunner.manager
        .createQueryBuilder(User, 'u')
        .where('u.id = :id', { id: user.id })
        .setLock('pessimistic_write')
        .getOne();

      if (!lockedUser) throw new BadRequestException('User not found');
      if (Number(lockedUser.goldBalance) < amountToClaim) {
        throw new BadRequestException('Insufficient GOLD (concurrent request detected)');
      }

      const currentNonce = lockedUser.nonce;

      await queryRunner.manager
        .createQueryBuilder()
        .update(User)
        .set({
          goldBalance: () => `"gold_balance" - ${amountToClaim}`,
          nonce: () => '"nonce" + 1',
        })
        .where('id = :id', { id: user.id })
        .execute();

      const amountWei = ethers.parseUnits(amountToClaim.toString(), 18);
      const messageHash = ethers.solidityPackedKeccak256(
        ['address', 'uint256', 'uint256'],
        [user.walletAddress, amountWei, currentNonce],
      );
      const signature = await this.adminWallet.signMessage(ethers.getBytes(messageHash));

      await queryRunner.commitTransaction();

      this.logger.log(`Claim signature: user=${user.id} amount=${amountToClaim} nonce=${currentNonce}`);

      return {
        userAddress: user.walletAddress,
        amountWei: amountWei.toString(),
        nonce: currentNonce,
        signature,
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async syncGuardDogs(userId: string, walletAddress: string): Promise<NftSyncResult> {
    if (!this.provider) {
      this.logger.warn('Web3 provider not configured - skipping NFT sync');
      return { synced: 0, totalNftDefense: 0, dogs: [] };
    }

    const nftContractAddress = this.config.get<string>('web3.nftContractAddress') ?? '';
    if (!nftContractAddress || nftContractAddress === '0x0000000000000000000000000000000000000000') {
      this.logger.warn('NFT contract address not configured');
      return { synced: 0, totalNftDefense: 0, dogs: [] };
    }

    try {
      const contract = new ethers.Contract(nftContractAddress, ERC1155_ABI, this.provider);

      // Single RPC call for all 6 breeds at once
      const accounts = TOKEN_IDS.map(() => walletAddress);
      const balances: bigint[] = await contract.balanceOfBatch(accounts, TOKEN_IDS);

      const ownedDogs = TOKEN_IDS
        .map((tokenId, idx) => ({ tokenId, balance: Number(balances[idx]) }))
        .filter(({ balance }) => balance > 0)
        .map(({ tokenId, balance }) => ({
          tokenId,
          balance,
          dogType: DOG_DEFENSE_MAP[tokenId].dogType,
          defensePower: DOG_DEFENSE_MAP[tokenId].defensePower,
        }));

      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        // Only deactivate NFT-sourced dogs — shop dogs (source='shop') are NOT touched
        await queryRunner.manager.update(
          NftGuardDog,
          { ownerId: userId, source: 'nft' },
          { isActive: false },
        );

        for (const dog of ownedDogs) {
          const existing = await queryRunner.manager.findOne(NftGuardDog, {
            where: { ownerId: userId, tokenId: dog.tokenId, source: 'nft' },
          });

          if (existing) {
            await queryRunner.manager.update(NftGuardDog, { id: existing.id }, {
              isActive: true,
              defensePower: dog.defensePower,
              dogType: dog.dogType,
            });
          } else {
            await queryRunner.manager.insert(NftGuardDog, {
              ownerId: userId,
              tokenId: dog.tokenId,
              dogType: dog.dogType,
              defensePower: dog.defensePower,
              isActive: true,
              source: 'nft',
            });
          }
        }

        await queryRunner.commitTransaction();

        const totalNftDefense = ownedDogs.reduce((sum, d) => sum + d.defensePower, 0);
        this.logger.log(`NFT sync: user=${userId} owned=${ownedDogs.length} totalDefense=${totalNftDefense}`);

        return { synced: ownedDogs.length, totalNftDefense, dogs: ownedDogs };
      } catch (err) {
        await queryRunner.rollbackTransaction();
        throw err;
      } finally {
        await queryRunner.release();
      }
    } catch (err) {
      this.logger.error(`NFT sync failed for ${walletAddress}: ${(err as Error).message}`);
      return { synced: 0, totalNftDefense: 0, dogs: [] };
    }
  }

  async getNftStatus(userId: string) {
    const dogs = await this.dataSource.manager.find(NftGuardDog, {
      where: { ownerId: userId, source: 'nft', isActive: true },
      order: { defensePower: 'DESC' },
    });

    const ownedBreeds = dogs.map((d) => ({
      tokenId: d.tokenId,
      dogType: d.dogType,
      defensePower: d.defensePower,
    }));

    return {
      ownedBreeds,
      totalNftDefense: dogs.reduce((sum, d) => sum + d.defensePower, 0),
      breedCount: dogs.length,
    };
  }

  // ── Exchange Rate Engine (#18) ──────────────────────────────────
  private cachedRate: number = 1.0;
  private rateCachedAt: number = 0;
  private readonly RATE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  async getExchangeRate(): Promise<{
    goldPerFarm: number;
    totalGoldCirculating: number;
    lastUpdated: string;
    note: string;
  }> {
    if (Date.now() - this.rateCachedAt < this.RATE_TTL_MS) {
      return {
        goldPerFarm: this.cachedRate,
        totalGoldCirculating: 0,
        lastUpdated: new Date(this.rateCachedAt).toISOString(),
        note: 'cached',
      };
    }
    await this.syncExchangeRate();
    return {
      goldPerFarm: this.cachedRate,
      totalGoldCirculating: 0,
      lastUpdated: new Date(this.rateCachedAt).toISOString(),
      note: this.cachedRate === 1.0 ? 'fallback 1:1 (no treasury data)' : 'computed',
    };
  }

  @Cron('*/5 * * * *')
  async syncExchangeRate(): Promise<void> {
    try {
      const [{ total }] = await this.dataSource.manager.query(
        `SELECT COALESCE(SUM(gold_balance), 0) AS total FROM users`,
      ) as [{ total: string }];

      const goldCirc = Number(total);

      let farmInTreasury = 0;
      if (this.provider && this.adminWallet) {
        const farmTokenAddress = this.config.get<string>('web3.farmTokenAddress') ?? '';
        if (farmTokenAddress && farmTokenAddress.length > 10) {
          const erc20ABI = ['function balanceOf(address) view returns (uint256)'];
          const token = new ethers.Contract(farmTokenAddress, erc20ABI, this.provider);
          const bal = await token.balanceOf(this.adminWallet.address) as bigint;
          farmInTreasury = Number(ethers.formatEther(bal));
        }
      }

      this.cachedRate = farmInTreasury > 0 && goldCirc > 0
        ? Number((goldCirc / farmInTreasury).toFixed(4))
        : 1.0;
      this.rateCachedAt = Date.now();
    } catch {
      this.cachedRate = 1.0;
      this.rateCachedAt = Date.now();
    }
  }

  // Background sync: every 30 minutes, re-sync the 50 most recently active wallet users
  @Cron('0 */30 * * * *')
  async scheduledNftSync(): Promise<void> {
    if (!this.provider) return;

    const nftContractAddress = this.config.get<string>('web3.nftContractAddress') ?? '';
    if (!nftContractAddress || nftContractAddress === '0x0000000000000000000000000000000000000000') return;

    const users = await this.dataSource.manager
      .createQueryBuilder(User, 'u')
      .where('u.wallet_address IS NOT NULL')
      .orderBy('u.updated_at', 'DESC')
      .limit(50)
      .getMany();

    if (users.length === 0) return;
    this.logger.log(`Scheduled NFT sync: processing ${users.length} users`);

    for (const user of users) {
      if (user.walletAddress) {
        await this.syncGuardDogs(user.id, user.walletAddress);
      }
    }
  }
}
