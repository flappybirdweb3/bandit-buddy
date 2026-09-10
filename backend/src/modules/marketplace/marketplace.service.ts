import {
  Injectable, BadRequestException, NotFoundException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource, LessThan } from 'typeorm';
import { ethers } from 'ethers';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { MarketplaceListing } from './entities/marketplace-listing.entity';
import { User } from '../user/entities/user.entity';
import { CreateListingDto } from './dto/marketplace.dto';

// EIP-712 order typehash (must match BanditMarket.sol)
const ORDER_TYPEHASH = ethers.keccak256(ethers.toUtf8Bytes(
  'Order(address seller,address nftContract,uint256 tokenId,uint256 price,uint256 deadline,uint256 nonce)',
));

@Injectable()
export class MarketplaceService {
  constructor(
    @InjectRepository(MarketplaceListing)
    private readonly listingRepo: Repository<MarketplaceListing>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  async createListing(userId: string, dto: CreateListingDto): Promise<MarketplaceListing> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user?.walletAddress) {
      throw new BadRequestException('Link a BSC wallet before listing');
    }

    const deadline = new Date(dto.deadline);
    if (deadline <= new Date()) {
      throw new BadRequestException('Deadline must be in the future');
    }

    // Count existing nonce for this seller+contract+token
    const lastListing = await this.listingRepo.findOne({
      where: { sellerId: userId, nftContract: dto.nftContract, tokenId: dto.tokenId },
      order: { nonce: 'DESC' },
    });
    const nonce = (lastListing?.nonce ?? -1) + 1;

    // Verify EIP-712 signature
    this.verifyEip712Sig(user.walletAddress, dto, nonce);

    // Ensure no active listing for same token
    const existing = await this.listingRepo.findOne({
      where: { nftContract: dto.nftContract, tokenId: dto.tokenId, status: 'active' },
    });
    if (existing) {
      throw new BadRequestException('An active listing already exists for this NFT. Cancel it first.');
    }

    const listing = this.listingRepo.create({
      sellerId: userId,
      nftContract: dto.nftContract,
      tokenId: dto.tokenId,
      priceFarm: dto.priceFarm,
      deadline,
      nonce,
      eip712Sig: dto.eip712Sig,
      status: 'active',
    });
    return this.listingRepo.save(listing);
  }

  async getListings(limit = 50, offset = 0) {
    const now = new Date();
    return this.listingRepo.find({
      where: { status: 'active' },
      relations: ['seller'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    }).then((listings) =>
      listings
        .filter((l) => l.deadline > now)
        .map((l) => ({
          id: l.id,
          seller: l.seller?.username ?? 'Unknown',
          nftContract: l.nftContract,
          tokenId: l.tokenId,
          priceFarm: Number(l.priceFarm),
          deadline: l.deadline,
          createdAt: l.createdAt,
          eip712Sig: l.eip712Sig,
          nonce: l.nonce,
        })),
    );
  }

  async getMyListings(userId: string) {
    return this.listingRepo.find({
      where: { sellerId: userId },
      order: { createdAt: 'DESC' },
    });
  }

  async cancelListing(userId: string, listingId: string) {
    const listing = await this.listingRepo.findOne({ where: { id: listingId } });
    if (!listing) throw new NotFoundException('Listing not found');
    if (listing.sellerId !== userId) throw new ForbiddenException('Not your listing');
    if (listing.status !== 'active') throw new BadRequestException('Listing is not active');

    await this.listingRepo.update(listingId, { status: 'cancelled' });
    return { message: 'Listing cancelled' };
  }

  async buyListing(buyerId: string, listingId: string) {
    const listing = await this.listingRepo.findOne({
      where: { id: listingId, status: 'active' },
      relations: ['seller'],
    });
    if (!listing) throw new NotFoundException('Listing not found or not active');
    if (listing.sellerId === buyerId) throw new BadRequestException('Cannot buy your own listing');
    if (new Date() > listing.deadline) {
      await this.listingRepo.update(listingId, { status: 'cancelled' });
      throw new BadRequestException('Listing has expired');
    }

    const buyer = await this.userRepo.findOne({ where: { id: buyerId } });
    if (!buyer?.walletAddress) {
      throw new BadRequestException('Link a BSC wallet to buy NFTs');
    }

    // Return EIP-712 order data for on-chain execution
    // Actual token transfer + $FARM payment happens on-chain via BanditMarket.sol
    await this.listingRepo.update(listingId, {
      status: 'filled', buyerId, filledAt: new Date(),
    });

    return {
      message: 'Order matched. Execute on-chain to complete transfer.',
      order: {
        seller: listing.seller.walletAddress,
        nftContract: listing.nftContract,
        tokenId: listing.tokenId,
        price: ethers.parseEther(String(listing.priceFarm)).toString(),
        deadline: Math.floor(listing.deadline.getTime() / 1000),
        nonce: listing.nonce,
        signature: listing.eip712Sig,
      },
      contractAddress: this.config.get<string>('web3.nftContractAddress') ?? '',
    };
  }

  // Expire stale listings every hour
  @Cron('0 * * * *')
  async expireListings(): Promise<void> {
    await this.listingRepo.update(
      { status: 'active', deadline: LessThan(new Date()) },
      { status: 'cancelled' },
    );
  }

  private verifyEip712Sig(sellerAddress: string, dto: CreateListingDto, nonce: number): void {
    try {
      const priceWei = ethers.parseEther(String(dto.priceFarm));
      const deadlineTs = Math.floor(new Date(dto.deadline).getTime() / 1000);

      const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
        ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256', 'uint256'],
        [ORDER_TYPEHASH, sellerAddress, dto.nftContract, dto.tokenId, priceWei, deadlineTs, nonce],
      );
      const structHash = ethers.keccak256(encoded);
      const recovered  = ethers.recoverAddress(ethers.hashMessage(ethers.getBytes(structHash)), dto.eip712Sig);

      if (recovered.toLowerCase() !== sellerAddress.toLowerCase()) {
        throw new BadRequestException('Invalid EIP-712 signature — signer does not match wallet');
      }
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      // Signature format errors are treated as invalid
      throw new BadRequestException('EIP-712 signature verification failed');
    }
  }
}
