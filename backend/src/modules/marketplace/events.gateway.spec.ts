import { Test, TestingModule } from '@nestjs/testing';
import { EventsGateway, TradeFilledPayload } from './events.gateway';

describe('EventsGateway', () => {
  let gateway: EventsGateway;
  let mockServer: any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventsGateway],
    }).compile();

    gateway = module.get<EventsGateway>(EventsGateway);

    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };
    gateway.server = mockServer;
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  it('should allow user to subscribe to room', () => {
    const mockSocket: any = {
      id: 'socket-123',
      join: jest.fn(),
    };

    const res = gateway.handleSubscribeUser(mockSocket, { userId: 'user-456' });
    expect(mockSocket.join).toHaveBeenCalledWith('user:user-456');
    expect(res).toEqual({ status: 'ok', room: 'user:user-456' });
  });

  it('should emit trade_filled to user room and broadcast global_trade', () => {
    const payload: TradeFilledPayload = {
      itemType: 'crate_watermelon',
      quantity: 1000,
      price: '15',
      priceFormatted: '15.00 FARM',
      buyerAddress: '0x1234567890123456789012345678901234567890',
      sellerUserId: 'user-seller-999',
      txHash: '0xabcdef',
      isNFT: false,
    };

    gateway.notifyTradeFilled('user-seller-999', payload);

    expect(mockServer.to).toHaveBeenCalledWith('user:user-seller-999');
    expect(mockServer.emit).toHaveBeenCalledWith('trade_filled', payload);
    expect(mockServer.emit).toHaveBeenCalledWith('global_trade', payload);
  });
});
