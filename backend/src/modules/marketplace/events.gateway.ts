import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Injectable, Logger } from '@nestjs/common';

export interface TradeFilledPayload {
  itemType: string;
  quantity: number;
  price: string;
  priceFormatted?: string;
  buyerAddress: string;
  sellerUserId?: string;
  txHash?: string;
  isNFT?: boolean;
}

@Injectable()
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/ws/events',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(EventsGateway.name);

  handleConnection(client: Socket) {
    const userId = (client.handshake.query.userId || client.handshake.auth?.userId) as string | undefined;
    if (userId) {
      client.join(`user:${userId}`);
      this.logger.debug(`Client ${client.id} joined user room: user:${userId}`);
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe_user')
  handleSubscribeUser(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { userId: string },
  ) {
    if (data?.userId) {
      client.join(`user:${data.userId}`);
      this.logger.debug(`Client ${client.id} explicitly subscribed to user:${data.userId}`);
      return { status: 'ok', room: `user:${data.userId}` };
    }
  }

  notifyTradeFilled(sellerUserId: string, data: TradeFilledPayload) {
    if (!this.server) {
      this.logger.warn('WebSocket server not initialized; cannot emit trade_filled');
      return;
    }
    // Targeted notification to seller
    this.server.to(`user:${sellerUserId}`).emit('trade_filled', data);
    // Broadcast for live activity feed / ticker
    this.server.emit('global_trade', data);
    this.logger.log(`Emitted trade_filled to user:${sellerUserId} for ${data.itemType} x${data.quantity}`);
  }
}
