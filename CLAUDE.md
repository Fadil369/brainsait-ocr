# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

BrainSAIT OCR is an advanced multilingual document reader powered by Mistral AI, designed specifically for the BrainSAIT ecosystem with superior Arabic text recognition capabilities. The system provides comprehensive OCR (Optical Character Recognition) services through both a Python backend API and a web interface.

## Core Commands

### Development & Testing
```bash
# Install dependencies
pip install -r brainsait_ocr_requirements.txt

# Run the OCR server (FastAPI backend)
python brainsait_ocr_backend.py server --api-key YOUR_KEY --port 8000 --reload

# Process single file via CLI
python brainsait_ocr_backend.py process document.pdf --api-key YOUR_KEY --format markdown

# Process batch of files
python brainsait_ocr_backend.py batch ./documents/ --api-key YOUR_KEY --max-concurrent 5

# Clear cache files older than 7 days
python brainsait_ocr_backend.py clear-cache --days 7

# View processing statistics
python brainsait_ocr_backend.py stats --api-key YOUR_KEY
```

### Docker Deployment
```bash
# Build Docker image
docker build -t brainsait-ocr:latest .

# Run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f brainsait-ocr
```

## Architecture & Structure

### Backend System (`brainsait_ocr_backend.py`)
- **BrainSAITOCR Class**: Core OCR processor handling file validation, Mistral API integration, caching, and result management
  - Async processing with retry logic for API calls
  - File hash-based caching system to avoid reprocessing
  - Multi-format export (JSON, Markdown, HTML, TXT)
  - Batch processing with configurable concurrency

- **BrainSAITOCRServer Class**: FastAPI server providing RESTful API endpoints
  - `/api/ocr/process` - Single document processing
  - `/api/ocr/batch` - Batch document processing
  - `/api/statistics` - Processing statistics
  - `/api/cache/clear` - Cache management
  - `/api/health` - Health check endpoint

### Frontend Interface (`brainsait_ocr_app.html`)
- Single-page application with bilingual support (Arabic/English)
- Real-time file processing with progress tracking
- Drag-and-drop file upload interface
- Multiple export formats (JSON, Markdown, clipboard)
- Glass morphism UI design with responsive layout

### Key Data Structures
- **ProcessingResult**: Complete processing result with metadata, OCR result, and status
- **DocumentMetadata**: File information including hash, size, type, and processing time
- **OCRResult**: Extracted text with confidence scores, language detection, and structure

## API Integration

### Mistral AI OCR
The system uses Mistral's `mistral-ocr-latest` model for document processing:
- Converts documents to base64 data URIs
- Sends structured prompts for text extraction
- Handles retry logic with exponential backoff
- Supports image descriptions and table extraction

### Processing Options
- `extract_images`: Extract and describe embedded images
- `preserve_formatting`: Maintain document structure in output
- `auto_translate`: Automatic Arabic to English translation
- `extract_tables`: Convert tables to Markdown format

## Important Considerations

### File Processing Limits
- Maximum file size: 50MB
- Supported formats: PDF, PNG, JPG, JPEG
- Batch processing limit: 10 files via API
- Concurrent processing: Configurable (default 3-5)

### Caching Strategy
- SHA256 hash-based file identification
- JSON cache files stored in `ocr_cache/` directory
- Configurable cache expiry (default 30 days)
- Cache hit detection to avoid reprocessing

### Error Handling
- Comprehensive validation for file format and size
- API retry attempts (3 retries with exponential backoff)
- Graceful degradation for failed batch items
- Detailed error logging to `brainsait_ocr.log`

### Language Support
- Primary focus on Arabic text recognition
- Automatic language detection using langdetect
- Multilingual support for 100+ languages
- RTL/LTR text handling in web interface

## Environment Configuration

Required environment variables (create `.env` file):
```bash
MISTRAL_API_KEY=your_mistral_api_key_here
MAX_FILE_SIZE=52428800  # 50MB
MAX_CONCURRENT_REQUESTS=5
CACHE_EXPIRY_DAYS=30
SERVER_HOST=0.0.0.0
SERVER_PORT=8000
LOG_LEVEL=INFO
```

## BrainSAIT Ecosystem Integration

The OCR system is designed to integrate with the broader BrainSAIT platform:
- Healthcare document processing with medical terminology extraction
- Educational content processing with structure preservation
- Business document analysis with table extraction
- Research paper processing with citation handling

Agent-specific processing options are available for:
- Healthcare agents (medical reports, prescriptions)
- Education agents (course materials, exams)
- Business agents (invoices, contracts)
- Research agents (academic papers, datasets)

## Development Guidelines

1. **Async Processing**: All file operations use async/await patterns for optimal performance
2. **Error Recovery**: Implement retry logic for external API calls
3. **Caching First**: Always check cache before processing to reduce API costs
4. **Validation**: Validate all inputs (file format, size, API keys) before processing
5. **Logging**: Use structured logging with appropriate levels (INFO, WARNING, ERROR)
6. **Security**: Never log or expose API keys or sensitive document content