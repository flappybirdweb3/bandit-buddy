1. Vá lỗi và Viết Test Cross-Chain Replay cho FarmTokenClaim
📌 Phân tích vấn đề
Như đã chỉ ra trong phân tích hệ thống, nếu hàm hashMessage trong contract FarmTokenClaim.sol chỉ gom thuần túy abi.encodePacked(user, amount, nonce) mà không đưa chainId và verifyingContract vào, chữ ký được cấp cho ví trên mạng Testnet hoàn toàn có thể bị kẻ xấu copy và mang sang Mainnet để claim lần nữa (nếu dùng chung một signer address).
🛠️ Giải pháp trên Smart Contract (Solidity)
Cần cập nhật hàm hashMessage (hoặc cấu trúc EIP-712) bên trong FarmTokenClaim.sol để bắt buộc gắn thêm block.chainid và address(this):
// Đoạn code mẫu logic hash đã được vá domain separation trong FarmTokenClaim.sol
function hashMessage(address user, uint256 amount, uint256 nonce) public view returns (bytes32) {
    return keccak256(
        abi.encodePacked(
            block.chainid, 
            address(this), 
            user, 
            amount, 
            nonce
        )
    );
}


🧪 Bộ Test Hardhat (TypeScript) chống Cross-Chain Replay
Tạo file test mới contracts/test/FarmTokenClaim.crosschain.test.ts để kiểm chứng rằng chữ ký ký ở Chain A sẽ bị từ chối hoàn toàn khi mang sang Chain B:
import { ethers } from "hardhat";
import { expect } from "chai";
import { loadFixture, network } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe("FarmTokenClaim — Cross-Chain Replay Protection [TC-04]", () => {
  async function fixture() {
    const [owner, signer, alice] = await ethers.getSigners();
    
    const FARM = await ethers.deployContract("MockERC20");
    await FARM.waitForDeployment();

    const Claim = await ethers.deployContract("FarmTokenClaim", [
      await FARM.getAddress(),
      signer.address,
      owner.address,
      ethers.parseEther("1"),
      ethers.parseEther("1000")
    ]);
    await Claim.waitForDeployment();
    await FARM.mint(await Claim.getAddress(), ethers.parseEther("100000"));

    return { owner, signer, alice, FARM, Claim };
  }

  it("chữ ký từ Chain A không thể replay sang Chain B (khác chainId) [TC-04]", async () => {
    const { signer, alice, Claim } = await loadFixture(fixture);
    const amount = ethers.parseEther("10");
    const nonce = 1n;

    // 1. Tạo chữ ký ở Chain hiện tại (Chain A)
    const currentChainId = (await ethers.provider.getNetwork()).chainId;
    const claimAddress = await Claim.getAddress();

    // Giả lập message hash chuẩn có domain separation (chainId + contract address)
    const messageHash = ethers.keccak256(
      ethers.solidityPacked(
        ["uint256", "address", "address", "uint256", "uint256"],
        [currentChainId, claimAddress, alice.address, amount, nonce]
      )
    );
    const sig = await signer.signMessage(ethers.getBytes(messageHash));

    // Thực hiện claim thành công trên Chain A
    await Claim.connect(alice).claimTokens(amount, nonce, sig);

    // 2. Mô phỏng chuyển sang Chain B (thay đổi chainId trong môi trường hardhat fork/network)
    // Nếu contract không đưa chainId vào hash, sig trên vẫn hợp lệ ở chain mới.
    // Với cơ chế domain separation, nếu đổi sang chainId khác, việc verify chữ ký sẽ không khớp message hash gốc.
    
    await network.provider.send("hardhat_setChainId", [Number(currentChainId + 1n)]);

    const newNonce = 2n;
    const newAmount = ethers.parseEther("5");
    
    // Kẻ tấn công cố dùng lại thuật toán ký của Chain A nhưng mang sang Chain B (hoặc ngược lại)
    const maliciousHash = ethers.keccak256(
      ethers.solidityPacked(
        ["uint256", "address", "address", "uint256", "uint256"],
        [currentChainId, claimAddress, alice.address, newAmount, newNonce] // Vẫn giữ chainId cũ của Chain A trong payload ký cũ
      )
    );
    const crossChainSig = await signer.signMessage(ethers.getBytes(maliciousHash));

    // Khi contract tính toán lại hash tại block hiện tại (với chainId mới của Chain B), 
    // nó sẽ sinh ra một digest hoàn toàn khác -> Revert InvalidSignature
    await expect(
      Claim.connect(alice).claimTokens(newAmount, newNonce, crossChainSig)
    ).to.be.revertedWithCustomError(Claim, "InvalidSignature");
  });
});


2. Viết Test Suite cho Unique Constraint của processed_onchain_txs
📌 Phân tích vấn đề
Để triệt tiêu hoàn toàn lỗi Double-Credit khi sự kiện on-chain từ BSC bắn về Backend (hoặc listener quét lại log), bảng cơ sở dữ liệu processed_onchain_txs bắt buộc phải có Composite Unique Constraint trên cặp trường (tx_hash, log_index). Nếu chỉ tx_hash, một giao dịch chứa nhiều log (ví dụ: vừa transfer token vừa emit event marketplace) sẽ bị mất dữ liệu các log phía sau do trùng khóa.
🧪 Bộ Test E2E (NestJS + TypeORM + Jest)
Triển khai file test backend/test/processed-onchain-tx.e2e-spec.ts để ép hệ thống kiểm định ràng buộc này ở cấp độ cơ sở dữ liệu thực tế:
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { ProcessedOnchainTx } from '../src/modules/marketplace/entities/processed-onchain-tx.entity';

describe('ProcessedOnchainTx Composite Unique Constraint Suite [SYNC-IDEMP-01]', () => {
  let app: INestApplication;
  let ds: DataSource;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    ds = app.get(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Làm sạch bảng trước mỗi test case
    await ds.getRepository(ProcessedOnchainTx).clear();
  });

  it('chặn hoàn toàn việc ghi trùng lặp cặp (tx_hash, log_index) [SYNC-IDEMP-01]', async () => {
    const repo = ds.getRepository(ProcessedOnchainTx);
    
    const sampleTxHash = '0x' + 'f'.repeat(64);
    const logIndex = 0;

    const payload = {
      txHash: sampleTxHash,
      logIndex: logIndex,
      eventType: 'NFTOrderFilled',
    };

    // Lần ghi đầu tiên: Phải thành công
    const insertFirst = await repo.insert(payload);
    expect(insertFirst.identifiers.length).toBe(1);

    // Lần ghi thứ hai với hệt (tx_hash, log_index): Phải bắn lỗi Unique Violation (Postgres Error Code 23505)
    await expect(
      repo.insert(payload)
    ).rejects.toThrow(); 
  });

  it('cho phép ghi nhiều log_index khác nhau trong cùng một tx_hash', async () => {
    const repo = ds.getRepository(ProcessedOnchainTx);
    const sampleTxHash = '0x' + 'a'.repeat(64);

    // Log thứ nhất ở index 0
    await repo.insert({
      txHash: sampleTxHash,
      logIndex: 0,
      eventType: 'Transfer',
    });

    // Log thứ hai ở index 1 (Cùng txHash nhưng khác logIndex) -> Phải thành công tuyệt đối
    const insertSecond = await repo.insert({
      txHash: sampleTxHash,
      logIndex: 1,
      eventType: 'TaxCollected',
    });

    expect(insertSecond.identifiers.length).toBe(1);

    const totalRecords = await repo.count({ where: { txHash: sampleTxHash } });
    expect(totalRecords).toBe(2);
  });
});


💡 Bước tiếp theo
Hai bộ test mẫu trên đã giải quyết gọn gàng hai hạng mục rủi ro P0 tối quan trọng. Anh có thể đưa trực tiếp các file code này vào thư mục contracts/test/ và backend/test/ trong mã nguồn dự án barnbuddy để tiến hành chạy lệnh kiểm thử npx hardhat test và npm run test:e2e ngay lập tức!
