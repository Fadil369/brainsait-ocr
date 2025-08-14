"""Test configuration and fixtures for BrainSAIT OCR tests."""

import os
import tempfile
from pathlib import Path
from typing import Generator

import pytest


@pytest.fixture
def temp_dir() -> Generator[Path, None, None]:
    """Create a temporary directory for tests."""
    with tempfile.TemporaryDirectory() as tmp_dir:
        yield Path(tmp_dir)


@pytest.fixture
def mock_api_key() -> str:
    """Mock API key for testing."""
    return "test_api_key_123"


@pytest.fixture
def sample_text() -> str:
    """Sample text for testing."""
    return "This is a sample text for testing OCR functionality."


@pytest.fixture
def sample_arabic_text() -> str:
    """Sample Arabic text for testing."""
    return "هذا نص تجريبي لاختبار وظائف التعرف الضوئي على الحروف."


@pytest.fixture
def cache_dir(temp_dir: Path) -> Path:
    """Create a temporary cache directory."""
    cache_path = temp_dir / "cache"
    cache_path.mkdir()
    return cache_path


@pytest.fixture
def output_dir(temp_dir: Path) -> Path:
    """Create a temporary output directory."""
    output_path = temp_dir / "output"
    output_path.mkdir()
    return output_path


@pytest.fixture(autouse=True)
def clean_environment():
    """Clean environment variables before each test."""
    # Store original values
    original_env = dict(os.environ)
    
    # Clean up after test
    yield
    
    # Restore original environment
    os.environ.clear()
    os.environ.update(original_env)


class MockResponse:
    """Mock response for API calls."""
    
    def __init__(self, json_data: dict, status_code: int = 200):
        self.json_data = json_data
        self.status_code = status_code
        
    async def json(self):
        return self.json_data
        
    @property
    def ok(self):
        return 200 <= self.status_code < 300


@pytest.fixture
def mock_mistral_response():
    """Mock Mistral API response."""
    return MockResponse({
        "choices": [{
            "message": {
                "content": "Extracted text from document."
            }
        }]
    })