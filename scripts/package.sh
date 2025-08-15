#!/bin/bash

# BrainSAIT OCR Package Creation Script
set -e

VERSION=$(node -p "require('./package.json').version")
echo "Creating packages for BrainSAIT OCR v$VERSION"

# Create package directory
PACKAGE_DIR="./dist/packages"
mkdir -p "$PACKAGE_DIR"

# 1. Source package
echo "Creating source package..."
tar --exclude=node_modules \
    --exclude=.git \
    --exclude=dist \
    --exclude=.wrangler \
    -czf "$PACKAGE_DIR/brainsait-ocr-v${VERSION}-source.tar.gz" \
    -C . .

# 2. Production deployment package
echo "Creating deployment package..."
mkdir -p "./dist/deployment"
cp -r src public scripts ./dist/deployment/
cp package.json wrangler.toml schema.sql README.md CHANGELOG.md SECURITY.md ./dist/deployment/

tar -czf "$PACKAGE_DIR/brainsait-ocr-v${VERSION}-deployment.tar.gz" \
    -C ./dist deployment

# 3. Docker build context
echo "Creating Docker package..."
mkdir -p "./dist/docker"
cp -r src public ./dist/docker/
cp package.json package-lock.json wrangler.toml schema.sql Dockerfile .dockerignore ./dist/docker/

tar -czf "$PACKAGE_DIR/brainsait-ocr-v${VERSION}-docker.tar.gz" \
    -C ./dist docker

# 4. Standalone distribution
echo "Creating standalone distribution..."
mkdir -p "./dist/standalone"
cp -r src public ./dist/standalone/
cp package.json wrangler.toml schema.sql ./dist/standalone/

# Create setup script
cat > ./dist/standalone/setup.sh << 'EOF'
#!/bin/bash
echo "Setting up BrainSAIT OCR..."
npm install
echo "Setup complete! Configure your environment variables and run: npm run worker:deploy"
EOF

chmod +x ./dist/standalone/setup.sh

tar -czf "$PACKAGE_DIR/brainsait-ocr-v${VERSION}-standalone.tar.gz" \
    -C ./dist standalone

# Generate checksums
echo "Generating checksums..."
cd "$PACKAGE_DIR"
sha256sum *.tar.gz > checksums.txt

echo "Package creation complete!"
echo "Packages created in: $PACKAGE_DIR"
ls -la *.tar.gz
echo ""
echo "Checksums:"
cat checksums.txt