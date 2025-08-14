#!/bin/bash

# BrainSAIT OCR Deployment Script
set -e

echo "🚀 Deploying BrainSAIT OCR to Cloudflare"

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Installing..."
    npm install -g wrangler
fi

# Login to Cloudflare (if not already logged in)
echo "🔐 Checking Cloudflare authentication..."
if ! wrangler whoami &> /dev/null; then
    echo "Please login to Cloudflare:"
    wrangler login
fi

# Create D1 database if it doesn't exist
echo "📊 Setting up D1 database..."
DB_OUTPUT=$(wrangler d1 create brainsait-ocr-db 2>/dev/null || echo "exists")
if [[ $DB_OUTPUT != "exists" ]]; then
    echo "✅ Database created successfully"
    echo "⚠️  Please update the database_id in wrangler.toml with the ID from above"
else
    echo "📊 Database already exists"
fi

# Run database migrations
echo "📊 Running database migrations..."
wrangler d1 execute brainsait-ocr-db --file=./schema.sql

# Create KV namespaces
echo "🗄️  Setting up KV namespaces..."
wrangler kv:namespace create "CACHE" || echo "Cache namespace already exists"
wrangler kv:namespace create "SESSIONS" || echo "Sessions namespace already exists"

# Create R2 bucket for file storage
echo "🪣 Setting up R2 bucket..."
wrangler r2 bucket create brainsait-ocr-storage || echo "R2 bucket already exists"

# Deploy the worker
echo "👷 Deploying Cloudflare Worker..."
wrangler deploy

# Deploy pages
echo "📄 Deploying Cloudflare Pages..."
wrangler pages deploy ./public --project-name=brainsait-ocr --compatibility-date=2024-01-01

echo "✅ Deployment completed successfully!"
echo ""
echo "🌐 Your sites should be available at:"
echo "   Landing Page: https://brainsait-ocr.pages.dev"
echo "   API Worker: https://brainsait-ocr-worker.your-subdomain.workers.dev"
echo ""
echo "⚙️  Next steps:"
echo "1. Set up your environment variables in Cloudflare dashboard"
echo "2. Update payment gateway credentials"
echo "3. Configure your domain (optional)"
echo "4. Test the application"