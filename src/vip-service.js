#!/usr/bin/env node
/**
 * Automated VIP Service
 */

require('dotenv').config();
const cron = require('node-cron');
const VIPManager = require('./vip-manager');

class VIPService {
    constructor() {
        this.vipManager = new VIPManager();
        this.backupSchedule = process.env.BACKUP_SCHEDULE || '0 2 * * *';
        this.alertSchedule = process.env.ALERT_SCHEDULE || '0 9 * * *';   
        this.retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS) || 30;
        this.isRunning = false;
    }

    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = {
            info: '🔄',
            success: '✅',
            error: '❌',
            warning: '⚠️'
        }[level] || 'ℹ️';
        
        console.log(`${timestamp} ${prefix} [SERVICE] ${message}`);
    }

    async performScheduledBackup() {
        try {
            this.log('Starting scheduled backup...');
            
            // Download VIP file
            const downloadResult = await this.vipManager.downloadVipFile();
            
            // Analyze VIP status
            const analysis = await this.vipManager.analyzeVips();
            
            // Cleanup old backups
            const deletedCount = await this.vipManager.cleanupOldBackups(this.retentionDays);
            
            this.log('Scheduled backup completed successfully', 'success');
            
            // Send summary notification
            await this.vipManager.sendDiscordNotification(
                'Scheduled Backup Complete',
                `✅ **Backup Summary**\n📁 VIP file backed up\n📊 ${analysis.total} VIPs analyzed\n🧹 ${deletedCount} old files cleaned`,
                0x00FF00
            );

        } catch (error) {
            this.log(`Scheduled backup failed: ${error.message}`, 'error');
            await this.vipManager.sendDiscordNotification(
                'Backup Failed',
                `❌ Scheduled backup failed: ${error.message}`,
                0xFF0000
            );
        }
    }

    async performHealthCheck() {
        try {
            this.log('Performing health check...');
            
            const connectionTest = await this.vipManager.testConnection();
            if (!connectionTest.connected) {
                throw new Error(connectionTest.error);
            }
            
            const analysis = await this.vipManager.analyzeVips();

            // Check for critical issues
            const criticalIssues = [];
            
            if (analysis.expiringToday > 0) {
                criticalIssues.push(`🚨 ${analysis.expiringToday} VIPs expire TODAY`);
            }
            
            if (analysis.expired > 0) {
                criticalIssues.push(`❌ ${analysis.expired} VIPs have expired`);
            }
            
            if (analysis.expiringSoon > 0) {
                criticalIssues.push(`⚠️ ${analysis.expiringSoon} VIPs expire within 7 days`);
            }

            // Send alerts if needed
            if (criticalIssues.length > 0) {
                await this.vipManager.sendDiscordNotification(
                    'VIP Alert',
                    `🔔 **VIP Status Alert**\n${criticalIssues.join('\n')}`,
                    0xFF8C00
                );
            }

            this.log(`Health check completed - ${analysis.total} VIPs checked`, 'success');

        } catch (error) {
            this.log(`Health check failed: ${error.message}`, 'error');
            await this.vipManager.sendDiscordNotification(
                'Health Check Failed',
                `❌ VIP health check failed: ${error.message}`,
                0xFF0000
            );
        }
    }

    start() {
        if (this.isRunning) {
            this.log('Service is already running', 'warning');
            return;
        }

        this.log('Starting VIP Service...');
        this.log(`Backup schedule: ${this.backupSchedule}`);
        this.log(`Alert schedule: ${this.alertSchedule}`);
        this.log(`Retention period: ${this.retentionDays} days`);

        // Validate cron expressions
        if (!cron.validate(this.backupSchedule)) {
            throw new Error(`Invalid backup schedule: ${this.backupSchedule}`);
        }
        if (!cron.validate(this.alertSchedule)) {
            throw new Error(`Invalid alert schedule: ${this.alertSchedule}`);
        }

        // Schedule backup task
        const backupTask = cron.schedule(this.backupSchedule, () => {
            this.performScheduledBackup();
        }, {
            scheduled: false,
            timezone: process.env.TIMEZONE || 'UTC'
        });

        // Schedule health check task
        const healthTask = cron.schedule(this.alertSchedule, () => {
            this.performHealthCheck();
        }, {
            scheduled: false,
            timezone: process.env.TIMEZONE || 'UTC'
        });

        // Start tasks
        backupTask.start();
        healthTask.start();

        this.isRunning = true;
        this.log('VIP Service started successfully', 'success');

        // Send startup notification
        this.vipManager.sendDiscordNotification(
            'VIP Service Started',
            `🚀 **VIP Service Online**\n📅 Backup: ${this.backupSchedule}\n🔔 Health checks: ${this.alertSchedule}`,
            0x00FF00
        );

        // Perform initial health check after 30 seconds
        setTimeout(() => {
            this.performHealthCheck();
        }, 30000);

        // Handle graceful shutdown
        process.on('SIGINT', () => {
            this.log('Received SIGINT, shutting down gracefully...');
            this.stop();
            process.exit(0);
        });

        process.on('SIGTERM', () => {
            this.log('Received SIGTERM, shutting down gracefully...');
            this.stop();
            process.exit(0);
        });
    }

    stop() {
        if (!this.isRunning) {
            this.log('Service is not running', 'warning');
            return;
        }

        this.log('Stopping VIP Service...');
        cron.getTasks().forEach(task => task.stop());
        this.isRunning = false;
        this.log('VIP Service stopped', 'success');
    }

    async status() {
        try {
            const connectionTest = await this.vipManager.testConnection();
            const analysis = await this.vipManager.analyzeVips();

            console.log('\n📊 VIP Service Status');
            console.log('=====================');
            console.log(`🔄 Service Running: ${this.isRunning ? 'Yes' : 'No'}`);
            console.log(`🌐 Server: ${connectionTest.serverName || 'Unknown'}`);
            console.log(`👥 Players: ${connectionTest.playerCount || 0}/${connectionTest.maxPlayers || 0}`);
            console.log(`🎖️ Total VIPs: ${analysis.total}`);
            console.log(`⚠️ Needs Attention: ${analysis.expired + analysis.expiringToday + analysis.expiringSoon}`);
            console.log(`📅 Next Backup: ${this.backupSchedule}`);
            console.log(`🔔 Next Health Check: ${this.alertSchedule}`);

        } catch (error) {
            console.error(`❌ Status check failed: ${error.message}`);
        }
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    const service = new VIPService();

    try {
        switch (command) {
            case 'start':
                service.start();
                // Keep process alive
                process.stdin.resume();
                break;

            case 'backup':
                await service.performScheduledBackup();
                break;

            case 'check':
                await service.performHealthCheck();
                break;

            case 'status':
                await service.status();
                break;

            case 'test':
                await service.vipManager.sendDiscordNotification(
                    'Service Test',
                    '🧪 VIP Service test notification - all systems operational!'
                );
                console.log('✅ Test notification sent');
                break;

            default:
                console.log('🎖️  VIP Service - Automated VIP Management');
                console.log('==========================================');
                console.log('');
                console.log('Commands:');
                console.log('  start   - Start the automated service (runs continuously)');
                console.log('  backup  - Perform manual backup now');
                console.log('  check   - Perform manual health check now');
                console.log('  status  - Show current service status');
                console.log('  test    - Test Discord notifications');
        }
    } catch (error) {
        console.error(`❌ Service failed: ${error.message}`);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = VIPService;
