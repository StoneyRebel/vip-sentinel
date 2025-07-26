# 🎖️ VIP Manager for Hell Let Loose CRCON

An automated VIP management system for Hell Let Loose servers using CRCON. This bot handles VIP file backups, expiration monitoring, and Discord notifications.

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template/your-template-url)

## ✨ Features

- 🔄 **Automated VIP Backups** - Schedule regular downloads of VIP files
- ⏰ **Expiration Monitoring** - Track VIP expiration dates and send alerts
- 🔔 **Discord Notifications** - Get notified about VIP status and system events
- 🧹 **Automatic Cleanup** - Remove old backup files to save storage
- 📊 **VIP Analysis** - Detailed reports on VIP status and platform distribution
- 🛡️ **Health Monitoring** - Regular connection tests and status checks
- 🎮 **Platform Detection** - Identify PC vs Console players automatically

## 🚀 Quick Start with Railway

### One-Click Deploy

1. Click the "Deploy on Railway" button above
2. Connect your GitHub account
3. Set the required environment variables:
   - `CRCON_BASE_URL` - Your CRCON server URL
   - `CRCON_API_TOKEN` - API token from CRCON web interface
   - `DISCORD_WEBHOOK_URL` - Discord webhook URL (optional)
4. Deploy and start managing your VIPs!

### Manual Railway Setup

1. Fork this repository
2. Create a new Railway project
3. Connect your forked repository
4. Add environment variables (see Configuration section)
5. Deploy!

## 🛠️ Local Development

### Prerequisites

- Node.js 14 or higher
- Access to a Hell Let Loose CRCON instance
- Discord webhook URL (optional)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/vip-manager.git
cd vip-manager

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### Configuration

Create a `.env` file with the following variables:

```env
# Required
CRCON_BASE_URL=http://your-crcon-server:8010
CRCON_API_TOKEN=your_api_token_here

# Optional
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...
BACKUP_SCHEDULE=0 2 * * *
ALERT_SCHEDULE=0 9 * * *
BACKUP_RETENTION_DAYS=30
TIMEZONE=UTC
```

### Getting Your CRCON API Token

1. Open your CRCON web interface
2. Go to Settings → API Access
3. Generate a new API token
4. Copy the token to your `.env` file

## 📖 Usage

### Command Line Interface

```bash
# Test connection and Discord notifications
npm run test

# Download VIP file manually
npm run backup

# Analyze VIP status and expiration
npm run analyze

# Clean old backups (default: 30 days)
npm run cleanup

# Start automated service
npm start
```

### Automated Service

```bash
# Start service (runs continuously)
npm start

# Check service status
npm run status

# Test Discord notifications
node src/vip-service.js test
```

## ⚙️ Configuration Options

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CRCON_BASE_URL` | ✅ | - | Your CRCON server URL |
| `CRCON_API_TOKEN` | ✅ | - | API token from CRCON |
| `DISCORD_WEBHOOK_URL` | ❌ | - | Discord webhook for notifications |
| `BACKUP_SCHEDULE` | ❌ | `0 2 * * *` | When to run backups (daily 2 AM) |
| `ALERT_SCHEDULE` | ❌ | `0 9 * * *` | When to check VIP status (daily 9 AM) |
| `BACKUP_RETENTION_DAYS` | ❌ | `30` | How long to keep backup files |
| `TIMEZONE` | ❌ | `UTC` | Timezone for scheduling |
| `PORT` | ❌ | `3000` | Port for health checks (Railway) |

## 🔔 Discord Notifications

### Setting Up Discord Webhook

1. In Discord, go to Server Settings → Integrations → Webhooks
2. Create a new webhook
3. Copy the webhook URL
4. Add it to your `.env` file as `DISCORD_WEBHOOK_URL`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the ISC License.

## 🆘 Support

- **Issues**: Report bugs or request features via GitHub Issues
- **Documentation**: Check this README for setup and usage instructions

Your VIP Manager is now ready for deployment! 🎉
# vip-sentinel
