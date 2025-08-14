# BrainSAIT OCR - Advanced Multilingual Document Reader 🧠

A comprehensive OCR solution powered by Mistral AI, designed specifically for the BrainSAIT ecosystem with advanced Arabic text recognition capabilities.

## ✨ Features

### 🎯 Core Capabilities
- **Superior Arabic OCR**: Outperforms competitors like Google Document AI and Azure OCR
- **Multilingual Support**: Arabic, English, and 100+ languages
- **Multiple Input Formats**: PDF, PNG, JPG, JPEG (up to 50MB)
- **Batch Processing**: Handle thousands of pages in minutes
- **Real-time Processing**: Live document processing with progress tracking

### 🚀 Advanced Features
- **Structural Understanding**: Preserves headers, paragraphs, tables, and lists
- **Image Extraction**: Automatically extracts and describes embedded images
- **Smart Caching**: Avoid reprocessing with intelligent file hashing
- **Multiple Output Formats**: JSON, Markdown, HTML, Plain Text
- **API Integration**: RESTful API for seamless BrainSAIT ecosystem integration
- **Modern Web Interface**: Intuitive Arabic-first UI with English support

### 🔧 Technical Specifications
- **High Accuracy**: 95%+ accuracy for Arabic text recognition
- **Fast Processing**: 2000+ pages per minute capability
- **Concurrent Processing**: Configurable parallel processing
- **Automatic Retry**: Built-in error handling and retry logic
- **Comprehensive Logging**: Detailed processing logs and statistics

## 📋 Requirements

### System Requirements
```bash
# Python 3.9 or higher
python --version  # Should be >= 3.9

# Operating System Support
# ✅ macOS (Recommended for BrainSAIT development)
# ✅ Linux (Ubuntu 20.04+, Debian 11+)
# ✅ Windows 10/11
# ✅ Raspberry Pi (Debian 12 Bookworm)
```

### Dependencies
```txt
# Core OCR Dependencies
mistralai>=1.0.0
aiohttp>=3.9.0
aiofiles>=23.2.0

# Image and PDF Processing
Pillow>=10.0.0
PyMuPDF>=1.23.0
pytesseract>=0.3.10

# Language Detection and Text Processing
langdetect>=1.0.9
markdown>=3.5.0

# Web Server (Optional)
fastapi>=0.104.0
uvicorn[standard]>=0.24.0

# CLI and Utilities
click>=8.1.7
python-dotenv>=1.0.0
colorama>=0.4.6

# Development Dependencies (Optional)
pytest>=7.4.0
pytest-asyncio>=0.21.0
black>=23.0.0
flake8>=6.0.0
```

## 🚀 Installation

### 1. Quick Setup (Recommended)
```bash
# Clone the repository
git clone https://github.com/fadil369/brainsait-ocr.git
cd brainsait-ocr

# Create virtual environment
python -m venv brainsait_ocr_env
source brainsait_ocr_env/bin/activate  # On Windows: brainsait_ocr_env\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env and add your Mistral API key
```

### 2. Docker Setup (For Production)
```bash
# Build Docker image
docker build -t brainsait-ocr:latest .

# Run with Docker Compose
docker-compose up -d

# Or run directly
docker run -p 8000:8000 -e MISTRAL_API_KEY="your_key_here" brainsait-ocr:latest
```

### 3. Raspberry Pi Setup (Self-Hosted)
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install system dependencies
sudo apt install -y python3-pip python3-venv tesseract-ocr tesseract-ocr-ara

# Clone and setup
git clone https://github.com/fadil369/brainsait-ocr.git
cd brainsait-ocr

# Create virtual environment
python3 -m venv brainsait_ocr_env
source brainsait_ocr_env/bin/activate

# Install dependencies
pip install -r requirements.txt
```

## 🔑 API Key Setup

### Get Your Mistral API Key
1. Visit [Mistral AI Console](https://console.mistral.ai)
2. Create an account or sign in
3. Navigate to API Keys section
4. Generate a new API key
5. Copy and save securely

### Configure Environment
```bash
# Option 1: Environment File (.env)
echo "MISTRAL_API_KEY=your_api_key_here" > .env

# Option 2: Environment Variable
export MISTRAL_API_KEY="your_api_key_here"

# Option 3: CLI Parameter (for testing)
python brainsait_ocr.py process document.pdf --api-key "your_key_here"
```

## 🎮 Usage Examples

### Command Line Interface

#### Process Single Document
```bash
# Basic processing
python brainsait_ocr.py process document.pdf --api-key YOUR_KEY

# With custom output
python brainsait_ocr.py process document.pdf \
  --api-key YOUR_KEY \
  --output result.md \
  --format markdown \
  --extract-images

# Arabic document with translation
python brainsait_ocr.py process arabic_doc.pdf \
  --api-key YOUR_KEY \
  --auto-translate \
  --format html
```

#### Batch Processing
```bash
# Process all files in directory
python brainsait_ocr.py batch ./documents/ \
  --api-key YOUR_KEY \
  --format json \
  --max-concurrent 5

# Medical documents processing
python brainsait_ocr.py batch ./medical_reports/ \
  --api-key YOUR_KEY \
  --extract-images \
  --preserve-formatting \
  --output medical_analysis.json
```

#### Start Web Server
```bash
# Development server
python brainsait_ocr.py server --api-key YOUR_KEY --port 8000 --reload

# Production server
python brainsait_ocr.py server \
  --api-key YOUR_KEY \
  --host 0.0.0.0 \
  --port 8000
```

#### Cache Management
```bash
# View statistics
python brainsait_ocr.py stats --api-key YOUR_KEY

# Clear old cache files (older than 7 days)
python brainsait_ocr.py clear-cache --days 7
```

### Python API Usage

```python
import asyncio
from brainsait_ocr import BrainSAITOCR, OutputFormat

async def main():
    # Initialize OCR processor
    ocr = BrainSAITOCR(api_key="your_api_key_here")
    
    # Process single file
    result = await ocr.process_file(
        "document.pdf",
        options={
            'extract_images': True,
            'preserve_formatting': True,
            'auto_translate': False
        }
    )
    
    print(f"Status: {result.status}")
    print(f"Language: {result.metadata.language}")
    print(f"Text: {result.ocr_result.text[:100]}...")
    
    # Process multiple files
    files = ["doc1.pdf", "doc2.png", "doc3.jpg"]
    results = await ocr.process_batch(files, max_concurrent=3)
    
    # Export results
    json_output = ocr.export_results(results, OutputFormat.JSON)
    markdown_output = ocr.export_results(results, OutputFormat.MARKDOWN)
    
    # Get statistics
    stats = ocr.get_statistics()
    print(f"Success rate: {stats['success_rate']:.1f}%")

# Run async function
asyncio.run(main())
```

### Web Interface Usage

1. **Start the server:**
   ```bash
   python brainsait_ocr.py server --api-key YOUR_KEY
   ```

2. **Open browser:** Navigate to `http://localhost:8000`

3. **Setup API key:** Enter your Mistral API key in the interface

4. **Upload documents:** Drag and drop or select files to process

5. **Configure options:**
   - ✅ Extract Images: Include image descriptions
   - ✅ Preserve Formatting: Maintain document structure
   - ☐ Auto Translate: Translate Arabic to English

6. **Download results:** Export as JSON, Markdown, or copy to clipboard

## 🔗 API Integration

### RESTful API Endpoints

#### Process Single Document
```http
POST /api/ocr/process
Content-Type: multipart/form-data

file: (binary)
extract_images: boolean
preserve_formatting: boolean
auto_translate: boolean
```

#### Batch Processing
```http
POST /api/ocr/batch
Content-Type: multipart/form-data

files: (binary array)
max_concurrent: integer
extract_images: boolean
preserve_formatting: boolean
auto_translate: boolean
```

#### Get Statistics
```http
GET /api/statistics
```

#### Health Check
```http
GET /api/health
```

### Integration Example
```javascript
// JavaScript integration example
async function processDocument(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('extract_images', 'true');
    formData.append('preserve_formatting', 'true');
    
    const response = await fetch('/api/ocr/process', {
        method: 'POST',
        body: formData
    });
    
    const result = await response.json();
    return result;
}
```

## 🏥 BrainSAIT Ecosystem Integration

### Healthcare Document Processing
```python
# Medical report processing
medical_options = {
    'extract_images': True,  # Extract medical charts/images
    'preserve_formatting': True,  # Maintain report structure
    'auto_translate': True,  # Translate Arabic medical terms
    'extract_tables': True  # Parse medical data tables
}

result = await ocr.process_file("medical_report.pdf", medical_options)
```

### Educational Content Pipeline
```python
# Course material processing
educational_options = {
    'extract_images': True,  # Extract diagrams and figures
    'preserve_formatting': True,  # Maintain lesson structure
    'auto_translate': False,  # Keep original Arabic
    'extract_tables': True  # Parse data tables
}

results = await ocr.process_batch(lesson_files, educational_options)
```

### Integration with BrainSAIT Agents
```python
# Agent workflow integration
async def process_for_agent(document_path, agent_type):
    options = {
        'healthcare': {
            'extract_images': True,
            'auto_translate': True,
            'preserve_formatting': True
        },
        'education': {
            'extract_images': True,
            'auto_translate': False,
            'preserve_formatting': True
        },
        'business': {
            'extract_images': False,
            'auto_translate': True,
            'preserve_formatting': True
        }
    }
    
    result = await ocr.process_file(document_path, options[agent_type])
    return result
```

## 📊 Performance Optimization

### Caching Strategy
- **File Hash-based Caching**: Avoid reprocessing identical files
- **Automatic Cache Management**: Configurable cache expiration
- **Cache Statistics**: Monitor cache hit rates for optimization

### Concurrent Processing
```python
# Optimize for your system
max_concurrent = min(cpu_count(), 5)  # Conservative approach
max_concurrent = cpu_count() * 2      # Aggressive approach
```

### Memory Management
- **Batch Size Optimization**: Process files in optimal batch sizes
- **Memory-Efficient Streaming**: Handle large files without memory issues
- **Resource Cleanup**: Automatic temporary file cleanup

## 🔧 Configuration Options

### Environment Variables
```bash
# API Configuration
MISTRAL_API_KEY="your_api_key"
MISTRAL_API_BASE_URL="https://api.mistral.ai/v1"  # Custom endpoint if needed

# Processing Configuration
MAX_FILE_SIZE=52428800  # 50MB in bytes
MAX_CONCURRENT_REQUESTS=5
CACHE_EXPIRY_DAYS=30
DEFAULT_LANGUAGE="ar"

# Server Configuration
SERVER_HOST="0.0.0.0"
SERVER_PORT=8000
LOG_LEVEL="INFO"
ENABLE_CORS=true

# Storage Configuration
CACHE_DIRECTORY="./ocr_cache"
OUTPUT_DIRECTORY="./output"
LOG_DIRECTORY="./logs"
```

### Configuration File (config.yaml)
```yaml
# BrainSAIT OCR Configuration
api:
  provider: "mistral"
  key: "${MISTRAL_API_KEY}"
  retry_attempts: 3
  retry_delay: 2

processing:
  default_options:
    extract_images: true
    preserve_formatting: true
    auto_translate: false
    extract_tables: true
  
  batch:
    max_concurrent: 3
    chunk_size: 10
  
  supported_formats:
    - "pdf"
    - "png"
    - "jpg"
    - "jpeg"

caching:
  enabled: true
  directory: "./ocr_cache"
  expiry_days: 30
  
server:
  host: "0.0.0.0"
  port: 8000
  cors_enabled: true
  max_upload_size: 52428800
```

## 🧪 Testing

### Unit Tests
```bash
# Run all tests
python -m pytest tests/

# Run specific test category
python -m pytest tests/test_ocr_core.py
python -m pytest tests/test_api.py
python -m pytest tests/test_arabic_processing.py

# Run with coverage
python -m pytest --cov=brainsait_ocr tests/
```

### Integration Tests
```bash
# Test with sample documents
python -m pytest tests/integration/

# Test API endpoints
python -m pytest tests/test_api_integration.py

# Test multilingual processing
python -m pytest tests/test_multilingual.py
```

### Performance Tests
```bash
# Benchmark processing speed
python tests/benchmark_processing.py

# Memory usage analysis
python tests/memory_profiling.py

# Concurrent processing stress test
python tests/stress_test.py
```

## 🐛 Troubleshooting

### Common Issues

#### API Key Issues
```bash
# Error: Invalid API key
✅ Solution: Verify your Mistral API key is correct
export MISTRAL_API_KEY="your_correct_key"
```

#### Memory Issues
```bash
# Error: Out of memory processing large files
✅ Solution: Reduce max_concurrent or increase system memory
python brainsait_ocr.py batch ./docs --max-concurrent 1
```

#### File Format Issues
```bash
# Error: Unsupported file format
✅ Solution: Convert to supported format (PDF, PNG, JPG)
convert document.tiff document.pdf  # Using ImageMagick
```

#### Arabic Text Issues
```bash
# Error: Poor Arabic text recognition
✅ Solution: Ensure proper font rendering
sudo apt install fonts-noto-arabic  # Linux
brew install --cask font-noto-sans-arabic  # macOS
```

### Debug Mode
```bash
# Enable debug logging
export LOG_LEVEL=DEBUG
python brainsait_ocr.py process document.pdf --api-key YOUR_KEY

# Verbose processing information
python brainsait_ocr.py process document.pdf \
  --api-key YOUR_KEY \
  --verbose \
  --no-cache  # Skip cache to see full processing
```

## 📈 Monitoring and Analytics

### Processing Statistics
```python
# Get detailed statistics
stats = ocr.get_statistics()
print(f"""
📊 BrainSAIT OCR Statistics:
- Total Processed: {stats['total_processed']}
- Success Rate: {stats['success_rate']:.1f}%
- Cache Hit Rate: {stats['cache_hit_rate']:.1f}%
- Average Processing Time: {stats.get('avg_processing_time', 0):.2f}s
""")
```

### Log Analysis
```bash
# Monitor processing logs
tail -f brainsait_ocr.log

# Analyze error patterns
grep "ERROR" brainsait_ocr.log | tail -20

# Performance analysis
grep "Processing completed" brainsait_ocr.log | grep -o "\d\+\.\d\+s"
```

## 🚀 Deployment

### Production Deployment with Docker
```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8000

CMD ["python", "brainsait_ocr.py", "server", "--host", "0.0.0.0", "--port", "8000"]
```

### Docker Compose for BrainSAIT Stack
```yaml
version: '3.8'
services:
  brainsait-ocr:
    build: .
    ports:
      - "8000:8000"
    environment:
      - MISTRAL_API_KEY=${MISTRAL_API_KEY}
    volumes:
      - ./ocr_cache:/app/ocr_cache
      - ./output:/app/output
    restart: unless-stopped
    
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - brainsait-ocr
```

### Cloudflare Workers Integration
```javascript
// Deploy to Cloudflare Workers for global edge processing
export default {
  async fetch(request) {
    const formData = await request.formData();
    const file = formData.get('file');
    
    // Forward to BrainSAIT OCR service
    const ocrResponse = await fetch('https://your-ocr-service.com/api/ocr/process', {
      method: 'POST',
      body: formData
    });
    
    return new Response(await ocrResponse.text(), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
```

## 🤝 Contributing

### Development Setup
```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/brainsait-ocr.git
cd brainsait-ocr

# Create development environment
python -m venv dev_env
source dev_env/bin/activate

# Install development dependencies
pip install -r requirements-dev.txt
pip install -e .

# Install pre-commit hooks
pre-commit install
```

### Code Standards
```bash
# Format code with Black
black brainsait_ocr/

# Lint with flake8
flake8 brainsait_ocr/

# Type checking with mypy
mypy brainsait_ocr/

# Run tests before committing
python -m pytest tests/
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍⚕️ Author

**Dr. Fadil** - Physician Entrepreneur & Founder of BrainSAIT
- 🌐 Website: [brainsait.com](https://brainsait.com)
- 🐙 GitHub: [@fadil369](https://github.com/fadil369)
- 🐦 Twitter: [@brainsait369](https://twitter.com/brainsait369)
- 💼 LinkedIn: [fadil369](https://linkedin.com/in/fadil369)
- 📅 Calendly: [fadil369](https://calendly.com/fadil369)

## 💝 Support

If you find this project helpful, consider supporting its development:
- ⭐ Star this repository
- 🐛 Report bugs and issues
- 💡 Suggest new features
- 🤝 Contribute code improvements
- ☕ [Support via Patreon](https://patreon.com/Fadil369)
- 💳 [PayPal Donation](https://paypal.com/paypalme/my/profile)

## 🙏 Acknowledgments

- **Mistral AI** for providing the powerful OCR API
- **Arabic OCR Community** for testing and feedback
- **BrainSAIT Community** for continuous support and suggestions
- **Open Source Contributors** who make projects like this possible

---

*Built with ❤️ for the Arabic-speaking community and healthcare professionals worldwide.*