#!/usr/bin/env node
/**
 * VIP Manager Entry Point for Railway/Production Deployment
 */

require('dotenv').config();
const http = require('http');
const VIPService = require('./vip-service');

class VIPManagerApp {
    constructor() {
        this.port = process.env.PORT || 3000;
        this.vipService = new VIPService();
        this.server = null;
        this.isShuttingDown = false;
    }

    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = {
            info: '🚀',
            success: '✅',
            error: '❌',
            warning: '⚠️'
        }[level] || 'ℹ️';
        
        console.log(`${timestamp} ${prefix} [APP] ${message}`);
    }

    createHealthServer() {
        this.server = http.createServer(async (req, res) => {
            // Enable CORS
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

            if (req.method === 'OPTIONS') {
                res.writeHead(200);
                res.end();
                return;
            }

            // Route handling
            if (req.url === '/health') {
                await this.handleHealthCheck(req, res);
            } else if (req.url === '/status') {
                await this.handleStatus(req, res);
            } else if (req.url === '/') {
                await this.handleRoot(req, res);
            } else {
                res.writeHead(404, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Not Found' }));
            }
        });

        this.server.listen(this.port, () => {
            this.log(`Health server listening on port ${this.port}`, 'success');
        });
    }

    async handleHealthCheck(req, res) {
        try {
            // Test CRCON connection
            const connectionTest = await this.vipService.vipManager.testConnection();
            
            const health = {
                status: connectionTest.connected ? 'healthy' : 'unhealthy',
                timestamp: new Date().toISOString(),
                service: {
                    running: this.vipService.isRunning,
                    uptime: process.uptime()
                },
                crcon: {
                    connected: connectionTest.connected,
                    server: connectionTest.serverName || 'Unknown',
                    players: connectionTest.connected ? 
                        `${connectionTest.playerCount}/${connectionTest.maxPlayers}` : 'N/A'
                }
            };

            const statusCode = connectionTest.connected ? 200 : 503;
            res.writeHead(statusCode, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(health, null, 2));
        } catch (error) {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            }));
        }
    }

    async handleStatus(req, res) {
        try {
            const connectionTest = await this.vipService.vipManager.testConnection();
            const analysis = await this.vipService.vipManager.analyzeVips();

            const status = {
                service: {
                    running: this.vipService.isRunning,
                    uptime: process.uptime(),
                    version: require('../package.json').version,
                    nodeVersion: process.version,
                    environment: process.env.NODE_ENV || 'development'
                },
                crcon: {
                    connected: connectionTest.connected,
                    server: connectionTest.serverName || 'Unknown',
                    players: connectionTest.connected ? 
                        `${connectionTest.playerCount}/${connectionTest.maxPlayers}` : 'N/A'
                },
                vips: {
                    total: analysis.total,
                    permanent: analysis.permanent,
                    temporary: analysis.temporary,
                    expired: analysis.expired,
                    expiringToday: analysis.expiringToday,
                    expiringSoon: analysis.expiringSoon,
                    platforms: analysis.platforms
                },
                schedule: {
                    backup: this.vipService.backupSchedule,
                    alerts: this.vipService.alertSchedule,
                    retention: `${this.vipService.retentionDays} days`
                },
                timestamp: new Date().toISOString()
            };

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(status, null, 2));
        } catch (error) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                error: error.message,
                timestamp: new Date().toISOString()
            }));
        }
    }

    async handleRoot(req, res) {
        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>VIP Manager</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; color: #333; }
        .status { background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .links { display: flex; gap: 10px; justify-content: center; margin: 20px 0; }
        .btn { padding: 10px 20px; background: #007cba; color: white; text-decoration: none; border-radius: 5px; }
        .btn:hover { background: #005a87; }
        .footer { text-align: center; color: #666; margin-top: 30px; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎖️ VIP Manager</h1>
            <p>Hell Let Loose CRCON VIP Management System</p>
        </div>
        
        <div class="status">
            <strong>Service Status:</strong> ${this.vipService.isRunning ? '🟢 Running' : '🔴 Stopped'}<br>
            <strong>Uptime:</strong> ${Math.floor(process.uptime() / 60)} minutes<br>
            <strong>Environment:</strong> ${process.env.NODE_ENV || 'development'}
        </div>

        <div class="links">
            <a href="/health" class="btn">Health Check</a>
            <a href="/status" class="btn">Full Status</a>
            <a href="https://github.com/yourusername/vip-manager" class="btn">Documentation</a>
        </div>

        <div class="footer">
            <p>VIP Manager v${require('../package.json').version}</p>
            <p>Automated VIP management for Hell Let Loose servers</p>
        </div>
    </div>
</body>
</html>`;

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(html);
    }

    async start() {
        this.log('Starting VIP Manager Application...');
        
        // Validate environment
        if (!process.env.CRCON_BASE_URL) {
            throw new Error('CRCON_BASE_URL environment variable is required');
        }

        if (!process.env.CRCON_API_TOKEN) {
            throw new Error('CRCON_API_TOKEN environment variable is required');
        }

        // Test connection first
        try {
            const connectionTest = await this.vipService.vipManager.testConnection();
            if (!connectionTest.connected) {
                throw new Error(`CRCON connection failed: ${connectionTest.error}`);
            }
            this.log(`Connected to CRCON server: ${connectionTest.serverName}`, 'success');
        } catch (error) {
            this.log(`Initial connection test failed: ${error.message}`, 'error');
            // Continue anyway for Railway deployment - connection might be available later
        }

        // Start health server
        this.createHealthServer();

        // Start VIP service
        this.vipService.start();

        this.log('VIP Manager Application started successfully', 'success');
        this.log(`Health endpoint available at http://localhost:${this.port}/health`);
        this.log(`Status endpoint available at http://localhost:${this.port}/status`);

        // Handle graceful shutdown
        process.on('SIGINT', () => this.shutdown('SIGINT'));
        process.on('SIGTERM', () => this.shutdown('SIGTERM'));
        process.on('uncaughtException', (error) => {
            this.log(`Uncaught exception: ${error.message}`, 'error');
            this.shutdown('uncaughtException');
        });
        process.on('unhandledRejection', (reason, promise) => {
            this.log(`Unhandled rejection at ${promise}: ${reason}`, 'error');
        });
    }

    async shutdown(signal) {
        if (this.isShuttingDown) return;
        this.isShuttingDown = true;

        this.log(`Received ${signal}, shutting down gracefully...`);

        // Stop VIP service
        if (this.vipService) {
            this.vipService.stop();
        }

        // Close health server
        if (this.server) {
            this.server.close(() => {
                this.log('Health server closed');
            });
        }

        this.log('Shutdown complete');
        process.exit(0);
    }
}

// Start the application
if (require.main === module) {
    const app = new VIPManagerApp();
    app.start().catch(error => {
        console.error(`Failed to start application: ${error.message}`);
        process.exit(1);
    });
}

module.exports = VIPManagerApp;
