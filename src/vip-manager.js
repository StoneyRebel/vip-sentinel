#!/usr/bin/env node
/**
 * VIP Manager for Hell Let Loose CRCON - API Token Authentication Only
 */

require('dotenv').config();
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class VIPManager {
    constructor() {
        this.baseUrl = process.env.CRCON_BASE_URL || 'http://localhost:8010';
        this.apiToken = process.env.CRCON_API_TOKEN;
        this.backupDir = './backups';
        this.webhookUrl = process.env.DISCORD_WEBHOOK_URL;
        this.timeout = 15000;
    }

    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = {
            info: '📋',
            success: '✅',
            error: '❌',
            warning: '⚠️'
        }[level] || 'ℹ️';
        
        console.log(`${timestamp} ${prefix} ${message}`);
    }

    async makeRequest(endpoint, method = 'GET', data = null) {
        if (!this.apiToken) {
            throw new Error('CRCON_API_TOKEN is required for bot authentication');
        }

        const config = {
            method,
            url: `${this.baseUrl}${endpoint}`,
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiToken}`
            },
            timeout: this.timeout
        };

        if (method === 'POST' && data) {
            config.data = data;
        } else if (method === 'GET' && data) {
            const params = new URLSearchParams(data);
            config.url += `?${params.toString()}`;
        }

        try {
            this.log(`Making ${method} request to ${endpoint}`, 'info');
            const response = await axios(config);
            
            // Handle CRCON response format
            if (response.data && typeof response.data === 'object' && 'result' in response.data) {
                if (response.data.failed) {
                    throw new Error(response.data.error || 'CRCON request failed');
                }
                return response.data.result;
            }
            
            return response.data;
        } catch (error) {
            if (error.response?.status === 401) {
                throw new Error('API token authentication failed - check your CRCON_API_TOKEN');
            }
            if (error.response?.status === 403) {
                throw new Error('API token does not have required permissions');
            }
            if (error.response?.data?.error) {
                throw new Error(`CRCON error: ${error.response.data.error}`);
            }
            throw new Error(`Request failed: ${error.message}`);
        }
    }

    async sendDiscordNotification(title, description, color = 0x00D4FF) {
        if (!this.webhookUrl) {
            this.log('No Discord webhook configured, skipping notification', 'info');
            return;
        }

        try {
            await axios.post(this.webhookUrl, {
                embeds: [{
                    title: `🎖️ ${title}`,
                    description: description,
                    color: color,
                    timestamp: new Date().toISOString(),
                    footer: { text: 'VIP Manager System' }
                }]
            });
            this.log('Discord notification sent successfully', 'success');
        } catch (error) {
            this.log(`Failed to send Discord notification: ${error.message}`, 'warning');
        }
    }

    async testConnection() {
        try {
            this.log('Testing CRCON connection...');
            const status = await this.makeRequest('/api/get_status');
            
            if (status) {
                const serverName = status.name || 'Unknown Server';
                const playerCount = status.player_count || 0;
                const maxPlayers = status.player_count_max || 0;
                
                this.log(`✅ Connected to: ${serverName}`, 'success');
                this.log(`👥 Players: ${playerCount}/${maxPlayers}`, 'info');
                
                return { serverName, playerCount, maxPlayers, connected: true };
            } else {
                throw new Error('No status data received');
            }
        } catch (error) {
            this.log(`❌ Connection test failed: ${error.message}`, 'error');
            return { connected: false, error: error.message };
        }
    }

    async downloadVipFile() {
        try {
            this.log('Downloading VIP file from CRCON...');
            
            // Try the download endpoint first
            let vipData;
            try {
                vipData = await this.makeRequest('/api/download_vips');
                this.log('VIP file downloaded via download_vips endpoint', 'success');
            } catch (error) {
                this.log('Download endpoint failed, trying VIP list endpoint...', 'warning');
                // Fallback to getting VIP list and formatting it
                const vipList = await this.makeRequest('/api/get_vip_ids');
                if (vipList && Array.isArray(vipList)) {
                    vipData = this.formatVipList(vipList);
                    this.log('VIP list retrieved and formatted', 'success');
                } else {
                    throw new Error('No VIP data available from either endpoint');
                }
            }

            if (!vipData) {
                throw new Error('No VIP file data received');
            }

            // Ensure backup directory exists
            await fs.mkdir(this.backupDir, { recursive: true });

            // Save with timestamp
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `vip_file_${timestamp}.txt`;
            const filepath = path.join(this.backupDir, filename);

            await fs.writeFile(filepath, vipData);

            this.log(`VIP file saved: ${filename}`, 'success');
            this.log(`File path: ${filepath}`, 'info');
            this.log(`File size: ${vipData.length} bytes`, 'info');

            await this.sendDiscordNotification(
                'VIP File Downloaded',
                `✅ VIP file backed up successfully\n📁 **File:** ${filename}\n📊 **Size:** ${vipData.length} bytes`,
                0x00FF00
            );

            return { filepath, filename, size: vipData.length };
        } catch (error) {
            this.log(`Download failed: ${error.message}`, 'error');
            await this.sendDiscordNotification(
                'VIP Download Failed',
                `❌ ${error.message}`,
                0xFF0000
            );
            throw error;
        }
    }

    formatVipList(vipList) {
        let formatted = `# VIP File Generated ${new Date().toISOString()}\n`;
        formatted += `# Total VIPs: ${vipList.length}\n`;
        formatted += `# Format: STEAM_ID_64 # Player_Name (expiration)\n\n`;

        vipList.forEach(vip => {
            const expiration = vip.expiration && vip.expiration !== 'None' 
                ? ` (expires: ${vip.expiration})` 
                : ' (permanent)';
            const description = vip.description ? ` - ${vip.description}` : '';
            formatted += `${vip.player_id} # ${vip.name}${expiration}${description}\n`;
        });

        return formatted;
    }

    async analyzeVips() {
        try {
            this.log('Analyzing VIP data...');
            const vipList = await this.makeRequest('/api/get_vip_ids');

            if (!vipList || !Array.isArray(vipList)) {
                throw new Error('No VIP data available');
            }

            const now = new Date();
            const analysis = {
                total: vipList.length,
                permanent: 0,
                temporary: 0,
                expired: 0,
                expiringSoon: 0,
                expiringToday: 0,
                platforms: { pc: 0, console: 0, unknown: 0 }
            };

            const alerts = [];

            vipList.forEach(vip => {
                // Platform detection
                if (vip.player_id.startsWith('76561198')) {
                    analysis.platforms.pc++;
                } else if (vip.player_id.startsWith('11000') || vip.player_id.startsWith('76561199')) {
                    analysis.platforms.console++;
                } else {
                    analysis.platforms.unknown++;
                }

                // Expiration analysis
                if (!vip.expiration || vip.expiration === 'None') {
                    analysis.permanent++;
                } else {
                    analysis.temporary++;
                    const expDate = new Date(vip.expiration);
                    const daysUntilExpiry = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));

                    if (daysUntilExpiry < 0) {
                        analysis.expired++;
                        alerts.push(`❌ **${vip.name}** expired ${Math.abs(daysUntilExpiry)} days ago`);
                    } else if (daysUntilExpiry === 0) {
                        analysis.expiringToday++;
                        alerts.push(`🚨 **${vip.name}** expires TODAY`);
                    } else if (daysUntilExpiry <= 7) {
                        analysis.expiringSoon++;
                        alerts.push(`⚠️ **${vip.name}** expires in ${daysUntilExpiry} days`);
                    }
                }
            });

            // Display analysis
            console.log('\n📊 VIP Analysis Report');
            console.log('========================');
            console.log(`👥 Total VIPs: ${analysis.total}`);
            console.log(`🔒 Permanent: ${analysis.permanent}`);
            console.log(`⏱️ Temporary: ${analysis.temporary}`);
            console.log(`❌ Expired: ${analysis.expired}`);
            console.log(`⚠️ Expiring Soon (≤7 days): ${analysis.expiringSoon}`);
            console.log(`🚨 Expiring Today: ${analysis.expiringToday}`);
            console.log(`💻 PC Players: ${analysis.platforms.pc}`);
            console.log(`🎮 Console Players: ${analysis.platforms.console}`);
            if (analysis.platforms.unknown > 0) {
                console.log(`❓ Unknown Platform: ${analysis.platforms.unknown}`);
            }

            // Save analysis report
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const reportPath = path.join(this.backupDir, `vip_analysis_${timestamp}.txt`);
            
            let reportContent = `VIP Analysis Report - ${new Date().toISOString()}\n`;
            reportContent += `Total VIPs: ${analysis.total}\n`;
            reportContent += `Permanent: ${analysis.permanent}\n`;
            reportContent += `Temporary: ${analysis.temporary}\n`;
            reportContent += `Expired: ${analysis.expired}\n`;
            reportContent += `Expiring Soon: ${analysis.expiringSoon}\n`;
            reportContent += `Expiring Today: ${analysis.expiringToday}\n\n`;
            
            if (alerts.length > 0) {
                reportContent += 'ALERTS:\n';
                alerts.forEach(alert => reportContent += `${alert}\n`);
            }

            await fs.mkdir(this.backupDir, { recursive: true });
            await fs.writeFile(reportPath, reportContent);

            // Send Discord notification for critical issues
            if (analysis.expired > 0 || analysis.expiringToday > 0 || analysis.expiringSoon > 0) {
                let notification = `📊 **VIP Status Alert**\n`;
                if (analysis.expiringToday > 0) notification += `🚨 ${analysis.expiringToday} expire TODAY\n`;
                if (analysis.expiringSoon > 0) notification += `⚠️ ${analysis.expiringSoon} expire within 7 days\n`;
                if (analysis.expired > 0) notification += `❌ ${analysis.expired} already expired\n`;
                
                await this.sendDiscordNotification('VIP Status Alert', notification, 0xFF8C00);
            }

            return analysis;
        } catch (error) {
            this.log(`Analysis failed: ${error.message}`, 'error');
            throw error;
        }
    }

    async cleanupOldBackups(keepDays = 30) {
        try {
            this.log(`Cleaning up backups older than ${keepDays} days...`);
            
            const files = await fs.readdir(this.backupDir).catch(() => []);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - keepDays);

            let deletedCount = 0;

            for (const file of files) {
                const filepath = path.join(this.backupDir, file);
                try {
                    const stats = await fs.stat(filepath);
                    
                    if (stats.mtime < cutoffDate) {
                        await fs.unlink(filepath);
                        deletedCount++;
                        this.log(`Deleted old backup: ${file}`);
                    }
                } catch (error) {
                    // Skip files we can't access
                    continue;
                }
            }

            this.log(`Cleanup complete: ${deletedCount} files removed`, 'success');
            return deletedCount;
        } catch (error) {
            this.log(`Cleanup failed: ${error.message}`, 'error');
            return 0;
        }
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    // Validate environment
    if (!process.env.CRCON_BASE_URL) {
        console.error('❌ CRCON_BASE_URL environment variable is required');
        process.exit(1);
    }

    if (!process.env.CRCON_API_TOKEN) {
        console.error('❌ CRCON_API_TOKEN environment variable is required');
        console.error('   Generate an API token in your CRCON web interface');
        process.exit(1);
    }

    const vipManager = new VIPManager();

    try {
        // Test connection first
        const connectionTest = await vipManager.testConnection();
        if (!connectionTest.connected) {
            throw new Error(connectionTest.error);
        }

        switch (command) {
            case 'test':
                console.log('✅ Connection test successful!');
                await vipManager.sendDiscordNotification(
                    'Test Notification',
                    '🧪 VIP Manager is working correctly!'
                );
                console.log('✅ Test notification sent');
                break;

            case 'download':
                await vipManager.downloadVipFile();
                break;
            
            case 'analyze':
                await vipManager.analyzeVips();
                break;
            
            case 'backup':
                console.log('🔄 Starting complete backup...');
                const downloadResult = await vipManager.downloadVipFile();
                const analysis = await vipManager.analyzeVips();
                console.log('\n✅ Complete backup finished!');
                break;
            
            case 'cleanup':
                const days = parseInt(args[1]) || 30;
                await vipManager.cleanupOldBackups(days);
                break;
            
            default:
                console.log('🎖️  VIP Manager for Hell Let Loose CRCON');
                console.log('==========================================');
                console.log('');
                console.log('Usage:');
                console.log('  node vip-manager.js test        - Test CRCON connection and Discord');
                console.log('  node vip-manager.js download    - Download and backup VIP file');
                console.log('  node vip-manager.js analyze     - Analyze VIP status and expiration');
                console.log('  node vip-manager.js backup      - Complete backup (download + analyze)');
                console.log('  node vip-manager.js cleanup [days] - Clean old backups (default: 30 days)');
                console.log('');
                console.log('Configuration:');
                console.log('  CRCON_BASE_URL     - Your CRCON server URL');
                console.log('  CRCON_API_TOKEN    - API token from CRCON web interface');
                console.log('  DISCORD_WEBHOOK_URL - Discord webhook for notifications (optional)');
                console.log('');
                console.log('Examples:');
                console.log('  node vip-manager.js test         # Test connection');
                console.log('  node vip-manager.js backup       # Download and analyze');
                console.log('  node vip-manager.js cleanup 7    # Clean backups older than 7 days');
        }
    } catch (error) {
        console.error(`❌ Operation failed: ${error.message}`);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = VIPManager;
