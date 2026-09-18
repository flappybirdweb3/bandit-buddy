import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';

const FARM_VESTING_ABI = [
  'function release(address beneficiary) external',
  'function releasable(address beneficiary) view returns (uint256)',
  'function tgeTimestamp() view returns (uint64)',
] as const;

const FARM_TOKEN_ABI = [
  'function balanceOf(address) view returns (uint256)',
] as const;

const LOW_BALANCE_THRESHOLD = ethers.parseEther('1000000'); // alert below 1M FARM
const MIN_RELEASABLE        = ethers.parseEther('1');       // skip gas if less than 1 FARM

@Injectable()
export class EcosystemReleaseService {
  private readonly logger = new Logger(EcosystemReleaseService.name);

  constructor(private readonly config: ConfigService) {}

  // Runs daily at 08:00 UTC (15:00 VN) — well within the 24h drip window
  @Cron('0 8 * * *')
  async releaseEcosystemTokens(): Promise<void> {
    const rpcUrl        = this.config.getOrThrow<string>('BSC_RPC_URL');
    const privateKey    = this.config.getOrThrow<string>('SIGNER_PRIVATE_KEY');
    const vestingAddr   = this.config.getOrThrow<string>('FARM_VESTING_ADDRESS');
    const farmAddr      = this.config.getOrThrow<string>('FARM_TOKEN_ADDRESS');
    const ecosystemAddr = this.config.getOrThrow<string>('ECOSYSTEM_WALLET');

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const signer   = new ethers.Wallet(privateKey, provider);

    const vesting = new ethers.Contract(vestingAddr, FARM_VESTING_ABI, signer);
    const farm    = new ethers.Contract(farmAddr,    FARM_TOKEN_ABI,   provider);

    try {
      // Check if TGE has passed
      const tge = await vesting.tgeTimestamp() as bigint;
      if (tge === 0n || Date.now() / 1000 < Number(tge)) {
        this.logger.log('TGE not yet reached — skipping ecosystem release.');
        return;
      }

      // How much is releasable right now?
      const releasable: bigint = await vesting.releasable(ecosystemAddr);
      if (releasable < MIN_RELEASABLE) {
        this.logger.log(`Ecosystem releasable: ${ethers.formatEther(releasable)} FARM — below min, skipping.`);
        return;
      }

      this.logger.log(`Releasing ${ethers.formatEther(releasable)} FARM to ecosystem wallet...`);
      const tx = await vesting.release(ecosystemAddr);
      const receipt = await tx.wait();
      this.logger.log(`Release confirmed. TxHash: ${receipt.hash}  gasUsed: ${receipt.gasUsed}`);

      // Post-release balance check
      const balance: bigint = await farm.balanceOf(ecosystemAddr);
      this.logger.log(`Ecosystem wallet balance: ${ethers.formatEther(balance)} FARM`);

      if (balance < LOW_BALANCE_THRESHOLD) {
        this.logger.warn(
          `ALERT: Ecosystem wallet FARM balance (${ethers.formatEther(balance)}) ` +
          `has dropped below the 1M FARM threshold. P2E reward pool may run dry soon.`,
        );
        // TODO: integrate with PushNotification / Slack / PagerDuty alert here
      }
    } catch (err) {
      this.logger.error('Ecosystem release cron failed:', err);
      throw err; // bubble up so NestJS marks the job as failed in logs
    }
  }
}
