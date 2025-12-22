import {
    HubConnectionBuilder,
    HubConnection,
    HubConnectionState,
    HttpTransportType,
    LogLevel
} from '@microsoft/signalr';
import { createLogger } from '../utils/logger.js';
import type { Config, PlayerSyncData } from '../types/index.js';

const logger = createLogger('AnimalSync');

interface PendingEvent {
    method: string;
    args: any[];
    type: 'send' | 'invoke';
    returnType?: string;
    resolve?: (value: any) => void;
    reject?: (error: Error) => void;
}

export class AnimalSync {
    private static instance: AnimalSync | null = null;

    private hubConnection: HubConnection;
    private pendingEvents: PendingEvent[] = [];
    private isReconnecting = false;
    private retryAttempt = 0;
    private readonly RETRY_DELAYS = [0, 2000, 5000, 10000, 30000];
    private readonly MAX_RETRY_ATTEMPTS = -1; // -1 = infinite

    public clientConnectionId: string = '';
    public readonly clientId: number;

    private constructor(private config: Config) {
        this.clientId = config.app.clientId;
        this.hubConnection = this.buildConnection();
        this.setupBaseEventListeners();
        this.connect();
    }

    public static initialize(config: Config): AnimalSync {
        if (!AnimalSync.instance) {
            AnimalSync.instance = new AnimalSync(config);
        }
        return AnimalSync.instance;
    }

    public static getInstance(): AnimalSync {
        if (!AnimalSync.instance) {
            throw new Error('AnimalSync must be initialized before using');
        }
        return AnimalSync.instance;
    }

    private buildConnection(): HubConnection {
        const url = `${this.config.websocket.url}?ClientId=${this.clientId}`;

        return new HubConnectionBuilder()
            .withUrl(url, {
                headers: { 'Secret': this.config.websocket.secret },
                transport: HttpTransportType.WebSockets
            })
            .withAutomaticReconnect({
                nextRetryDelayInMilliseconds: (retryContext) => {
                    if (retryContext.previousRetryCount < this.RETRY_DELAYS.length) {
                        return this.RETRY_DELAYS[retryContext.previousRetryCount];
                    }
                    return this.RETRY_DELAYS[this.RETRY_DELAYS.length - 1];
                }
            })
            .configureLogging(LogLevel.Warning)
            .build();
    }

    private setupBaseEventListeners(): void {
        this.hubConnection.on('connection', (message: string) => {
            this.clientConnectionId = message;
            this.retryAttempt = 0;
            this.isReconnecting = false;
            this.processPendingEvents();
            logger.info(`Connected with ID: ${message}`);
        });

        this.hubConnection.on('error', (error: any) => {
            logger.error(`Error received: ${JSON.stringify(error)}`);
        });

        this.hubConnection.on('disconnect', (reason: string) => {
            logger.warn(`Disconnected: ${reason}`);
        });

        this.hubConnection.onclose((error) => {
            if (error) {
                logger.error(`Connection closed with error: ${error.message}`);
            } else {
                logger.warn('Connection closed');
            }
            this.startReconnecting();
        });

        this.hubConnection.onreconnecting((error) => {
            logger.warn(`Reconnecting... ${error?.message || ''}`);
            this.isReconnecting = true;
        });

        this.hubConnection.onreconnected((connectionId) => {
            logger.info(`Reconnected with ID: ${connectionId}`);
            this.isReconnecting = false;
            this.processPendingEvents();
        });
    }

    private processPendingEvents(): void {
        while (this.pendingEvents.length > 0) {
            const event = this.pendingEvents.shift();
            if (!event) continue;

            try {
                if (event.type === 'send') {
                    this.hubConnection.send(event.method, ...event.args);
                    logger.info(`Resent queued event: ${event.method}`);
                } else if (event.type === 'invoke' && event.resolve) {
                    this.hubConnection.invoke(event.method, ...event.args)
                        .then(event.resolve)
                        .catch(event.reject);
                }
            } catch (error) {
                logger.error(`Error processing pending event: ${(error as Error).message}`);
            }
        }
    }

    public isConnected(): boolean {
        return this.hubConnection.state === HubConnectionState.Connected;
    }

    private async connect(): Promise<void> {
        if (this.hubConnection.state !== HubConnectionState.Disconnected) {
            return;
        }

        try {
            logger.info('Attempting to connect...');
            this.isReconnecting = true;
            await this.hubConnection.start();
            logger.info('Connected successfully');
            this.isReconnecting = false;
            this.retryAttempt = 0;
            this.processPendingEvents();
        } catch (error) {
            logger.warn(`Failed to connect: ${(error as Error).message}`);
            this.startReconnecting();
        }
    }

    private startReconnecting(): void {
        if (this.MAX_RETRY_ATTEMPTS !== -1 && this.retryAttempt >= this.MAX_RETRY_ATTEMPTS) {
            logger.warn('Maximum retry attempts reached');
            this.isReconnecting = false;
            return;
        }

        const delay = this.retryAttempt < this.RETRY_DELAYS.length
            ? this.RETRY_DELAYS[this.retryAttempt]
            : this.RETRY_DELAYS[this.RETRY_DELAYS.length - 1];

        this.retryAttempt++;

        setTimeout(() => {
            logger.info(`Reconnection attempt #${this.retryAttempt}`);
            this.connect();
        }, delay);
    }

    public on<T>(eventName: string, handler: (data: T) => void): void {
        this.hubConnection.on(eventName, handler);
    }

    public off(eventName: string): void {
        this.hubConnection.off(eventName);
    }

    public send(method: string, ...args: any[]): void {
        if (this.hubConnection.state === HubConnectionState.Connected) {
            try {
                this.hubConnection.send(method, ...args);
            } catch (error) {
                logger.error(`Error sending message: ${(error as Error).message}`);
                this.queueEvent({ method, args, type: 'send' });
            }
        } else {
            logger.warn('Connection not established. Queuing event.');
            this.queueEvent({ method, args, type: 'send' });
            this.startReconnecting();
        }
    }

    public async invoke<T>(method: string, ...args: any[]): Promise<T> {
        if (this.hubConnection.state === HubConnectionState.Connected) {
            return this.hubConnection.invoke<T>(method, ...args);
        }

        return new Promise((resolve, reject) => {
            logger.warn('Connection not established. Queuing invoke event.');
            this.queueEvent({ method, args, type: 'invoke', resolve, reject });
            this.startReconnecting();
        });
    }

    private queueEvent(event: PendingEvent): void {
        this.pendingEvents.push(event);
    }

    // Utility methods for common events
    public sendGuildSync(guilds: string[]): void {
        this.send('guild_sync', this.clientId.toString(), guilds);
    }

    public sendPlayerSync(data: PlayerSyncData): void {
        this.send('player_sync', this.clientId.toString(), data);
    }

    public async dispose(): Promise<void> {
        this.pendingEvents = [];
        this.isReconnecting = false;

        try {
            await this.hubConnection.stop();
        } catch (error) {
            logger.error(`Error stopping connection: ${(error as Error).message}`);
        }

        AnimalSync.instance = null;
    }
}
