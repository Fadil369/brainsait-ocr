# BrainSAIT OCR Installation Guide

This guide provides multiple ways to install and deploy BrainSAIT OCR based on your needs.

## 📦 Available Packages

| Package Type | Description | Best For |
|-------------|-------------|----------|
| **Source** | Complete repository | Development, customization |
| **Deployment** | Production-ready files | Cloudflare deployment |
| **Docker** | Container build context | Containerized deployment |
| **Standalone** | Self-contained distribution | Quick local setup |

## 🚀 Quick Start Options

### Option 1: GitHub Clone (Recommended for Development)

```bash
# Clone the repository
git clone https://github.com/Fadil369/brainsait-ocr.git
cd brainsait-ocr

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your API keys

# Deploy to Cloudflare
npm run worker:deploy
npm run deploy
```

### Option 2: Standalone Package

```bash
# Download and extract
curl -L https://github.com/Fadil369/brainsait-ocr/releases/download/v1.0.1/brainsait-ocr-v1.0.1-standalone.tar.gz | tar -xz

# Enter directory
cd standalone

# Run setup
chmod +x setup.sh
./setup.sh

# Configure and deploy
# Edit wrangler.toml with your settings
npm run worker:deploy
```

### Option 3: Docker Container

```bash
# Download Docker package
curl -L -o brainsait-ocr-docker.tar.gz https://github.com/Fadil369/brainsait-ocr/releases/download/v1.0.1/brainsait-ocr-v1.0.1-docker.tar.gz

# Extract and build
tar -xzf brainsait-ocr-docker.tar.gz
cd docker

# Build container
docker build -t brainsait-ocr .

# Run container
docker run -p 8787:8787 \
  -e JWT_SECRET=your_jwt_secret \
  -e MISTRAL_API_KEY=your_mistral_key \
  brainsait-ocr
```

### Option 4: Deployment Package (Production)

```bash
# Download deployment package
curl -L -o brainsait-ocr-deployment.tar.gz https://github.com/Fadil369/brainsait-ocr/releases/download/v1.0.1/brainsait-ocr-v1.0.1-deployment.tar.gz

# Extract
tar -xzf brainsait-ocr-deployment.tar.gz
cd deployment

# Install production dependencies
npm ci --only=production

# Configure wrangler.toml and deploy
wrangler deploy
```

## 🔧 Environment Configuration

### Required Environment Variables

```bash
# JWT Secret (generate with: openssl rand -base64 32)
JWT_SECRET=your_super_secret_jwt_key

# Mistral AI API Key
MISTRAL_API_KEY=your_mistral_api_key
```

### Cloudflare Configuration

1. **D1 Database Setup**:
```bash
# Create database
wrangler d1 create brainsait-ocr-db

# Update wrangler.toml with the database ID
# Initialize schema
wrangler d1 execute brainsait-ocr-db --file=./schema.sql
```

2. **KV Namespaces**:
```bash
# Create KV namespaces
wrangler kv:namespace create "CACHE"
wrangler kv:namespace create "SESSIONS"

# Update wrangler.toml with the namespace IDs
```

3. **Domain Setup** (Optional):
```bash
# Add custom domain to Pages
wrangler pages project create brainsait-ocr
wrangler pages deploy ./public --project-name=brainsait-ocr
```

## 🌍 Deployment Targets

### Cloudflare Workers + Pages (Recommended)

```bash
# Deploy worker (backend)
npm run worker:deploy

# Deploy pages (frontend)  
npm run deploy
```

### Local Development

```bash
# Start local development
npm run dev              # Frontend on :3000
npm run worker:dev       # Worker on :8787
```

### Docker Compose

```yaml
# docker-compose.yml
version: '3.8'
services:
  brainsait-ocr:
    build: .
    ports:
      - "8787:8787"
    environment:
      - JWT_SECRET=your_jwt_secret
      - MISTRAL_API_KEY=your_mistral_key
    restart: unless-stopped
```

## 📋 Verification

### Health Check

```bash
# Check API health
curl https://your-worker-url.workers.dev/health

# Expected response:
# {"status":"healthy","service":"BrainSAIT OCR Worker","timestamp":"..."}
```

### Test Admin Access

```bash
# Test super admin login
curl -X POST https://your-worker-url.workers.dev/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@brainsait.com","password":"admin123456"}'
```

## 🔒 Security Setup

### SSL/TLS (Automatic with Cloudflare)
- Cloudflare automatically provides SSL certificates
- Enable "Always Use HTTPS" in Cloudflare dashboard

### CORS Configuration
```javascript
// Already configured in worker.js
origin: [
  'https://your-domain.pages.dev',
  'https://your-custom-domain.com'
]
```

### Rate Limiting (Optional)
```bash
# Enable Cloudflare rate limiting
# Dashboard > Security > WAF > Rate Limiting Rules
```

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Errors**:
   - Verify D1 database ID in wrangler.toml
   - Ensure schema.sql was executed

2. **API Key Errors**:
   - Check Mistral API key is valid
   - Verify environment variables are set

3. **Authentication Issues**:
   - Ensure JWT_SECRET is set and consistent
   - Check token expiration (7 days default)

4. **File Upload Errors**:
   - Verify file size < 50MB
   - Check supported formats: PDF, PNG, JPG, JPEG, WEBP

### Log Access

```bash
# View worker logs
wrangler tail

# View specific function logs
wrangler tail --format=pretty
```

## 📚 Additional Resources

- **Live Demo**: https://2fdd6508.brainsait-ocr.pages.dev
- **API Documentation**: [API Endpoints](README.md#api-endpoints)
- **GitHub Issues**: https://github.com/Fadil369/brainsait-ocr/issues
- **Security Policy**: [SECURITY.md](SECURITY.md)

## 📞 Support

For installation help or deployment issues:

1. Check this installation guide
2. Review [troubleshooting section](#troubleshooting)
3. Search [existing issues](https://github.com/Fadil369/brainsait-ocr/issues)
4. Create a [new issue](https://github.com/Fadil369/brainsait-ocr/issues/new) with deployment details

---

Built with ❤️ using **BrainSAIT** technology