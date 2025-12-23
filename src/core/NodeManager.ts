/**
 * NodeManager - Smart Lavalink Node Management
 * Load balancing, failover, và health monitoring cho Lavalink nodes
 * @version 3.0.0
 */

import { EventEmitter } from 'events';
import { Kazagumo } from 'kazagumo';
import { Node } from 'shoukaku';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('NodeManager');

// ============================================
// INTERFACES & TYPES
// ============================================

export interface NodeHealth {
    name: string;
    url: string;
    state: 'CONNECTED' | 'DISCONNECTED' | 'CONNECTING' | 'RECONNECTING';
    players: number;
    cpu: number;
    memory: {
        used: number;
        free: number;
        allocated: number;
        reservable: number;
    };
    uptime: number;
    ping: number;
    failureCount: number;
    lastFailure: number | null;
    lastSuccess: number | null;
    score: number; // Health score 0-100
}

export interface NodeSelectionStrategy {
    type: 'round-robin' | 'least-players' | 'lowest-cpu' | 'lowest-memory' | 'best-score' | 'random';
}

export interface NodeManagerConfig {
    selectionStrategy: NodeSelectionStrategy;
    healthCheckInterval: number; // ms
    failureThreshold: number; // Max failures before marking unhealthy
    recoveryTime: number; // ms to wait before retrying failed node
    minHealthScore: number; // Minimum score to be considered healthy
}

// ============================================
// NODE MANAGER CLASS
// ============================================

class NodeManagerClass extends EventEmitter {
    private static instance: NodeManagerClass;
    private kazagumo: Kazagumo | null = null;
    private nodeHealth: Map<string, NodeHealth> = new Map();
    private roundRobinIndex: number = 0;
    private healthCheckInterval: NodeJS.Timeout | null = null;
    private nodeReadyCount: number = 0;

    private config: NodeManagerConfig = {
        selectionStrategy: { type: 'best-score' },
        healthCheckInterval: 30000, // 30 seconds
        failureThreshold: 3,
        recoveryTime: 60000, // 1 minute
        minHealthScore: 30
    };

    private constructor() {
        super();
        this.setMaxListeners(20);
        logger.info('NodeManager initialized');
    }

    public static getInstance(): NodeManagerClass {
        if (!NodeManagerClass.instance) {
            NodeManagerClass.instance = new NodeManagerClass();
        }
        return NodeManagerClass.instance;
    }

    /**
     * Khởi tạo với Kazagumo instance
     */
    public initialize(kazagumo: Kazagumo, config?: Partial<NodeManagerConfig>): void {
        this.kazagumo = kazagumo;

        if (config) {
            this.config = { ...this.config, ...config };
        }

        this.setupEventListeners();
        this.startHealthCheck();

        // Initialize node health tracking immediately
        this.initializeNodeHealth();
    }

    /**
     * Setup event listeners cho Shoukaku
     */
    private setupEventListeners(): void {
        if (!this.kazagumo) return;

        this.kazagumo.shoukaku.on('ready', (name: string, _resumed: boolean) => {
            // Ensure health entry exists for this node
            this.ensureNodeHealth(name);
            this.updateNodeState(name, 'CONNECTED');
            this.recordSuccess(name);
            this.emit('nodeReady', name);

            // Only log first 3 nodes to reduce spam
            this.nodeReadyCount++;
            if (this.nodeReadyCount <= 3) {
                logger.info(`Node '${name}' connected`);
            } else if (this.nodeReadyCount === 4) {
                logger.info(`... and more nodes connected (total: ${this.nodeHealth.size})`);
            }
        });

        this.kazagumo.shoukaku.on('error', (name: string, error: Error) => {
            this.ensureNodeHealth(name);
            this.recordFailure(name, error);
            this.emit('nodeError', { name, error });
        });

        this.kazagumo.shoukaku.on('close', (name: string, code: number, reason: string) => {
            this.updateNodeState(name, 'DISCONNECTED');
            this.emit('nodeClose', { name, code, reason });
        });

        (this.kazagumo.shoukaku as any).on('disconnect', (name: string) => {
            this.updateNodeState(name, 'DISCONNECTED');
            this.emit('nodeDisconnect', name);
        });

        (this.kazagumo.shoukaku as any).on('reconnecting', (name: string) => {
            this.updateNodeState(name, 'RECONNECTING');
            this.emit('nodeReconnecting', name);
        });
    }

    /**
     * Ensure health entry exists for a node
     */
    private ensureNodeHealth(name: string): void {
        if (this.nodeHealth.has(name)) return;
        if (!this.kazagumo) return;

        const node = this.kazagumo.shoukaku.nodes.get(name);
        if (!node) return;

        this.nodeHealth.set(name, {
            name,
            url: this.getNodeUrl(node),
            state: this.getNodeState(node.state),
            players: 0,
            cpu: 0,
            memory: { used: 0, free: 0, allocated: 0, reservable: 0 },
            uptime: 0,
            ping: -1,
            failureCount: 0,
            lastFailure: null,
            lastSuccess: Date.now(),
            score: 100 // Start with high score for connected node
        });
    }

    /**
     * Khởi tạo health data cho tất cả nodes
     */
    private initializeNodeHealth(): void {
        if (!this.kazagumo) return;

        this.kazagumo.shoukaku.nodes.forEach((node, name) => {
            const nodeAny = node as any;
            this.nodeHealth.set(name, {
                name,
                url: this.getNodeUrl(node),
                state: this.getNodeState(node.state),
                players: 0,
                cpu: 0,
                memory: { used: 0, free: 0, allocated: 0, reservable: 0 },
                uptime: 0,
                ping: -1,
                failureCount: 0,
                lastFailure: null,
                lastSuccess: null,
                score: 50 // Start with neutral score
            });
        });
    }

    /**
     * Bắt đầu health check định kỳ
     */
    private startHealthCheck(): void {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }

        this.healthCheckInterval = setInterval(() => {
            this.performHealthCheck();
        }, this.config.healthCheckInterval);

        // Initial health check
        setTimeout(() => this.performHealthCheck(), 5000);
    }

    /**
     * Thực hiện health check cho tất cả nodes
     */
    private performHealthCheck(): void {
        if (!this.kazagumo) return;

        this.kazagumo.shoukaku.nodes.forEach((node, name) => {
            const health = this.nodeHealth.get(name);
            if (!health) return;

            const stats = node.stats;
            const nodeAny = node as any;

            // Update stats
            health.state = this.getNodeState(node.state);
            health.players = stats?.players || 0;
            health.cpu = stats?.cpu?.systemLoad ? Math.round(stats.cpu.systemLoad * 100) : 0;
            health.memory = {
                used: stats?.memory?.used || 0,
                free: stats?.memory?.free || 0,
                allocated: stats?.memory?.allocated || 0,
                reservable: stats?.memory?.reservable || 0
            };
            health.uptime = stats?.uptime || 0;
            health.ping = typeof nodeAny.ws?.ping === 'number' ? nodeAny.ws.ping : -1;

            // Calculate health score
            health.score = this.calculateHealthScore(health);
        });

        this.emit('healthCheckComplete', Array.from(this.nodeHealth.values()));
    }

    /**
     * Tính điểm health score (0-100)
     */
    private calculateHealthScore(health: NodeHealth): number {
        let score = 100;

        // Connection state penalty
        if (health.state !== 'CONNECTED') {
            return 0;
        }

        // CPU penalty (higher CPU = lower score)
        if (health.cpu > 80) score -= 30;
        else if (health.cpu > 60) score -= 20;
        else if (health.cpu > 40) score -= 10;

        // Memory penalty
        const memoryUsagePercent = health.memory.allocated > 0
            ? (health.memory.used / health.memory.allocated) * 100
            : 0;
        if (memoryUsagePercent > 80) score -= 20;
        else if (memoryUsagePercent > 60) score -= 10;

        // Player count penalty (load balancing)
        if (health.players > 50) score -= 20;
        else if (health.players > 20) score -= 10;
        else if (health.players > 10) score -= 5;

        // Ping penalty
        if (health.ping > 200) score -= 15;
        else if (health.ping > 100) score -= 10;
        else if (health.ping > 50) score -= 5;

        // Failure penalty
        if (health.failureCount > 0) {
            const failurePenalty = Math.min(health.failureCount * 10, 40);
            score -= failurePenalty;

            // Recovery bonus if no recent failures
            if (health.lastFailure && Date.now() - health.lastFailure > this.config.recoveryTime) {
                score += 10;
            }
        }

        return Math.max(0, Math.min(100, score));
    }

    // ============================================
    // NODE SELECTION STRATEGIES
    // ============================================

    /**
     * Chọn node tốt nhất dựa trên strategy
     */
    public selectBestNode(): string | undefined {
        const healthyNodes = this.getHealthyNodes();

        if (healthyNodes.length === 0) {
            return this.getFallbackNode();
        }

        switch (this.config.selectionStrategy.type) {
            case 'round-robin':
                return this.selectRoundRobin(healthyNodes);
            case 'least-players':
                return this.selectLeastPlayers(healthyNodes);
            case 'lowest-cpu':
                return this.selectLowestCpu(healthyNodes);
            case 'lowest-memory':
                return this.selectLowestMemory(healthyNodes);
            case 'random':
                return this.selectRandom(healthyNodes);
            case 'best-score':
            default:
                return this.selectBestScore(healthyNodes);
        }
    }

    private selectRoundRobin(nodes: NodeHealth[]): string {
        this.roundRobinIndex = (this.roundRobinIndex + 1) % nodes.length;
        return nodes[this.roundRobinIndex].name;
    }

    private selectLeastPlayers(nodes: NodeHealth[]): string {
        return nodes.reduce((min, node) =>
            node.players < min.players ? node : min
        ).name;
    }

    private selectLowestCpu(nodes: NodeHealth[]): string {
        return nodes.reduce((min, node) =>
            node.cpu < min.cpu ? node : min
        ).name;
    }

    private selectLowestMemory(nodes: NodeHealth[]): string {
        return nodes.reduce((min, node) =>
            node.memory.used < min.memory.used ? node : min
        ).name;
    }

    private selectRandom(nodes: NodeHealth[]): string {
        const randomIndex = Math.floor(Math.random() * nodes.length);
        return nodes[randomIndex].name;
    }

    private selectBestScore(nodes: NodeHealth[]): string {
        return nodes.reduce((best, node) =>
            node.score > best.score ? node : best
        ).name;
    }

    /**
     * Fallback khi không có healthy nodes
     */
    private getFallbackNode(): string | undefined {
        if (!this.kazagumo) return undefined;

        // Try to get any connected node
        for (const [name, node] of this.kazagumo.shoukaku.nodes) {
            if (node.state === 1) { // CONNECTED
                return name;
            }
        }

        // Last resort: return first node
        const firstNode = this.kazagumo.shoukaku.nodes.keys().next().value;
        return firstNode;
    }

    /**
     * Lấy danh sách healthy nodes
     */
    public getHealthyNodes(): NodeHealth[] {
        return Array.from(this.nodeHealth.values())
            .filter(node =>
                node.state === 'CONNECTED' &&
                node.score >= this.config.minHealthScore
            );
    }

    /**
     * Lấy tất cả nodes với health info
     */
    public getAllNodesHealth(): NodeHealth[] {
        return Array.from(this.nodeHealth.values());
    }

    /**
     * Lấy connected nodes
     */
    public getConnectedNodes(): NodeHealth[] {
        return Array.from(this.nodeHealth.values())
            .filter(node => node.state === 'CONNECTED');
    }

    // ============================================
    // FAILURE TRACKING
    // ============================================

    /**
     * Ghi nhận failure
     */
    public recordFailure(nodeName: string, _error?: Error): void {
        const health = this.nodeHealth.get(nodeName);
        if (!health) return;

        const wasHealthy = health.failureCount < this.config.failureThreshold;
        health.failureCount++;
        health.lastFailure = Date.now();
        health.score = this.calculateHealthScore(health);

        // Emit event when first reaching threshold (no log spam)
        if (wasHealthy && health.failureCount >= this.config.failureThreshold) {
            this.emit('nodeUnhealthy', { name: nodeName, reason: 'failure_threshold' });
        }
    }

    /**
     * Ghi nhận success
     */
    public recordSuccess(nodeName: string): void {
        const health = this.nodeHealth.get(nodeName);
        if (!health) return;

        health.lastSuccess = Date.now();

        // Gradually reduce failure count on success
        if (health.failureCount > 0) {
            health.failureCount = Math.max(0, health.failureCount - 1);
        }

        health.score = this.calculateHealthScore(health);
    }

    /**
     * Reset failure count cho node
     */
    public resetNodeFailures(nodeName: string): void {
        const health = this.nodeHealth.get(nodeName);
        if (health) {
            health.failureCount = 0;
            health.lastFailure = null;
            health.score = this.calculateHealthScore(health);
        }
    }

    // ============================================
    // HELPER METHODS
    // ============================================

    private updateNodeState(name: string, state: NodeHealth['state']): void {
        const health = this.nodeHealth.get(name);
        if (health) {
            health.state = state;
            health.score = this.calculateHealthScore(health);
        }
    }

    private getNodeState(state: number): NodeHealth['state'] {
        switch (state) {
            case 0: return 'CONNECTING';
            case 1: return 'CONNECTED';
            case 2: return 'DISCONNECTED';
            default: return 'RECONNECTING';
        }
    }

    private getNodeUrl(node: Node): string {
        const nodeAny = node as any;
        const host = nodeAny.options?.host || nodeAny.url || 'unknown';
        const port = nodeAny.options?.port || '';
        return `${host}${port ? ':' + port : ''}`;
    }

    /**
     * Update configuration
     */
    public updateConfig(config: Partial<NodeManagerConfig>): void {
        this.config = { ...this.config, ...config };

        // Restart health check with new interval if changed
        if (config.healthCheckInterval) {
            this.startHealthCheck();
        }
    }

    /**
     * Lấy statistics tổng hợp
     */
    public getStats(): {
        totalNodes: number;
        connectedNodes: number;
        healthyNodes: number;
        totalPlayers: number;
        averageScore: number;
    } {
        const allNodes = this.getAllNodesHealth();
        const connected = allNodes.filter(n => n.state === 'CONNECTED');
        const healthy = this.getHealthyNodes();

        return {
            totalNodes: allNodes.length,
            connectedNodes: connected.length,
            healthyNodes: healthy.length,
            totalPlayers: allNodes.reduce((sum, n) => sum + n.players, 0),
            averageScore: allNodes.length > 0
                ? Math.round(allNodes.reduce((sum, n) => sum + n.score, 0) / allNodes.length)
                : 0
        };
    }

    /**
     * Cleanup
     */
    public dispose(): void {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
        this.nodeHealth.clear();
        this.removeAllListeners();
        logger.info('NodeManager disposed');
    }
}

// Export singleton instance
export const NodeManager = NodeManagerClass.getInstance();
export default NodeManager;
