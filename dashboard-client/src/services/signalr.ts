import * as signalR from '@microsoft/signalr';
import { AlertNotification } from '../types/sensor';

const NOTIFICATION_URL = (
  import.meta.env.VITE_NOTIFICATION_URL || 'http://localhost:5001'
).replace(/\/$/, '');

const HUB_URL = `${NOTIFICATION_URL}/hubs/alerts`;

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

export class AlertSignalRClient {
  private connection: signalR.HubConnection | null = null;

  public async start(
    onAlertReceived: (alert: AlertNotification) => void,
    onStatusChange?: (status: ConnectionStatus) => void
  ): Promise<void> {
    if (this.connection) {
      await this.stop();
    }

    const connection = new signalR.HubConnectionBuilder()
      .withUrl(HUB_URL)
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Information)
      .build();

    connection.on('ReceiveAlert', (alert: AlertNotification) => {
      onAlertReceived(alert);
    });

    connection.onreconnecting(() => {
      onStatusChange?.('reconnecting');
    });

    connection.onreconnected(() => {
      onStatusChange?.('connected');
    });

    connection.onclose(() => {
      onStatusChange?.('disconnected');
    });

    this.connection = connection;

    try {
      await connection.start();
      onStatusChange?.('connected');
    } catch (error) {
      onStatusChange?.('disconnected');
      throw error;
    }
  }

  public async stop(): Promise<void> {
    if (!this.connection) {
      return;
    }

    try {
      this.connection.off('ReceiveAlert');
      await this.connection.stop();
    } finally {
      this.connection = null;
    }
  }
}

export const alertSignalRClient = new AlertSignalRClient();