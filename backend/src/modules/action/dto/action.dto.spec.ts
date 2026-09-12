import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  FertilizeDto,
  PlantDto,
  RepairDto,
  RevealThiefDto,
  StealDto,
  ThrowAttackDto,
} from './action.dto';

const UUID_A = '11111111-1111-4111-8111-111111111111';
const UUID_B = '22222222-2222-4222-8222-222222222222';

// Mirrors the global pipe registered in backend/src/main.ts.
const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

function validate(metatype: any, payload: unknown): Promise<any> {
  return pipe.transform(payload, { type: 'body', metatype });
}

describe('action DTOs — global ValidationPipe contract', () => {
  describe('PlantDto', () => {
    it('accepts a well-formed payload', async () => {
      const out = await validate(PlantDto, { plotId: UUID_A, seedId: UUID_B });
      expect(out.plotId).toBe(UUID_A);
      expect(out.seedId).toBe(UUID_B);
    });

    it('rejects non-UUID ids', async () => {
      await expect(validate(PlantDto, { plotId: 'plot-1', seedId: UUID_B }))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a missing field', async () => {
      await expect(validate(PlantDto, { plotId: UUID_A }))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects unknown properties (mass-assignment guard)', async () => {
      await expect(validate(PlantDto, { plotId: UUID_A, seedId: UUID_B, goldBalance: 999_999 }))
        .rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('StealDto', () => {
    it('accepts the optional useMasterKey flag', async () => {
      const out = await validate(StealDto, {
        targetUserId: UUID_A,
        plotId: UUID_B,
        useMasterKey: true,
      });
      expect(out.useMasterKey).toBe(true);
    });

    it('accepts a payload without the optional flag', async () => {
      const out = await validate(StealDto, { targetUserId: UUID_A, plotId: UUID_B });
      expect(out.targetUserId).toBe(UUID_A);
    });

    it('rejects a non-boolean useMasterKey', async () => {
      await expect(
        validate(StealDto, { targetUserId: UUID_A, plotId: UUID_B, useMasterKey: 'yes' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('RevealThiefDto', () => {
    it('requires a UUID stealLogId', async () => {
      const out = await validate(RevealThiefDto, { stealLogId: UUID_A });
      expect(out.stealLogId).toBe(UUID_A);

      await expect(validate(RevealThiefDto, { stealLogId: 'log-1' }))
        .rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('RepairDto', () => {
    it('accepts the documented fence/barn targets', async () => {
      const out = await validate(RepairDto, { target: 'fence', amount: 50 });
      expect(out.target).toBe('fence');
      expect(out.amount).toBe(50);
    });

    it('rejects an unknown target', async () => {
      await expect(validate(RepairDto, { target: 'wall', amount: 50 }))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a missing amount', async () => {
      await expect(validate(RepairDto, { target: 'fence' }))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('documents a gap: amount carries no numeric validation', async () => {
      // RepairDto.amount is decorated only with @IsNotEmpty(), so a non-numeric
      // string survives the global pipe and reaches ActionService.repairBuilding().
      // Adding @Type(() => Number) + @IsInt() + @IsIn([10..100]) would close this.
      const out = await validate(RepairDto, { target: 'fence', amount: 'not-a-number' });
      expect(out.amount).toBe('not-a-number');
    });
  });

  describe('FertilizeDto', () => {
    it('accepts a payload without the optional tier', async () => {
      const out = await validate(FertilizeDto, { plotId: UUID_A });
      expect(out.plotId).toBe(UUID_A);
    });

    it('accepts every documented tier', async () => {
      for (const tier of ['auto', 'normal', 'super', 'advanced']) {
        const out = await validate(FertilizeDto, { plotId: UUID_A, tier });
        expect(out.tier).toBe(tier);
      }
    });

    it('rejects an unknown tier', async () => {
      await expect(validate(FertilizeDto, { plotId: UUID_A, tier: 'legendary' }))
        .rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('ThrowAttackDto', () => {
    it('accepts bugs and rejects anything else', async () => {
      const out = await validate(ThrowAttackDto, {
        targetUserId: UUID_A,
        plotId: UUID_B,
        type: 'bugs',
      });
      expect(out.type).toBe('bugs');

      await expect(
        validate(ThrowAttackDto, { targetUserId: UUID_A, plotId: UUID_B, type: 'fire' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
