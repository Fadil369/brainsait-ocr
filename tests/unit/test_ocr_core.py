"""Unit tests for BrainSAIT OCR core functionality."""

import pytest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from brainsait_ocr_backend import (
    BrainSAITOCR,
    DocumentMetadata,
    OCRResult,
    ProcessingResult,
    ProcessingStatus,
)


class TestBrainSAITOCR:
    """Test the main BrainSAIT OCR class."""
    
    def test_initialization(self, mock_api_key, cache_dir, output_dir):
        """Test that BrainSAIT OCR initializes correctly."""
        ocr = BrainSAITOCR(
            api_key=mock_api_key,
            cache_dir=str(cache_dir),
            output_dir=str(output_dir)
        )
        
        assert ocr.api_key == mock_api_key
        assert ocr.cache_dir == cache_dir
        assert ocr.output_dir == output_dir
        assert cache_dir.exists()
        assert output_dir.exists()
        
    def test_calculate_file_hash(self, mock_api_key, temp_dir):
        """Test file hash calculation."""
        ocr = BrainSAITOCR(api_key=mock_api_key)
        
        # Create a test file
        test_file = temp_dir / "test.txt"
        test_file.write_text("test content")
        
        hash1 = ocr._calculate_file_hash(test_file)
        hash2 = ocr._calculate_file_hash(test_file)
        
        # Same file should produce same hash
        assert hash1 == hash2
        assert len(hash1) == 64  # SHA256 hex string length
        
    def test_file_validation_valid_file(self, mock_api_key, temp_dir):
        """Test file validation for valid files."""
        ocr = BrainSAITOCR(api_key=mock_api_key)
        
        # Create a small test PDF file (mock)
        test_file = temp_dir / "test.pdf"
        test_file.write_bytes(b"PDF mock content")
        
        with patch('mimetypes.guess_type') as mock_guess:
            mock_guess.return_value = ('application/pdf', None)
            result = ocr._validate_file(test_file)
            
        assert result is True
        
    def test_file_validation_invalid_format(self, mock_api_key, temp_dir):
        """Test file validation for invalid formats."""
        ocr = BrainSAITOCR(api_key=mock_api_key)
        
        # Create a test file with unsupported format
        test_file = temp_dir / "test.docx"
        test_file.write_bytes(b"DOCX mock content")
        
        with patch('mimetypes.guess_type') as mock_guess:
            mock_guess.return_value = ('application/vnd.openxmlformats-officedocument.wordprocessingml.document', None)
            result = ocr._validate_file(test_file)
            
        assert result is False
        
    def test_file_validation_too_large(self, mock_api_key, temp_dir):
        """Test file validation for files that are too large."""
        ocr = BrainSAITOCR(api_key=mock_api_key)
        
        # Create a large test file
        test_file = temp_dir / "large.pdf"
        # Mock a file larger than MAX_FILE_SIZE
        
        with patch.object(Path, 'stat') as mock_stat:
            mock_stat.return_value.st_size = 60 * 1024 * 1024  # 60MB
            result = ocr._validate_file(test_file)
            
        assert result is False
        
    def test_file_validation_nonexistent_file(self, mock_api_key):
        """Test file validation for non-existent files."""
        ocr = BrainSAITOCR(api_key=mock_api_key)
        
        nonexistent_file = Path("/nonexistent/file.pdf")
        result = ocr._validate_file(nonexistent_file)
        
        assert result is False
        
    def test_detect_language_english(self, mock_api_key, sample_text):
        """Test language detection for English text."""
        ocr = BrainSAITOCR(api_key=mock_api_key)
        
        with patch('langdetect.detect') as mock_detect:
            mock_detect.return_value = 'en'
            result = ocr._detect_language(sample_text)
            
        assert result == 'en'
        
    def test_detect_language_arabic(self, mock_api_key, sample_arabic_text):
        """Test language detection for Arabic text."""
        ocr = BrainSAITOCR(api_key=mock_api_key)
        
        with patch('langdetect.detect') as mock_detect:
            mock_detect.return_value = 'ar'
            result = ocr._detect_language(sample_arabic_text)
            
        assert result == 'ar'
        
    def test_detect_language_short_text(self, mock_api_key):
        """Test language detection for very short text."""
        ocr = BrainSAITOCR(api_key=mock_api_key)
        
        short_text = "Hi"
        result = ocr._detect_language(short_text)
        
        assert result == "unknown"
        
    def test_detect_language_exception(self, mock_api_key, sample_text):
        """Test language detection when an exception occurs."""
        ocr = BrainSAITOCR(api_key=mock_api_key)
        
        with patch('langdetect.detect') as mock_detect:
            mock_detect.side_effect = Exception("Language detection failed")
            result = ocr._detect_language(sample_text)
            
        assert result == "unknown"
        
    def test_get_cache_path(self, mock_api_key, cache_dir):
        """Test cache path generation."""
        ocr = BrainSAITOCR(api_key=mock_api_key, cache_dir=str(cache_dir))
        
        test_hash = "abcd1234"
        cache_path = ocr._get_cache_path(test_hash)
        
        assert cache_path == cache_dir / f"{test_hash}.json"
        
    def test_statistics_tracking(self, mock_api_key):
        """Test that statistics are properly tracked."""
        ocr = BrainSAITOCR(api_key=mock_api_key)
        
        stats = ocr.get_statistics()
        
        assert 'total_processed' in stats
        assert 'successful' in stats
        assert 'failed' in stats
        assert 'cached' in stats
        assert all(isinstance(v, int) for v in stats.values())


class TestDataStructures:
    """Test the data structure classes."""
    
    def test_document_metadata_creation(self):
        """Test DocumentMetadata creation and auto-population."""
        metadata = DocumentMetadata(
            file_name="test.pdf",
            file_size=1024,
            file_type="application/pdf",
            file_hash="abc123"
        )
        
        assert metadata.file_name == "test.pdf"
        assert metadata.file_size == 1024
        assert metadata.file_type == "application/pdf"
        assert metadata.file_hash == "abc123"
        assert metadata.created_at is not None
        
    def test_ocr_result_creation(self, sample_text):
        """Test OCRResult creation."""
        result = OCRResult(
            text=sample_text,
            confidence=0.95,
            language="en"
        )
        
        assert result.text == sample_text
        assert result.confidence == 0.95
        assert result.language == "en"
        assert result.images == []
        assert result.tables == []
        assert result.structure == {}
        
    def test_processing_result_creation(self):
        """Test ProcessingResult creation."""
        metadata = DocumentMetadata(
            file_name="test.pdf",
            file_size=1024,
            file_type="application/pdf",
            file_hash="abc123"
        )
        
        ocr_result = OCRResult(text="test text")
        
        result = ProcessingResult(
            metadata=metadata,
            ocr_result=ocr_result,
            status=ProcessingStatus.COMPLETED
        )
        
        assert result.metadata == metadata
        assert result.ocr_result == ocr_result
        assert result.status == ProcessingStatus.COMPLETED
        assert result.error_message is None
        assert result.processing_options == {}