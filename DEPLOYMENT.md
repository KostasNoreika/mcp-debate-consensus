# Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the AI Expert Consensus MCP server in production environments. It covers Docker deployment, environment configuration, security hardening, and monitoring setup.

## 📋 Prerequisites

### System Requirements

- **Node.js**: 18.0 or higher
- **Memory**: 2GB RAM minimum, 4GB recommended
- **Storage**: 1GB for application, additional for logs and database
- **Network**: Internet access for OpenRouter API
- **Ports**: 3457-3464 for proxy servers, configurable main port

### Required Services

- **Reverse Proxy**: Nginx, Traefik, or similar for SSL termination
- **Process Manager**: PM2, systemd, or Docker for process management
- **Monitoring**: Optional but recommended for production

## 🐳 Docker Deployment

### Docker Compose Configuration

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  debate-consensus:
    image: debate-consensus:latest
    container_name: debate-consensus-server
    restart: unless-stopped
    ports:
      - "3457:3457"
      - "3458:3458"
      - "3459:3459"
      - "3460:3460"
      - "3461:3461"
      - "3462:3462"
      - "3463:3463"
    environment:
      - NODE_ENV=production
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
      - HMAC_SECRET=${HMAC_SECRET}
      - ENABLE_REQUEST_SIGNING=true
      - TELEMETRY_DISABLED=${TELEMETRY_DISABLED:-false}
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
      - ./cache:/app/cache
    networks:
      - debate-network
    labels:
      # Traefik labels for automatic SSL and routing
      - "traefik.enable=true"
      - "traefik.http.routers.debate-api.rule=Host(`api.yourdomain.com`)"
      - "traefik.http.routers.debate-api.tls.certresolver=letsencrypt"
      - "traefik.http.services.debate-api.loadbalancer.server.port=3457"

  # Optional: Separate proxy container for scaling
  debate-proxy:
    image: debate-consensus:latest
    container_name: debate-proxy-server
    restart: unless-stopped
    command: ["node", "k-proxy-server.js"]
    ports:
      - "3457-3463:3457-3463"
    environment:
      - NODE_ENV=production
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
    networks:
      - debate-network

networks:
  debate-network:
    driver: bridge

volumes:
  debate-data:
  debate-logs:
  debate-cache:
```

### Dockerfile

Create `Dockerfile`:

```dockerfile
FROM node:18-alpine

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite \
    curl

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p data logs cache

# Set permissions
RUN chown -R node:node /app

# Switch to non-root user
USER node

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node health-check.js || exit 1

# Expose ports
EXPOSE 3457 3458 3459 3460 3461 3462 3463

# Start the application
CMD ["npm", "start"]
```

### Build and Deploy

```bash
# Build the Docker image
docker build -t debate-consensus:latest .

# Create environment file
cp .env.example .env.production
# Edit .env.production with production values

# Deploy with Docker Compose
docker-compose --env-file .env.production up -d

# Check logs
docker-compose logs -f debate-consensus

# Health check
docker-compose exec debate-consensus node health-check.js
```

## 🔧 Environment Configuration

### Production Environment File

Create `.env.production`:

```bash
# === REQUIRED PRODUCTION SETTINGS ===
NODE_ENV=production
OPENROUTER_API_KEY=sk-or-v1-your-production-key-here

# === SECURITY (REQUIRED FOR PRODUCTION) ===
HMAC_SECRET=your-64-character-production-secret-here
ENABLE_REQUEST_SIGNING=true
SIGNATURE_VALIDITY_WINDOW=300

# === PERFORMANCE TUNING ===
DEBATE_TIMEOUT_MINUTES=30
MAX_RETRIES=3
INITIAL_RETRY_DELAY=2000
MAX_RETRY_DELAY=60000
BACKOFF_MULTIPLIER=2

# === RATE LIMITING ===
RATE_LIMIT_MAX_REQUESTS=50
RATE_LIMIT_WINDOW_MS=60000

# === LOGGING AND MONITORING ===
TELEMETRY_DISABLED=false
SECURITY_DEBUG=false
RETRY_LOGGING=true

# === OPTIONAL OVERRIDES ===
PROXY_PORT=3456
MIN_MODELS_REQUIRED=2
```

### Security Secret Generation

Generate production secrets:

```bash
# Generate HMAC secret (64 characters)
openssl rand -hex 32

# Or use the built-in generator
npm run security:generate-secret

# Verify secret strength
echo "your-secret" | wc -c  # Should be 64+ characters
```

## 🌐 Reverse Proxy Configuration

### Nginx Configuration

Create `/etc/nginx/sites-available/debate-consensus`:

```nginx
upstream debate_consensus {
    least_conn;
    server 127.0.0.1:3457 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3458 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3459 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3460 max_fails=3 fail_timeout=30s;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    # SSL Configuration
    ssl_certificate /path/to/certificate.pem;
    ssl_certificate_key /path/to/private-key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self' https:; script-src 'self'; style-src 'self' 'unsafe-inline';" always;

    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/m;
    limit_req zone=api burst=20 nodelay;

    # Main API endpoint
    location /v1/ {
        proxy_pass http://debate_consensus;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;

        # Buffer configuration
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }

    # Health check endpoint (no rate limiting)
    location /health {
        proxy_pass http://127.0.0.1:3457;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Security status (requires authentication)
    location /security/ {
        proxy_pass http://127.0.0.1:3457;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;

        # Additional security for admin endpoints
        allow 192.168.1.0/24;  # Adjust to your admin network
        deny all;
    }
}

# Redirect HTTP to HTTPS
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}
```

### Traefik Configuration

Create `traefik.yml`:

```yaml
# Traefik configuration for automatic SSL
api:
  dashboard: true
  debug: true

entryPoints:
  web:
    address: ":80"
  websecure:
    address: ":443"

providers:
  docker:
    endpoint: "unix:///var/run/docker.sock"
    exposedByDefault: false

certificatesResolvers:
  letsencrypt:
    acme:
      email: your-email@domain.com
      storage: acme.json
      httpChallenge:
        entryPoint: web

# Automatic HTTP to HTTPS redirect
http:
  middlewares:
    default-headers:
      headers:
        frameDeny: true
        sslRedirect: true
        browserXssFilter: true
        contentTypeNosniff: true
        forceSTSHeader: true
        stsIncludeSubdomains: true
        stsPreload: true
        stsSeconds: 31536000

    secure-headers:
      headers:
        customRequestHeaders:
          X-Forwarded-Proto: https
```

## 🔄 Process Management

### PM2 Configuration

Create `ecosystem.config.js`:

```javascript
module.exports = {
  apps: [
    {
      name: 'debate-consensus-main',
      script: 'index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production'
      },
      log_file: './logs/combined.log',
      out_file: './logs/out.log',
      error_file: './logs/error.log',
      time: true,
      max_memory_restart: '1G',
      node_args: '--max-old-space-size=1024'
    },
    {
      name: 'debate-consensus-proxy',
      script: 'k-proxy-server.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      log_file: './logs/proxy-combined.log',
      out_file: './logs/proxy-out.log',
      error_file: './logs/proxy-error.log',
      time: true,
      max_memory_restart: '512M'
    }
  ]
};
```

### SystemD Service

Create `/etc/systemd/system/debate-consensus.service`:

```ini
[Unit]
Description=AI Expert Consensus MCP Server
After=network.target

[Service]
Type=simple
User=debate
WorkingDirectory=/opt/debate-consensus
Environment=NODE_ENV=production
EnvironmentFile=/opt/debate-consensus/.env.production
ExecStart=/usr/bin/node index.js
ExecStartPre=/usr/bin/node health-check.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=debate-consensus

# Security settings
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/opt/debate-consensus/data /opt/debate-consensus/logs /opt/debate-consensus/cache

# Resource limits
LimitNOFILE=65536
MemoryMax=2G

[Install]
WantedBy=multi-user.target
```

## 📊 Monitoring and Logging

### Health Check Setup

Create automated health checks:

```bash
#!/bin/bash
# health-monitor.sh

ENDPOINTS=(
  "http://localhost:3457/health"
  "http://localhost:3458/health"
  "http://localhost:3459/health"
  "http://localhost:3460/health"
)

for endpoint in "${ENDPOINTS[@]}"; do
  if ! curl -sf "$endpoint" > /dev/null; then
    echo "ALERT: $endpoint is down" | mail -s "Service Alert" admin@yourdomain.com
    # Restart service if needed
    systemctl restart debate-consensus
  fi
done
```

### Log Rotation

Configure log rotation in `/etc/logrotate.d/debate-consensus`:

```
/opt/debate-consensus/logs/*.log {
  daily
  rotate 30
  compress
  delaycompress
  missingok
  notifempty
  create 644 debate debate
  postrotate
    systemctl reload debate-consensus
  endscript
}
```

### Monitoring Script

Create `monitor.js`:

```javascript
#!/usr/bin/env node

import { exec } from 'child_process';
import http from 'http';

class ProductionMonitor {
  async checkHealth() {
    const endpoints = [
      'http://localhost:3457/health',
      'http://localhost:3458/health',
      'http://localhost:3459/health',
      'http://localhost:3460/health'
    ];

    const results = await Promise.allSettled(
      endpoints.map(url => this.checkEndpoint(url))
    );

    const failures = results
      .map((result, index) => ({ result, endpoint: endpoints[index] }))
      .filter(({ result }) => result.status === 'rejected');

    if (failures.length > 0) {
      console.error('Health check failures:', failures);
      this.alertAdministrators(failures);
    } else {
      console.log('All endpoints healthy');
    }
  }

  async checkEndpoint(url) {
    return new Promise((resolve, reject) => {
      const req = http.get(url, { timeout: 5000 }, (res) => {
        if (res.statusCode === 200) {
          resolve(url);
        } else {
          reject(new Error(`HTTP ${res.statusCode}`));
        }
      });

      req.on('error', reject);
      req.on('timeout', () => reject(new Error('Timeout')));
    });
  }

  alertAdministrators(failures) {
    // Send alerts via email, Slack, etc.
    console.error('PRODUCTION ALERT: Service failures detected');
    failures.forEach(({ endpoint, result }) => {
      console.error(`  ${endpoint}: ${result.reason.message}`);
    });
  }
}

// Run monitoring check
const monitor = new ProductionMonitor();
monitor.checkHealth().catch(console.error);
```

## 🔒 Security Hardening

### Firewall Configuration

```bash
# UFW (Ubuntu) firewall rules
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (adjust port as needed)
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow application ports (only from reverse proxy)
sudo ufw allow from 127.0.0.1 to any port 3457:3463

# Enable firewall
sudo ufw enable
```

### SSL/TLS Configuration

Best practices for SSL configuration:

1. **Use Let's Encrypt** for free SSL certificates
2. **Enable HSTS** with long max-age
3. **Disable older TLS versions** (< 1.2)
4. **Use strong cipher suites**
5. **Enable OCSP stapling**

### User Permissions

Create dedicated user for the application:

```bash
# Create user
sudo useradd -r -s /bin/false -d /opt/debate-consensus debate

# Set permissions
sudo chown -R debate:debate /opt/debate-consensus
sudo chmod 755 /opt/debate-consensus
sudo chmod 600 /opt/debate-consensus/.env.production
```

## 📈 Scaling and Performance

### Horizontal Scaling

For high-load environments, consider:

1. **Multiple Instances**: Run multiple server instances behind a load balancer
2. **Database Separation**: Use external SQLite or migrate to PostgreSQL
3. **Cache Clustering**: Redis for shared caching across instances
4. **CDN Integration**: Cache static responses via CDN

### Load Balancer Configuration

Example HAProxy configuration:

```
global
  maxconn 4096

defaults
  mode http
  timeout connect 5000ms
  timeout client 50000ms
  timeout server 50000ms

frontend api_frontend
  bind *:80
  bind *:443 ssl crt /etc/ssl/certs/api.yourdomain.com.pem
  redirect scheme https if !{ ssl_fc }
  default_backend api_servers

backend api_servers
  balance leastconn
  option httpchk GET /health
  server api1 127.0.0.1:3457 check
  server api2 127.0.0.1:3458 check
  server api3 127.0.0.1:3459 check
```

## 🚀 Deployment Scripts

### Automated Deployment Script

Create `deploy.sh`:

```bash
#!/bin/bash
set -e

# Deployment configuration
DEPLOY_DIR="/opt/debate-consensus"
SERVICE_NAME="debate-consensus"
BACKUP_DIR="/opt/backups/debate-consensus"

echo "🚀 Starting deployment..."

# Create backup
echo "📦 Creating backup..."
mkdir -p "$BACKUP_DIR/$(date +%Y%m%d_%H%M%S)"
cp -r "$DEPLOY_DIR/data" "$BACKUP_DIR/$(date +%Y%m%d_%H%M%S)/"

# Stop services
echo "⏹️  Stopping services..."
systemctl stop "$SERVICE_NAME"

# Update code
echo "📥 Updating code..."
cd "$DEPLOY_DIR"
git pull origin main

# Install dependencies
echo "📦 Installing dependencies..."
npm ci --production

# Run health check
echo "🏥 Running health check..."
node health-check.js

# Start services
echo "▶️  Starting services..."
systemctl start "$SERVICE_NAME"

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Final health check
echo "🔍 Final health check..."
if curl -sf http://localhost:3457/health > /dev/null; then
  echo "✅ Deployment successful!"
else
  echo "❌ Deployment failed - rolling back..."
  systemctl stop "$SERVICE_NAME"
  # Restore from backup logic here
  exit 1
fi
```

### Blue-Green Deployment

For zero-downtime deployments:

```bash
#!/bin/bash
# blue-green-deploy.sh

BLUE_PORT=3457
GREEN_PORT=3467
CURRENT_PORT=$(cat /tmp/current_port || echo $BLUE_PORT)
NEW_PORT=$([[ $CURRENT_PORT == $BLUE_PORT ]] && echo $GREEN_PORT || echo $BLUE_PORT)

# Deploy to inactive environment
PORT=$NEW_PORT npm start &
NEW_PID=$!

# Health check new deployment
if curl -sf "http://localhost:$NEW_PORT/health"; then
  # Switch traffic
  echo $NEW_PORT > /tmp/current_port
  # Update load balancer configuration
  # ...

  # Stop old version
  if [[ $CURRENT_PORT != $NEW_PORT ]]; then
    pkill -f "PORT=$CURRENT_PORT"
  fi

  echo "Deployment successful on port $NEW_PORT"
else
  kill $NEW_PID
  echo "Deployment failed, keeping current version on port $CURRENT_PORT"
  exit 1
fi
```

## 🔧 Troubleshooting

### Common Issues

1. **Port conflicts**: Check if ports 3457-3463 are available
2. **Permission issues**: Ensure correct file permissions
3. **Memory issues**: Monitor memory usage, adjust limits
4. **SSL certificate issues**: Check certificate validity and paths

### Debug Mode

Enable debug mode for troubleshooting:

```bash
# Enable detailed logging
NODE_ENV=development npm start

# Check specific components
npm run test:security
npm run test:retry
node health-check.js
```

### Log Analysis

Monitor logs for issues:

```bash
# Follow application logs
tail -f logs/combined.log

# Check for errors
grep -i "error\|fail\|exception" logs/combined.log

# Monitor security events
grep -i "security\|auth\|rate" logs/combined.log
```

## 📞 Production Support

### Incident Response

1. **Check health endpoints**: Verify service status
2. **Review logs**: Look for error patterns
3. **Check resources**: Monitor CPU, memory, disk usage
4. **Verify external services**: Ensure OpenRouter API is accessible
5. **Rollback if needed**: Use backup deployment

### Monitoring Alerts

Set up alerts for:

- Service downtime
- High error rates (>5%)
- High response times (>60s)
- Memory usage (>80%)
- Disk space (>90%)
- Security events

---

This deployment guide provides a comprehensive foundation for running AI Expert Consensus in production. Adjust configurations based on your specific infrastructure and requirements.