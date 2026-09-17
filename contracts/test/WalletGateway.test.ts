import { expect } from 'chai';
import { ethers } from 'hardhat';
import { WalletGateway, FarmToken } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

describe('WalletGateway (0.3% Outbound Withdrawal Fee & Routing)', () => {
  let gateway: WalletGateway;
  let farmToken: FarmToken;
  let owner: SignerWithAddress;
  let treasuryVault: SignerWithAddress;
  let user: SignerWithAddress;
  let recipient: SignerWithAddress;

  beforeEach(async () => {
    [owner, treasuryVault, user, recipient] = await ethers.getSigners();

    // Deploy FarmToken
    const FarmTokenFactory = await ethers.getContractFactory('FarmToken');
    farmToken = (await FarmTokenFactory.deploy(owner.address)) as unknown as FarmToken;
    await farmToken.waitForDeployment();

    // Deploy WalletGateway pointing to treasuryVault and farmToken
    const GatewayFactory = await ethers.getContractFactory('WalletGateway');
    gateway = (await GatewayFactory.deploy(
      treasuryVault.address,
      farmToken.target,
      owner.address
    )) as unknown as WalletGateway;
    await gateway.waitForDeployment();

    // Distribute tokens to user
    await farmToken.excludeFromFee(user.address, true);
    await farmToken.excludeFromFee(gateway.target as string, true);
    await farmToken.excludeFromFee(recipient.address, true);
    await farmToken.excludeFromFee(treasuryVault.address, true);
    await farmToken.excludeFromFee('0x000000000000000000000000000000000000dEaD', true);

    await farmToken.transfer(user.address, ethers.parseEther('1000'));
  });

  describe('BNB Transfer Routing (routeBNBTransfer)', () => {
    it('routes 1.0 BNB, sending 0.003 BNB (0.3%) to Treasury and 0.997 BNB to recipient', async () => {
      const sendAmount = ethers.parseEther('1.0');
      const expectedFee = ethers.parseEther('0.003'); // 1.0 * 30 / 10000
      const expectedNet = ethers.parseEther('0.997');

      const initialTreasuryBalance = await ethers.provider.getBalance(treasuryVault.address);
      const initialRecipientBalance = await ethers.provider.getBalance(recipient.address);

      await expect(
        gateway.connect(user).routeBNBTransfer(recipient.address, { value: sendAmount })
      )
        .to.emit(gateway, 'BNBTransferRouted')
        .withArgs(user.address, recipient.address, sendAmount, expectedFee, expectedNet);

      const finalTreasuryBalance = await ethers.provider.getBalance(treasuryVault.address);
      const finalRecipientBalance = await ethers.provider.getBalance(recipient.address);

      expect(finalTreasuryBalance - initialTreasuryBalance).to.equal(expectedFee);
      expect(finalRecipientBalance - initialRecipientBalance).to.equal(expectedNet);
    });

    it('reverts on 0 BNB or invalid address', async () => {
      await expect(
        gateway.connect(user).routeBNBTransfer(recipient.address, { value: 0 })
      ).to.be.revertedWithCustomError(gateway, 'ZeroAmount');

      await expect(
        gateway.connect(user).routeBNBTransfer(ethers.ZeroAddress, { value: ethers.parseEther('0.1') })
      ).to.be.revertedWithCustomError(gateway, 'InvalidAddress');
    });
  });

  describe('Token Transfer Routing (routeTokenTransfer)', () => {
    const DEAD_ADDRESS = '0x000000000000000000000000000000000000dEaD';

    it('routes 100 FARM, sending 0.3 FARM directly to Black Hole (DEAD_ADDRESS) and 99.7 FARM to recipient', async () => {
      const sendAmount = ethers.parseEther('100');
      const expectedFee = ethers.parseEther('0.3');
      const expectedNet = ethers.parseEther('99.7');

      // Approve gateway
      await farmToken.connect(user).approve(gateway.target, sendAmount);

      const initialDeadBalance = await farmToken.balanceOf(DEAD_ADDRESS);
      const initialTreasuryBalance = await farmToken.balanceOf(treasuryVault.address);

      await expect(
        gateway.connect(user).routeTokenTransfer(farmToken.target, recipient.address, sendAmount)
      )
        .to.emit(gateway, 'TokenTransferRouted')
        .withArgs(user.address, farmToken.target, recipient.address, DEAD_ADDRESS, sendAmount, expectedFee, expectedNet);

      // Verify FARM fee went to DEAD_ADDRESS (Permanent Burn)
      expect(await farmToken.balanceOf(DEAD_ADDRESS)).to.equal(initialDeadBalance + expectedFee);
      // Verify Treasury received 0 FARM
      expect(await farmToken.balanceOf(treasuryVault.address)).to.equal(initialTreasuryBalance);
      // Verify recipient received net amount
      expect(await farmToken.balanceOf(recipient.address)).to.equal(expectedNet);
    });

    it('routes non-FARM tokens, sending 0.3% fee to Treasury Vault and 99.7% to recipient', async () => {
      // Deploy another ERC20 (mocking e.g. USDT)
      const MockTokenFactory = await ethers.getContractFactory('FarmToken');
      const otherToken = await MockTokenFactory.deploy(owner.address);
      await otherToken.waitForDeployment();

      await otherToken.excludeFromFee(user.address, true);
      await otherToken.excludeFromFee(gateway.target as string, true);
      await otherToken.excludeFromFee(recipient.address, true);
      await otherToken.excludeFromFee(treasuryVault.address, true);
      await otherToken.transfer(user.address, ethers.parseEther('1000'));

      const sendAmount = ethers.parseEther('100');
      const expectedFee = ethers.parseEther('0.3');
      const expectedNet = ethers.parseEther('99.7');

      await otherToken.connect(user).approve(gateway.target, sendAmount);

      await expect(
        gateway.connect(user).routeTokenTransfer(otherToken.target, recipient.address, sendAmount)
      )
        .to.emit(gateway, 'TokenTransferRouted')
        .withArgs(user.address, otherToken.target, recipient.address, treasuryVault.address, sendAmount, expectedFee, expectedNet);

      // Verify fee went to Treasury Vault
      expect(await otherToken.balanceOf(treasuryVault.address)).to.equal(expectedFee);
      // Verify recipient received net amount
      expect(await otherToken.balanceOf(recipient.address)).to.equal(expectedNet);
    });

    it('reverts on 0 amount or missing approval', async () => {
      await expect(
        gateway.connect(user).routeTokenTransfer(farmToken.target, recipient.address, 0)
      ).to.be.revertedWithCustomError(gateway, 'ZeroAmount');

      await expect(
        gateway.connect(user).routeTokenTransfer(farmToken.target, recipient.address, ethers.parseEther('10'))
      ).to.be.reverted;
    });
  });

  describe('Admin Fee Configuration', () => {
    it('allows owner to update fee up to MAX_FEE_BPS (100 BPS = 1%) and rejects higher', async () => {
      await expect(gateway.connect(owner).setFeeBps(50))
        .to.emit(gateway, 'FeeBpsUpdated')
        .withArgs(30, 50);

      expect(await gateway.feeBps()).to.equal(50);

      await expect(gateway.connect(owner).setFeeBps(101)).to.be.revertedWithCustomError(
        gateway,
        'FeeTooHigh'
      );
    });
  });
});
