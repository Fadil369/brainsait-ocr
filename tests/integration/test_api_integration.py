"""Integration tests for BrainSAIT OCR API endpoints."""

import json
import tempfile
from pathlib import Path
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from brainsait_ocr_backend import BrainSAITOCRServer


class TestOCRAPIIntegration:
    """Test OCR API endpoints integration."""
    
    @pytest.fixture
    def client(self, mock_api_key):
        """Create a test client for the OCR server."""
        server = BrainSAITOCRServer(api_key=mock_api_key, port=8000)
        return TestClient(server.app)
        
    @pytest.fixture
    def mock_pdf_file(self):
        """Create a mock PDF file for testing."""
        content = b"%PDF-1.4 mock PDF content"
        return ("test.pdf", content, "application/pdf")
        
    def test_health_check(self, client):
        """Test the health check endpoint."""
        response = client.get("/health")
        assert response.status_code == 200
        
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        
    @patch('brainsait_ocr_backend.BrainSAITOCR.process_file')
    def test_process_single_document(self, mock_process, client, mock_pdf_file):
        """Test processing a single document."""
        # Mock the OCR processing result
        mock_result = AsyncMock()
        mock_result.text = "Extracted text content"
        mock_result.confidence = 0.95
        mock_result.language = "en"
        mock_process.return_value = mock_result
        
        filename, content, content_type = mock_pdf_file
        
        response = client.post(
            "/api/ocr/process",
            files={"file": (filename, content, content_type)},
            data={
                "extract_images": "true",
                "preserve_formatting": "true",
                "auto_translate": "false"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "result" in data
        
    def test_process_unsupported_file_type(self, client):
        """Test processing an unsupported file type."""
        response = client.post(
            "/api/ocr/process",
            files={"file": ("test.docx", b"content", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")}
        )
        
        assert response.status_code == 400
        assert "Unsupported file type" in response.json()["detail"]
        
    @patch('brainsait_ocr_backend.BrainSAITOCR.process_batch')
    def test_process_batch_documents(self, mock_process_batch, client, mock_pdf_file):
        """Test batch processing of documents."""
        # Mock the batch processing result
        mock_results = [AsyncMock(), AsyncMock()]
        for i, result in enumerate(mock_results):
            result.text = f"Extracted text content {i+1}"
            result.confidence = 0.95
            result.language = "en"
        mock_process_batch.return_value = mock_results
        
        filename, content, content_type = mock_pdf_file
        files = [
            ("files", (f"test1.pdf", content, content_type)),
            ("files", (f"test2.pdf", content, content_type))
        ]
        
        response = client.post(
            "/api/ocr/batch",
            files=files,
            data={
                "extract_images": "true",
                "preserve_formatting": "true",
                "auto_translate": "false",
                "max_concurrent": "2"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "results" in data
        assert "statistics" in data
        
    def test_batch_too_many_files(self, client, mock_pdf_file):
        """Test batch processing with too many files."""
        filename, content, content_type = mock_pdf_file
        
        # Create 11 files (exceeds the limit of 10)
        files = [
            ("files", (f"test{i}.pdf", content, content_type))
            for i in range(11)
        ]
        
        response = client.post("/api/ocr/batch", files=files)
        
        assert response.status_code == 400
        assert "Maximum 10 files allowed" in response.json()["detail"]
        
    def test_get_statistics(self, client):
        """Test getting processing statistics."""
        response = client.get("/api/statistics")
        
        assert response.status_code == 200
        data = response.json()
        assert "total_processed" in data
        assert "successful" in data
        assert "failed" in data
        assert "cached" in data
        
    def test_clear_cache(self, client):
        """Test cache clearing endpoint."""
        response = client.delete("/api/cache/clear")
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "cleared_files" in data


class TestCORSIntegration:
    """Test CORS configuration."""
    
    @pytest.fixture
    def client(self, mock_api_key):
        """Create a test client for the OCR server."""
        server = BrainSAITOCRServer(api_key=mock_api_key, port=8000)
        return TestClient(server.app)
        
    def test_cors_headers(self, client):
        """Test that CORS headers are properly set."""
        response = client.options(
            "/api/ocr/process",
            headers={"Origin": "http://localhost:3000"}
        )
        
        # Should allow the request
        assert response.status_code in [200, 204]


class TestErrorHandling:
    """Test error handling in API endpoints."""
    
    @pytest.fixture
    def client(self, mock_api_key):
        """Create a test client for the OCR server."""
        server = BrainSAITOCRServer(api_key=mock_api_key, port=8000)
        return TestClient(server.app)
        
    def test_missing_file_parameter(self, client):
        """Test handling of missing file parameter."""
        response = client.post("/api/ocr/process")
        
        assert response.status_code == 422  # Unprocessable Entity
        
    @patch('brainsait_ocr_backend.BrainSAITOCR.process_file')
    def test_processing_error_handling(self, mock_process, client, mock_pdf_file):
        """Test handling of processing errors."""
        mock_process.side_effect = Exception("Processing failed")
        
        filename, content, content_type = mock_pdf_file
        
        response = client.post(
            "/api/ocr/process",
            files={"file": (filename, content, content_type)}
        )
        
        assert response.status_code == 500
        assert "Processing failed" in response.json()["detail"]