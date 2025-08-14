# Contributing to BrainSAIT OCR

Thank you for your interest in contributing to BrainSAIT OCR! This document provides guidelines for contributing to the project.

## Table of Contents
- [Code of Conduct](#code-of-conduct)
- [Development Setup](#development-setup)
- [Coding Standards](#coding-standards)
- [Pull Request Process](#pull-request-process)
- [Issue Reporting](#issue-reporting)

## Code of Conduct

This project adheres to the BrainSAIT ecosystem standards. By participating, you are expected to uphold this code. Please report unacceptable behavior to [maintainers@brainsait.com](mailto:maintainers@brainsait.com).

## Development Setup

### Prerequisites
- Python 3.8+ with pip
- Node.js 18+ with npm
- Git
- Docker (optional, for containerized development)

### Local Development
```bash
# Clone the repository
git clone https://github.com/Fadil369/brainsait-ocr.git
cd brainsait-ocr

# Set up Python environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r brainsait_ocr_requirements.txt

# Set up Node.js environment
npm install

# Install development tools
pip install black flake8 mypy isort bandit pytest
npm install -g prettier eslint

# Install pre-commit hooks
pip install pre-commit
pre-commit install
```

### Environment Configuration
```bash
# Copy environment template
cp .env.example .env

# Configure required variables
MISTRAL_API_KEY=your_mistral_api_key_here
MAX_FILE_SIZE=52428800
MAX_CONCURRENT_REQUESTS=5
CACHE_EXPIRY_DAYS=30
```

## Coding Standards

### Python Standards
- **PEP 8**: Follow Python Enhancement Proposal 8 style guide
- **Line Length**: Maximum 88 characters (Black formatter standard)
- **Type Hints**: Use type hints for all function parameters and return values
- **Docstrings**: Use Google-style docstrings for all public functions and classes
- **Imports**: Follow isort formatting, unused imports not allowed

### Formatting Tools
```bash
# Format Python code
black .
isort .

# Format JavaScript/JSON
prettier --write .

# Lint Python code
flake8 --max-line-length=88 --extend-ignore=E203,W503
mypy .

# Security scanning
bandit -r .
```

### JavaScript/TypeScript Standards
- **ES6+**: Use modern JavaScript features
- **Semicolons**: Required
- **Quotes**: Single quotes for strings
- **Indentation**: 2 spaces
- **Line Length**: Maximum 100 characters

### File Organization
```
brainsait-ocr/
├── src/                    # Source code
│   ├── core/              # Core OCR functionality
│   ├── api/               # API routes and handlers
│   ├── utils/             # Utility functions
│   └── types/             # Type definitions
├── tests/                 # Test files
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── fixtures/          # Test data
├── docs/                  # Documentation
└── scripts/               # Build and deployment scripts
```

### Documentation Standards
- **README**: Keep updated with latest features and setup instructions
- **Inline Comments**: Explain complex logic and business rules
- **API Documentation**: Document all endpoints with examples
- **Code Comments**: Focus on "why" rather than "what"

## Pull Request Process

### Before Submitting
1. **Run Tests**: Ensure all tests pass
   ```bash
   python -m pytest tests/
   npm test
   ```

2. **Code Quality**: Run all linting and formatting tools
   ```bash
   black .
   flake8 .
   mypy .
   prettier --write .
   ```

3. **Security Check**: Run security scanning
   ```bash
   bandit -r .
   npm audit
   ```

### PR Requirements
- **Branch Naming**: Use descriptive names (e.g., `feature/arabic-ocr-enhancement`, `fix/memory-leak`)
- **Commit Messages**: Follow conventional commits format
- **Tests**: Add tests for new features or bug fixes
- **Documentation**: Update relevant documentation
- **Reviews**: Require at least one review from maintainers

### Commit Message Format
```
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Example:
```
feat(ocr): add Arabic text confidence scoring

Implement advanced confidence scoring for Arabic OCR results
using character-level analysis and language model validation.

Closes #123
```

## Issue Reporting

### Bug Reports
Include:
- **Environment**: OS, Python version, Node.js version
- **Steps to Reproduce**: Clear, numbered steps
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Screenshots**: If applicable
- **Logs**: Relevant error messages or log files

### Feature Requests
Include:
- **Use Case**: Why this feature is needed
- **Proposed Solution**: How it should work
- **Alternatives**: Other approaches considered
- **BrainSAIT Integration**: How it fits the ecosystem

### Security Issues
- **Do NOT** create public issues for security vulnerabilities
- Email security concerns to [security@brainsait.com](mailto:security@brainsait.com)
- Use encrypted communication when possible

## Testing Guidelines

### Test Types
- **Unit Tests**: Test individual functions and classes
- **Integration Tests**: Test component interactions
- **E2E Tests**: Test complete user workflows
- **Performance Tests**: Test processing speed and memory usage

### Test Structure
```python
# tests/unit/test_ocr_core.py
import pytest
from brainsait_ocr.core import BrainSAITOCR

class TestBrainSAITOCR:
    def test_file_validation_valid_pdf(self):
        """Test that valid PDF files pass validation."""
        # Test implementation
        pass
        
    def test_file_validation_invalid_format(self):
        """Test that invalid file formats are rejected."""
        # Test implementation
        pass
```

### Test Data
- Use fixtures for test data
- Include sample documents in multiple languages
- Test edge cases and error conditions

## Performance Guidelines

### Code Performance
- **Async Operations**: Use async/await for I/O operations
- **Memory Management**: Implement proper cleanup for large files
- **Caching**: Utilize intelligent caching strategies
- **Batch Processing**: Optimize for multiple file processing

### Monitoring
- **Logging**: Use structured logging with appropriate levels
- **Metrics**: Track processing times and success rates
- **Profiling**: Regular performance profiling for bottlenecks

## Release Process

### Version Management
- Follow semantic versioning (SemVer)
- Tag releases with version numbers
- Maintain CHANGELOG.md

### Deployment
- **Staging**: Test in staging environment first
- **Documentation**: Update deployment docs
- **Rollback Plan**: Have rollback procedures ready

## Getting Help

### Communication Channels
- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and community support
- **Email**: [dev@brainsait.com](mailto:dev@brainsait.com) for development questions

### Resources
- [BrainSAIT Ecosystem Documentation](https://docs.brainsait.com)
- [Python Style Guide](https://pep8.org/)
- [JavaScript Style Guide](https://standardjs.com/)

## License

By contributing to BrainSAIT OCR, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to BrainSAIT OCR! 🧠✨