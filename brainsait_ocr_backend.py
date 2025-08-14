#!/usr/bin/env python3
"""
BrainSAIT OCR - Advanced Multilingual Document Reader
======================================================

A comprehensive OCR solution powered by Mistral AI for the BrainSAIT ecosystem.
Supports Arabic, English, and multilingual document processing with advanced
features for healthcare and educational content.

Author: Dr. Fadil - BrainSAIT
License: MIT
Version: 1.0.0
"""

import argparse
import asyncio
import base64
import hashlib
import json
import logging
import mimetypes
import shutil
import sys
import tempfile
from dataclasses import asdict, dataclass
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional, Union

import aiofiles
import fitz  # PyMuPDF for PDF handling
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from langdetect import detect
from mistralai import Mistral
try:
    from mistralai.exceptions import MistralException
except ImportError:
    # Fallback for different mistralai versions
    class MistralException(Exception):
        pass

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("brainsait_ocr.log", encoding="utf-8"),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)

# Constants
SUPPORTED_FORMATS = {
    "pdf": "application/pdf",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
}

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
API_RETRY_ATTEMPTS = 3
API_RETRY_DELAY = 2  # seconds


class ProcessingStatus(Enum):
    """Processing status enumeration"""

    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CACHED = "cached"


class OutputFormat(Enum):
    """Output format enumeration"""

    JSON = "json"
    MARKDOWN = "markdown"
    TXT = "txt"
    HTML = "html"


@dataclass
class DocumentMetadata:
    """Document metadata structure"""

    file_name: str
    file_size: int
    file_type: str
    file_hash: str
    language: Optional[str] = None
    page_count: Optional[int] = None
    processing_time: Optional[float] = None
    created_at: str = None

    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now().isoformat()


@dataclass
class OCRResult:
    """OCR result structure"""

    text: str
    confidence: Optional[float] = None
    language: Optional[str] = None
    images: List[str] = None
    tables: List[Dict] = None
    structure: Dict[str, Any] = None

    def __post_init__(self):
        if self.images is None:
            self.images = []
        if self.tables is None:
            self.tables = []
        if self.structure is None:
            self.structure = {}


@dataclass
class ProcessingResult:
    """Complete processing result structure"""

    metadata: DocumentMetadata
    ocr_result: OCRResult
    status: ProcessingStatus
    error_message: Optional[str] = None
    processing_options: Dict[str, Any] = None

    def __post_init__(self):
        if self.processing_options is None:
            self.processing_options = {}


class BrainSAITOCR:
    """
    Advanced OCR processor with multilingual support and BrainSAIT ecosystem integration
    """

    def __init__(
        self, api_key: str, cache_dir: str = "ocr_cache", output_dir: str = "output"
    ):
        """
        Initialize the OCR processor

        Args:
            api_key: Mistral AI API key
            cache_dir: Directory for caching processed results
            output_dir: Directory for output files
        """
        self.api_key = api_key
        self.client = Mistral(api_key=api_key)
        self.cache_dir = Path(cache_dir)
        self.output_dir = Path(output_dir)

        # Create directories
        self.cache_dir.mkdir(exist_ok=True)
        self.output_dir.mkdir(exist_ok=True)

        # Processing statistics
        self.stats = {"total_processed": 0, "successful": 0, "failed": 0, "cached": 0}

        logger.info("BrainSAIT OCR initialized successfully")

    def _calculate_file_hash(self, file_path: Path) -> str:
        """Calculate SHA256 hash of file for caching"""
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                sha256_hash.update(chunk)
        return sha256_hash.hexdigest()

    def _get_cache_path(self, file_hash: str) -> Path:
        """Get cache file path for given hash"""
        return self.cache_dir / f"{file_hash}.json"

    def _validate_file(self, file_path: Path) -> bool:
        """
        Validate file format and size

        Args:
            file_path: Path to file

        Returns:
            True if valid, False otherwise
        """
        if not file_path.exists():
            logger.error(f"File not found: {file_path}")
            return False

        # Check file size
        if file_path.stat().st_size > MAX_FILE_SIZE:
            logger.error(
                f"File too large: {file_path} ({file_path.stat().st_size} bytes)"
            )
            return False

        # Check file format
        mime_type, _ = mimetypes.guess_type(str(file_path))
        if mime_type not in SUPPORTED_FORMATS.values():
            logger.error(f"Unsupported file format: {file_path} ({mime_type})")
            return False

        return True

    def _extract_pdf_info(self, file_path: Path) -> Dict[str, Any]:
        """
        Extract basic information from PDF

        Args:
            file_path: Path to PDF file

        Returns:
            Dictionary with PDF information
        """
        try:
            doc = fitz.open(file_path)
            info = {
                "page_count": len(doc),
                "title": doc.metadata.get("title", ""),
                "author": doc.metadata.get("author", ""),
                "subject": doc.metadata.get("subject", ""),
                "creator": doc.metadata.get("creator", ""),
                "producer": doc.metadata.get("producer", ""),
                "creation_date": doc.metadata.get("creationDate", ""),
                "modification_date": doc.metadata.get("modDate", ""),
            }
            doc.close()
            return info
        except Exception as e:
            logger.warning(f"Could not extract PDF info: {e}")
            return {}

    def _detect_language(self, text: str) -> str:
        """
        Detect language of extracted text

        Args:
            text: Text to analyze

        Returns:
            Language code (e.g., 'ar', 'en')
        """
        try:
            if len(text.strip()) < 10:
                return "unknown"
            return detect(text)
        except Exception:
            return "unknown"

    async def _call_mistral_ocr_api(
        self, file_path: Path, options: Dict[str, Any] = None
    ) -> str:
        """
        Call Mistral OCR API with retry logic

        Args:
            file_path: Path to file to process
            options: Processing options

        Returns:
            Extracted text from API
        """
        if options is None:
            options = {}

        # Convert file to base64
        with open(file_path, "rb") as file:
            file_data = file.read()
            base64_data = base64.b64encode(file_data).decode("utf-8")

        # Determine MIME type
        mime_type, _ = mimetypes.guess_type(str(file_path))
        data_uri = f"data:{mime_type};base64,{base64_data}"

        # Prepare system prompt based on options
        system_prompt = self._build_system_prompt(options)

        for attempt in range(API_RETRY_ATTEMPTS):
            try:
                logger.info(
                    f"Calling Mistral OCR API (attempt {attempt + 1}/{API_RETRY_ATTEMPTS})"
                )

                response = await asyncio.to_thread(
                    self.client.chat.complete,
                    model="mistral-ocr-latest",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {
                            "role": "user",
                            "content": [
                                {"type": "image_url", "image_url": {"url": data_uri}},
                                {
                                    "type": "text",
                                    "text": "Process this document according to the system instructions.",
                                },
                            ],
                        },
                    ],
                )

                return response.choices[0].message.content

            except MistralException as e:
                logger.error(f"Mistral API error (attempt {attempt + 1}): {e}")
                if attempt < API_RETRY_ATTEMPTS - 1:
                    await asyncio.sleep(API_RETRY_DELAY * (attempt + 1))
                else:
                    raise e
            except Exception as e:
                logger.error(f"Unexpected error (attempt {attempt + 1}): {e}")
                if attempt < API_RETRY_ATTEMPTS - 1:
                    await asyncio.sleep(API_RETRY_DELAY * (attempt + 1))
                else:
                    raise e

    def _build_system_prompt(self, options: Dict[str, Any]) -> str:
        """
        Build system prompt based on processing options

        Args:
            options: Processing options dictionary

        Returns:
            Formatted system prompt
        """
        base_prompt = """You are an advanced OCR system specialized in multilingual document processing, particularly Arabic and English text. Your task is to extract and structure text from documents with high accuracy.

Instructions:
1. Extract ALL text from the document, maintaining original structure and formatting
2. Preserve headers, paragraphs, lists, and table structures
3. For Arabic text: Pay special attention to diacritics, right-to-left reading direction, and proper character recognition
4. For mixed-language documents: Clearly identify and separate different language sections
5. Output the result in clean, well-structured Markdown format
6. If images are present, provide brief descriptions of their content"""

        # Add specific instructions based on options
        if options.get("extract_images", False):
            base_prompt += "\n7. Extract and describe any images, charts, diagrams, or visual elements"

        if options.get("preserve_formatting", True):
            base_prompt += "\n8. Maintain original document formatting as much as possible in Markdown"

        if options.get("extract_tables", True):
            base_prompt += "\n9. Convert any tables to proper Markdown table format"

        if options.get("auto_translate", False):
            base_prompt += (
                "\n10. If requested, provide English translation alongside Arabic text"
            )

        base_prompt += "\n\nBe extremely accurate with Arabic text recognition and maintain the document's original meaning and structure."

        return base_prompt

    async def process_file(
        self,
        file_path: Union[str, Path],
        options: Dict[str, Any] = None,
        use_cache: bool = True,
    ) -> ProcessingResult:
        """
        Process a single file through OCR

        Args:
            file_path: Path to file to process
            options: Processing options
            use_cache: Whether to use cached results

        Returns:
            ProcessingResult object
        """
        file_path = Path(file_path)
        start_time = datetime.now()

        logger.info(f"Processing file: {file_path}")

        # Validate file
        if not self._validate_file(file_path):
            return ProcessingResult(
                metadata=DocumentMetadata(
                    file_name=file_path.name,
                    file_size=0,
                    file_type="unknown",
                    file_hash="",
                ),
                ocr_result=OCRResult(text=""),
                status=ProcessingStatus.FAILED,
                error_message="File validation failed",
            )

        # Calculate file hash
        file_hash = self._calculate_file_hash(file_path)
        cache_path = self._get_cache_path(file_hash)

        # Check cache
        if use_cache and cache_path.exists():
            logger.info(f"Loading cached result for: {file_path}")
            try:
                async with aiofiles.open(cache_path, "r", encoding="utf-8") as f:
                    cached_data = json.loads(await f.read())
                    result = ProcessingResult(**cached_data)
                    result.status = ProcessingStatus.CACHED
                    self.stats["cached"] += 1
                    return result
            except Exception as e:
                logger.warning(f"Failed to load cache: {e}")

        # Create metadata
        file_stat = file_path.stat()
        metadata = DocumentMetadata(
            file_name=file_path.name,
            file_size=file_stat.st_size,
            file_type=mimetypes.guess_type(str(file_path))[0] or "unknown",
            file_hash=file_hash,
        )

        # Extract additional info for PDFs
        if file_path.suffix.lower() == ".pdf":
            pdf_info = self._extract_pdf_info(file_path)
            metadata.page_count = pdf_info.get("page_count", 0)

        try:
            # Process with Mistral OCR
            extracted_text = await self._call_mistral_ocr_api(file_path, options)

            # Detect language
            detected_language = self._detect_language(extracted_text)
            metadata.language = detected_language

            # Calculate processing time
            processing_time = (datetime.now() - start_time).total_seconds()
            metadata.processing_time = processing_time

            # Create OCR result
            ocr_result = OCRResult(
                text=extracted_text,
                language=detected_language,
                confidence=0.95,  # Mistral OCR generally has high confidence
            )

            # Create final result
            result = ProcessingResult(
                metadata=metadata,
                ocr_result=ocr_result,
                status=ProcessingStatus.COMPLETED,
                processing_options=options or {},
            )

            # Cache result
            if use_cache:
                try:
                    async with aiofiles.open(cache_path, "w", encoding="utf-8") as f:
                        cache_data = asdict(result)
                        await f.write(
                            json.dumps(cache_data, ensure_ascii=False, indent=2)
                        )
                    logger.info(f"Cached result for: {file_path}")
                except Exception as e:
                    logger.warning(f"Failed to cache result: {e}")

            self.stats["successful"] += 1
            self.stats["total_processed"] += 1

            logger.info(
                f"Successfully processed: {file_path} in {processing_time:.2f}s"
            )
            return result

        except Exception as e:
            logger.error(f"Failed to process {file_path}: {e}")
            self.stats["failed"] += 1
            self.stats["total_processed"] += 1

            return ProcessingResult(
                metadata=metadata,
                ocr_result=OCRResult(text=""),
                status=ProcessingStatus.FAILED,
                error_message=str(e),
                processing_options=options or {},
            )

    async def process_batch(
        self,
        file_paths: List[Union[str, Path]],
        options: Dict[str, Any] = None,
        max_concurrent: int = 3,
    ) -> List[ProcessingResult]:
        """
        Process multiple files concurrently

        Args:
            file_paths: List of file paths to process
            options: Processing options
            max_concurrent: Maximum concurrent processing tasks

        Returns:
            List of ProcessingResult objects
        """
        logger.info(f"Starting batch processing of {len(file_paths)} files")

        semaphore = asyncio.Semaphore(max_concurrent)

        async def process_with_semaphore(file_path):
            async with semaphore:
                return await self.process_file(file_path, options)

        tasks = [process_with_semaphore(fp) for fp in file_paths]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Handle exceptions
        processed_results = []
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                logger.error(f"Exception processing {file_paths[i]}: {result}")
                processed_results.append(
                    ProcessingResult(
                        metadata=DocumentMetadata(
                            file_name=Path(file_paths[i]).name,
                            file_size=0,
                            file_type="unknown",
                            file_hash="",
                        ),
                        ocr_result=OCRResult(text=""),
                        status=ProcessingStatus.FAILED,
                        error_message=str(result),
                    )
                )
            else:
                processed_results.append(result)

        logger.info(
            f"Batch processing completed. Success: {self.stats['successful']}, Failed: {self.stats['failed']}"
        )
        return processed_results

    def export_results(
        self,
        results: List[ProcessingResult],
        output_format: OutputFormat = OutputFormat.JSON,
        output_file: Optional[str] = None,
    ) -> str:
        """
        Export processing results to specified format

        Args:
            results: List of processing results
            output_format: Output format (JSON, Markdown, etc.)
            output_file: Optional output file path

        Returns:
            Exported content as string
        """
        timestamp = datetime.now().isoformat()

        if output_format == OutputFormat.JSON:
            export_data = {
                "timestamp": timestamp,
                "total_files": len(results),
                "successful": len(
                    [r for r in results if r.status == ProcessingStatus.COMPLETED]
                ),
                "failed": len(
                    [r for r in results if r.status == ProcessingStatus.FAILED]
                ),
                "results": [asdict(result) for result in results],
            }
            content = json.dumps(export_data, ensure_ascii=False, indent=2)

        elif output_format == OutputFormat.MARKDOWN:
            content = self._generate_markdown_report(results, timestamp)

        elif output_format == OutputFormat.TXT:
            content = self._generate_text_report(results, timestamp)

        elif output_format == OutputFormat.HTML:
            content = self._generate_html_report(results, timestamp)

        else:
            raise ValueError(f"Unsupported output format: {output_format}")

        # Save to file if specified
        if output_file:
            output_path = self.output_dir / output_file
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(content)
            logger.info(f"Results exported to: {output_path}")

        return content

    def _generate_markdown_report(
        self, results: List[ProcessingResult], timestamp: str
    ) -> str:
        """Generate Markdown report from results"""
        lines = [
            "# BrainSAIT OCR Processing Report",
            f"**Generated:** {timestamp}",
            f"**Total Files:** {len(results)}",
            f"**Successful:** {len([r for r in results if r.status == ProcessingStatus.COMPLETED])}",
            f"**Failed:** {len([r for r in results if r.status == ProcessingStatus.FAILED])}",
            "",
            "---",
            "",
        ]

        for i, result in enumerate(results, 1):
            lines.extend(
                [
                    f"## Document {i}: {result.metadata.file_name}",
                    f"**Status:** {result.status.value}",
                    f"**File Size:** {self._format_file_size(result.metadata.file_size)}",
                    f"**Language:** {result.metadata.language or 'Unknown'}",
                    f"**Processing Time:** {result.metadata.processing_time or 0:.2f}s",
                    "",
                ]
            )

            if result.status == ProcessingStatus.COMPLETED:
                lines.extend(["### Extracted Content", "", result.ocr_result.text, ""])
            elif result.error_message:
                lines.extend([f"**Error:** {result.error_message}", ""])

            lines.extend(["---", ""])

        return "\n".join(lines)

    def _generate_text_report(
        self, results: List[ProcessingResult], timestamp: str
    ) -> str:
        """Generate plain text report from results"""
        lines = [
            "BrainSAIT OCR Processing Report",
            "=" * 40,
            f"Generated: {timestamp}",
            f"Total Files: {len(results)}",
            f"Successful: {len([r for r in results if r.status == ProcessingStatus.COMPLETED])}",
            f"Failed: {len([r for r in results if r.status == ProcessingStatus.FAILED])}",
            "",
            "-" * 40,
            "",
        ]

        for i, result in enumerate(results, 1):
            lines.extend(
                [
                    f"Document {i}: {result.metadata.file_name}",
                    f"Status: {result.status.value}",
                    f"File Size: {self._format_file_size(result.metadata.file_size)}",
                    f"Language: {result.metadata.language or 'Unknown'}",
                    f"Processing Time: {result.metadata.processing_time or 0:.2f}s",
                    "",
                ]
            )

            if result.status == ProcessingStatus.COMPLETED:
                lines.extend(
                    ["Extracted Content:", "-" * 20, result.ocr_result.text, ""]
                )
            elif result.error_message:
                lines.extend([f"Error: {result.error_message}", ""])

            lines.extend(["-" * 40, ""])

        return "\n".join(lines)

    def _generate_html_report(
        self, results: List[ProcessingResult], timestamp: str
    ) -> str:
        """Generate HTML report from results"""
        successful_count = len(
            [r for r in results if r.status == ProcessingStatus.COMPLETED]
        )
        failed_count = len([r for r in results if r.status == ProcessingStatus.FAILED])

        html = f"""<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>BrainSAIT OCR Report</title>
    <style>
        body {{ font-family: 'Segoe UI', Arial, sans-serif; margin: 20px; background: #f5f5f5; }}
        .container {{ max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        .header {{ text-align: center; border-bottom: 2px solid #667eea; padding-bottom: 20px; margin-bottom: 30px; }}
        .stats {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }}
        .stat-card {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 10px; text-align: center; }}
        .document {{ border: 1px solid #ddd; border-radius: 8px; margin-bottom: 20px; overflow: hidden; }}
        .doc-header {{ background: #f8f9fa; padding: 15px; border-bottom: 1px solid #ddd; }}
        .doc-content {{ padding: 20px; }}
        .status-completed {{ color: #28a745; font-weight: bold; }}
        .status-failed {{ color: #dc3545; font-weight: bold; }}
        .status-cached {{ color: #17a2b8; font-weight: bold; }}
        .extracted-text {{ background: #f8f9fa; padding: 15px; border-radius: 5px; white-space: pre-wrap; max-height: 300px; overflow-y: auto; }}
        .metadata {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 15px; }}
        .meta-item {{ background: #e9ecef; padding: 10px; border-radius: 5px; }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧠 BrainSAIT OCR Processing Report</h1>
            <p>Generated: {timestamp}</p>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <h3>Total Files</h3>
                <h2>{len(results)}</h2>
            </div>
            <div class="stat-card">
                <h3>Successful</h3>
                <h2>{successful_count}</h2>
            </div>
            <div class="stat-card">
                <h3>Failed</h3>
                <h2>{failed_count}</h2>
            </div>
            <div class="stat-card">
                <h3>Success Rate</h3>
                <h2>{(successful_count/len(results)*100):.1f}%</h2>
            </div>
        </div>
        
        <div class="documents">"""

        for i, result in enumerate(results, 1):
            status_class = f"status-{result.status.value.replace('_', '-')}"

            html += f"""
            <div class="document">
                <div class="doc-header">
                    <h3>Document {i}: {result.metadata.file_name}</h3>
                    <div class="metadata">
                        <div class="meta-item">
                            <strong>Status:</strong> <span class="{status_class}">{result.status.value.title()}</span>
                        </div>
                        <div class="meta-item">
                            <strong>File Size:</strong> {self._format_file_size(result.metadata.file_size)}
                        </div>
                        <div class="meta-item">
                            <strong>Language:</strong> {result.metadata.language or 'Unknown'}
                        </div>
                        <div class="meta-item">
                            <strong>Processing Time:</strong> {result.metadata.processing_time or 0:.2f}s
                        </div>
                    </div>
                </div>
                <div class="doc-content">"""

            if result.status == ProcessingStatus.COMPLETED:
                html += f"""
                    <h4>Extracted Content:</h4>
                    <div class="extracted-text">{result.ocr_result.text}</div>"""
            elif result.error_message:
                html += f"""
                    <div style="color: #dc3545;">
                        <strong>Error:</strong> {result.error_message}
                    </div>"""

            html += """
                </div>
            </div>"""

        html += """
        </div>
    </div>
</body>
</html>"""

        return html

    def _format_file_size(self, size_bytes: int) -> str:
        """Format file size in human readable format"""
        if size_bytes == 0:
            return "0 B"

        size_names = ["B", "KB", "MB", "GB"]
        i = 0
        while size_bytes >= 1024 and i < len(size_names) - 1:
            size_bytes /= 1024.0
            i += 1

        return f"{size_bytes:.1f} {size_names[i]}"

    def get_statistics(self) -> Dict[str, Any]:
        """Get processing statistics"""
        return {
            **self.stats,
            "success_rate": (
                self.stats["successful"] / max(self.stats["total_processed"], 1)
            )
            * 100,
            "cache_hit_rate": (
                self.stats["cached"] / max(self.stats["total_processed"], 1)
            )
            * 100,
        }

    def clear_cache(self, older_than_days: int = 30) -> int:
        """
        Clear cache files older than specified days

        Args:
            older_than_days: Remove cache files older than this many days

        Returns:
            Number of files removed
        """
        import time

        current_time = time.time()
        cutoff_time = current_time - (older_than_days * 24 * 60 * 60)
        removed_count = 0

        for cache_file in self.cache_dir.glob("*.json"):
            if cache_file.stat().st_mtime < cutoff_time:
                cache_file.unlink()
                removed_count += 1

        logger.info(
            f"Removed {removed_count} cache files older than {older_than_days} days"
        )
        return removed_count


class BrainSAITOCRServer:
    """
    FastAPI server for BrainSAIT OCR
    """

    def __init__(self, api_key: str):
        import shutil
        import tempfile

        from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
        from fastapi.middleware.cors import CORSMiddleware
        from fastapi.responses import FileResponse, JSONResponse

        self.app = FastAPI(
            title="BrainSAIT OCR API",
            description="Advanced multilingual OCR service powered by Mistral AI",
            version="1.0.0",
        )

        # Add CORS middleware
        self.app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

        self.ocr = BrainSAITOCR(api_key)
        self.setup_routes()

    def setup_routes(self):
        """Setup API routes"""

        @self.app.post("/api/ocr/process")
        async def process_document(
            file: UploadFile = File(...),
            extract_images: bool = True,
            preserve_formatting: bool = True,
            auto_translate: bool = False,
        ):
            """Process a single document through OCR"""

            # Validate file
            if not file.content_type in SUPPORTED_FORMATS.values():
                raise HTTPException(400, f"Unsupported file type: {file.content_type}")

            # Save uploaded file temporarily
            with tempfile.NamedTemporaryFile(
                delete=False, suffix=Path(file.filename).suffix
            ) as tmp_file:
                shutil.copyfileobj(file.file, tmp_file)
                tmp_path = tmp_file.name

            try:
                # Process file
                options = {
                    "extract_images": extract_images,
                    "preserve_formatting": preserve_formatting,
                    "auto_translate": auto_translate,
                }

                result = await self.ocr.process_file(tmp_path, options)

                return JSONResponse({"success": True, "result": asdict(result)})

            except Exception as e:
                raise HTTPException(500, f"Processing failed: {str(e)}")

            finally:
                # Clean up temporary file
                Path(tmp_path).unlink(missing_ok=True)

        @self.app.post("/api/ocr/batch")
        async def process_batch(
            files: List[UploadFile] = File(...),
            extract_images: bool = True,
            preserve_formatting: bool = True,
            auto_translate: bool = False,
            max_concurrent: int = 3,
        ):
            """Process multiple documents concurrently"""

            if len(files) > 10:
                raise HTTPException(400, "Maximum 10 files allowed per batch")

            tmp_paths = []
            try:
                # Save all files temporarily
                for file in files:
                    if not file.content_type in SUPPORTED_FORMATS.values():
                        raise HTTPException(
                            400, f"Unsupported file type: {file.content_type}"
                        )

                    with tempfile.NamedTemporaryFile(
                        delete=False, suffix=Path(file.filename).suffix
                    ) as tmp_file:
                        shutil.copyfileobj(file.file, tmp_file)
                        tmp_paths.append(tmp_file.name)

                # Process files
                options = {
                    "extract_images": extract_images,
                    "preserve_formatting": preserve_formatting,
                    "auto_translate": auto_translate,
                }

                results = await self.ocr.process_batch(
                    tmp_paths, options, max_concurrent
                )

                return JSONResponse(
                    {
                        "success": True,
                        "results": [asdict(result) for result in results],
                        "statistics": self.ocr.get_statistics(),
                    }
                )

            except Exception as e:
                raise HTTPException(500, f"Batch processing failed: {str(e)}")

            finally:
                # Clean up temporary files
                for tmp_path in tmp_paths:
                    Path(tmp_path).unlink(missing_ok=True)

        @self.app.get("/api/statistics")
        async def get_statistics():
            """Get processing statistics"""
            return JSONResponse(self.ocr.get_statistics())

        @self.app.post("/api/cache/clear")
        async def clear_cache(older_than_days: int = 30):
            """Clear cache files"""
            removed_count = self.ocr.clear_cache(older_than_days)
            return JSONResponse({"success": True, "removed_files": removed_count})

        @self.app.get("/api/health")
        async def health_check():
            """Health check endpoint"""
            return JSONResponse(
                {
                    "status": "healthy",
                    "service": "BrainSAIT OCR",
                    "version": "1.0.0",
                    "timestamp": datetime.now().isoformat(),
                }
            )


# CLI Implementation
def create_cli():
    """Create command line interface"""

    parser = argparse.ArgumentParser(
        description="BrainSAIT OCR - Advanced Multilingual Document Reader",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Process single file
  python brainsait_ocr.py process document.pdf --api-key YOUR_KEY
  
  # Process multiple files
  python brainsait_ocr.py batch docs/ --api-key YOUR_KEY --format json
  
  # Start server
  python brainsait_ocr.py server --api-key YOUR_KEY --port 8000
  
  # Clear cache
  python brainsait_ocr.py clear-cache --days 7
        """,
    )

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # Process single file
    process_parser = subparsers.add_parser("process", help="Process single file")
    process_parser.add_argument("file", help="Path to file to process")
    process_parser.add_argument("--api-key", required=True, help="Mistral API key")
    process_parser.add_argument("--output", "-o", help="Output file path")
    process_parser.add_argument(
        "--format",
        choices=["json", "markdown", "txt", "html"],
        default="markdown",
        help="Output format",
    )
    process_parser.add_argument(
        "--no-cache", action="store_true", help="Disable caching"
    )
    process_parser.add_argument(
        "--extract-images", action="store_true", help="Extract images"
    )
    process_parser.add_argument(
        "--auto-translate", action="store_true", help="Auto translate"
    )

    # Process batch
    batch_parser = subparsers.add_parser("batch", help="Process multiple files")
    batch_parser.add_argument("directory", help="Directory containing files to process")
    batch_parser.add_argument("--api-key", required=True, help="Mistral API key")
    batch_parser.add_argument("--output", "-o", help="Output file path")
    batch_parser.add_argument(
        "--format",
        choices=["json", "markdown", "txt", "html"],
        default="json",
        help="Output format",
    )
    batch_parser.add_argument(
        "--max-concurrent", type=int, default=3, help="Maximum concurrent processing"
    )
    batch_parser.add_argument("--no-cache", action="store_true", help="Disable caching")
    batch_parser.add_argument(
        "--extract-images", action="store_true", help="Extract images"
    )
    batch_parser.add_argument(
        "--auto-translate", action="store_true", help="Auto translate"
    )

    # Start server
    server_parser = subparsers.add_parser("server", help="Start OCR server")
    server_parser.add_argument("--api-key", required=True, help="Mistral API key")
    server_parser.add_argument("--host", default="0.0.0.0", help="Server host")
    server_parser.add_argument("--port", type=int, default=8000, help="Server port")
    server_parser.add_argument(
        "--reload", action="store_true", help="Enable auto-reload"
    )

    # Clear cache
    cache_parser = subparsers.add_parser("clear-cache", help="Clear cache files")
    cache_parser.add_argument(
        "--days", type=int, default=30, help="Remove files older than N days"
    )

    # Statistics
    stats_parser = subparsers.add_parser("stats", help="Show statistics")
    stats_parser.add_argument("--api-key", help="Mistral API key (for cache stats)")

    return parser


async def main():
    """Main CLI function"""
    parser = create_cli()
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    if args.command == "process":
        # Process single file
        ocr = BrainSAITOCR(args.api_key)

        options = {
            "extract_images": args.extract_images,
            "preserve_formatting": True,
            "auto_translate": args.auto_translate,
        }

        result = await ocr.process_file(
            args.file, options=options, use_cache=not args.no_cache
        )

        # Export result
        output_format = OutputFormat(args.format)
        content = ocr.export_results([result], output_format, args.output)

        if not args.output:
            print(content)

        # Print statistics
        stats = ocr.get_statistics()
        logger.info(f"Processing completed. Success rate: {stats['success_rate']:.1f}%")

    elif args.command == "batch":
        # Process batch
        directory = Path(args.directory)
        if not directory.exists():
            logger.error(f"Directory not found: {directory}")
            return

        # Find all supported files
        file_paths = []
        for ext in SUPPORTED_FORMATS.keys():
            file_paths.extend(directory.glob(f"*.{ext}"))

        if not file_paths:
            logger.error("No supported files found in directory")
            return

        logger.info(f"Found {len(file_paths)} files to process")

        ocr = BrainSAITOCR(args.api_key)

        options = {
            "extract_images": args.extract_images,
            "preserve_formatting": True,
            "auto_translate": args.auto_translate,
        }

        results = await ocr.process_batch(
            file_paths, options=options, max_concurrent=args.max_concurrent
        )

        # Export results
        output_format = OutputFormat(args.format)
        content = ocr.export_results(results, output_format, args.output)

        if not args.output:
            print(content)

        # Print final statistics
        stats = ocr.get_statistics()
        logger.info(
            f"Batch processing completed. Success rate: {stats['success_rate']:.1f}%"
        )

    elif args.command == "server":
        # Start server
        try:
            import uvicorn
        except ImportError:
            logger.error(
                "uvicorn is required to run the server. Install with: pip install uvicorn"
            )
            return

        server = BrainSAITOCRServer(args.api_key)
        logger.info(f"Starting BrainSAIT OCR server on {args.host}:{args.port}")

        uvicorn.run(server.app, host=args.host, port=args.port, reload=args.reload)

    elif args.command == "clear-cache":
        # Clear cache
        if args.api_key:
            ocr = BrainSAITOCR(args.api_key)
            removed_count = ocr.clear_cache(args.days)
        else:
            # Clear cache without OCR instance
            cache_dir = Path("ocr_cache")
            if cache_dir.exists():
                import time

                current_time = time.time()
                cutoff_time = current_time - (args.days * 24 * 60 * 60)
                removed_count = 0

                for cache_file in cache_dir.glob("*.json"):
                    if cache_file.stat().st_mtime < cutoff_time:
                        cache_file.unlink()
                        removed_count += 1

                logger.info(f"Removed {removed_count} cache files")
            else:
                logger.info("No cache directory found")

    elif args.command == "stats":
        # Show statistics
        if args.api_key:
            ocr = BrainSAITOCR(args.api_key)
            stats = ocr.get_statistics()

            print("\n📊 BrainSAIT OCR Statistics")
            print("=" * 30)
            print(f"Total Processed: {stats['total_processed']}")
            print(f"Successful: {stats['successful']}")
            print(f"Failed: {stats['failed']}")
            print(f"Cached: {stats['cached']}")
            print(f"Success Rate: {stats['success_rate']:.1f}%")
            print(f"Cache Hit Rate: {stats['cache_hit_rate']:.1f}%")
        else:
            logger.info("API key required for detailed statistics")


if __name__ == "__main__":
    # Run the CLI
    asyncio.run(main())
