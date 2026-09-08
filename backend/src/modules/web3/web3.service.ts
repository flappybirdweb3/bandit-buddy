import {
  Injectable, BadRequestException, ForbiddenException,
  InternalServerErrorException, Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ethers } from 'ethers';
import { User } from '../user/entities/user.entity';
import { NftGuardDog } from '../farm/entities/nft-guard-dog.entity';

const ERC1155_ABI = [
  'function balanceOf(address account, uint256 id) view returns (uint256)',
];

const DOG_DEFENSE_MAP: Record<number, { dogType: string; defensePower: number }> = {
  1: { dogType: 'Chihuahua',  defensePower: 10 },
  2: { dogType: 'Corgi',      defensePower: 20 },
  3: { dogType: 'Husky',      defensePower: 35 },
  4: { dogType: 'Rottweiler', defensePower: 50 },
  5: { dogType: 'Doberman',   defensePower: 65 },
  6: { dogType: 'Pitbull',    defensePower: 80 },
};

@Injectable()
export class Web3Service {
  private readonly logger = new Logger(Web3Service.name);
  private adminWallet: ethers.Wallet | null = null;
  private provider: ethers.JsonRpcProvider | null = null;

  constructor(
    private readonly config: ConfigService,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {
    const privateKey = this.config.get<string>('web3.signerPrivateKey');
    const rpcUrl = this.config.get<string>('web3.bscRpcUrl') ?? 'https://bsc-dataseed.binance.org/';

    if (privateKey && privateKey.length > 0 && privateKey !== '') {
      try {
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
        this.adminWallet = new ethers.Wallet(privateKey, this.provider);
        this.logger.log(`Signer wallet: ${this.adminWallet.address}`);
      } catch {
        this.logger.warn('Failed to initialize admin wallet - Web3 features disabled');
      }
    }
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
      // Lock user row - prevents double-spend on concurrent requests
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

      // Atomically deduct gold and increment nonce
      await queryRunner.manager
        .createQueryBuilder()
        .update(User)
        .set({
          goldBalance: () => `"gold_balance" - ${amountToClaim}`,
          nonce: () => '"nonce" + 1',
        })
        .where('id = :id', { id: user.id })
        .execute();

      // Generate ECDSA signature matching Solidity abi.encodePacked + keccak256
      const amountWei = ethers.parseUnits(amountToClaim.toString(), 18);
      const messageHash = ethers.solidityPackedKeccak256(
        ['address', 'uint256', 'uint256'],
        [user.walletAddress, amountWei, currentNonce],
      );
      // signMessage auto-prepends "\x19Ethereum Signed Message:\n32"
      // matching MessageHashUtils.toEthSignedMessageHash in Solidity
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

  async syncGuardDogs(userId: string, walletAddress: string): Promise<void> {
    if (!this.provider) {
      this.logger.warn('Web3 provider not configured - skipping NFT sync');
      return;
    }

    const nftContractAddress = this.config.get<string>('web3.nftContractAddress') ?? '';
    if (!nftContractAddress || nftContractAddress === '0x0000000000000000000000000000000000000000') {
      this.logger.warn('NFT contract address not configured');
      return;
    }

    try {
      const contract = new ethers.Contract(nftContractAddress, ERC1155_ABI, this.provider);
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        await queryRunner.manager.update(NftGuardDog, { ownerId: userId }, { isActive: false });

        for (const [tokenIdStr, dogInfo] of Object.entries(DOG_DEFENSE_MAP)) {
          const tokenId = parseInt(tokenIdStr, 10);
          const balance: bigint = await contract.balanceOf(walletAddress, tokenId);

          if (balance > 0n) {
            const existing = await queryRunner.manager.findOne(NftGuardDog, {
              where: { ownerId: userId, tokenId },
            });

            if (existing) {
              await queryRunner.manager.update(NftGuardDog, existing.id, { isActive: true });
            } else {
              await queryRunner.manager.insert(NftGuardDog, {
                ownerId: userId,
                tokenId,
                dogType: dogInfo.dogType,
                defensePower: dogInfo.defensePower,
                isActive: true,
              });
            }
          }
        }

        await queryRunner.commitTransaction();
        this.logger.log(`NFT sync complete for ${walletAddress}`);
      } catch (err) {
        await queryRunner.rollbackTransaction();
        throw err;
      } finally {
        await queryRunner.release();
      }
    } catch (err) {
      this.logger.error(`NFT sync failed for ${walletAddress}: ${(err as Error).message}`);
    }
  }
}
