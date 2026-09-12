import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  ClaimSignatureDto,
  DepositVerifyDto,
  RefundClaimDto,
  SetDogGuardingByIdDto,
  SetDogGuardingDto,
  SyncNftDto,
  TokenizeDogDto,
} from './web3.dto';

const UUID_A = '11111111-1111-4111-8111-111111111111';
const TX_HASH = '0x' + 'ab'.repeat(32);

// Mirrors the global pipe registered in backend/src/main.ts.
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

function validate(metatype: any, payload: unknown): Promise<any> {
  return pipe.transform(payload, { type: 'body', metatype });
}

describe('web3 DTOs — global ValidationPipe contract', () => {
  describe('ClaimSignatureDto', () => {
    it('accepts a positive number', async () => {
      const out = await validate(ClaimSignatureDto, { amountToClaim: 100 });
      expect(out.amountToClaim).toBe(100);
    });

    it('coerces a numeric string', async () => {
      const out = await validate(ClaimSignatureDto, { amountToClaim: '250' });
      expect(out.amountToClaim).toBe(250);
    });

    it('rejects zero, negatives and non-numeric strings', async () => {
      await expect(validate(ClaimSignatureDto, { amountToClaim: 0 }))
        .rejects.toBeInstanceOf(BadRequestException);
      await expect(validate(ClaimSignatureDto, { amountToClaim: -5 }))
        .rejects.toBeInstanceOf(BadRequestException);
      await expect(validate(ClaimSignatureDto, { amountToClaim: 'abc' }))
        .rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('RefundClaimDto', () => {
    it('accepts nonce 0 and coerces numeric strings', async () => {
      expect((await validate(RefundClaimDto, { nonce: 0 })).nonce).toBe(0);
      expect((await validate(RefundClaimDto, { nonce: '3' })).nonce).toBe(3);
    });

    it('rejects a negative nonce', async () => {
      await expect(validate(RefundClaimDto, { nonce: -1 }))
        .rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('TokenizeDogDto', () => {
    it('accepts the documented counts', async () => {
      expect((await validate(TokenizeDogDto, { count: 1 })).count).toBe(1);
      expect((await validate(TokenizeDogDto, { count: 3 })).count).toBe(3);
    });

    it('rejects zero', async () => {
      await expect(validate(TokenizeDogDto, { count: 0 }))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('documents a gap: any count >= 1 passes (no @IsIn([1, 3]))', async () => {
      // The DTO comment promises "1 or 3" but only @Min(1) is enforced here.
      // BanditDogFusion.tokenizeDog() is the only thing rejecting count !== 1 && !== 3.
      expect((await validate(TokenizeDogDto, { count: 7 })).count).toBe(7);
    });
  });

  describe('SetDogGuardingDto', () => {
    it('accepts a positive tokenId and a boolean', async () => {
      const out = await validate(SetDogGuardingDto, { tokenId: 1, isGuarding: false });
      expect(out.tokenId).toBe(1);
      expect(out.isGuarding).toBe(false);
    });

    it('rejects a non-boolean flag and a zero tokenId', async () => {
      await expect(validate(SetDogGuardingDto, { tokenId: 1, isGuarding: 'true' }))
        .rejects.toBeInstanceOf(BadRequestException);
      await expect(validate(SetDogGuardingDto, { tokenId: 0, isGuarding: true }))
        .rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('SetDogGuardingByIdDto', () => {
    it('requires a UUID dogId and a boolean flag', async () => {
      const out = await validate(SetDogGuardingByIdDto, { dogId: UUID_A, isGuarding: true });
      expect(out.dogId).toBe(UUID_A);

      await expect(validate(SetDogGuardingByIdDto, { dogId: 'dog-1', isGuarding: true }))
        .rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('DepositVerifyDto', () => {
    it('accepts a 32-byte hex txHash, case-insensitively', async () => {
      expect((await validate(DepositVerifyDto, { txHash: TX_HASH })).txHash).toBe(TX_HASH);

      const upper = '0x' + 'AB'.repeat(32);
      expect((await validate(DepositVerifyDto, { txHash: upper })).txHash).toBe(upper);
    });

    it('rejects malformed hashes', async () => {
      const bad = [
        '0x',
        '0xabc',
        '0x' + 'ab'.repeat(31),
        'ab'.repeat(32),
        '0x' + 'zz'.repeat(32),
      ];

      for (const txHash of bad) {
        await expect(validate(DepositVerifyDto, { txHash }))
          .rejects.toBeInstanceOf(BadRequestException);
      }
    });
  });

  describe('SyncNftDto', () => {
    it('documents a gap: walletAddress carries no validator', async () => {
      // `walletAddress: string` has no class-validator decorator, so the global
      // whitelist treats it as non-whitelisted and forbidNonWhitelisted:true
      // rejects the whole request. Fix by adding @IsEthereumAddress()/@IsString()
      // — or better, derive the wallet from the x-telegram-init-data auth context.
      await expect(validate(SyncNftDto, { walletAddress: '0xabc' }))
        .rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
