# Makefile for BrainSAIT OCR development and deployment

.PHONY: install dev test lint format clean docker-build docker-run deploy help

# Variables
PYTHON := python3
PIP := pip3
DOCKER_TAG := brainsait-ocr:latest
VENV_DIR := venv

# Default target
help:
	@echo "BrainSAIT OCR Development Commands"
	@echo "=================================="
	@echo ""
	@echo "Setup Commands:"
	@echo "  install         Install production dependencies"
	@echo "  dev            Install development dependencies and setup"
	@echo "  venv           Create virtual environment"
	@echo ""
	@echo "Code Quality Commands:"
	@echo "  lint           Run all linters (flake8, mypy, eslint)"
	@echo "  format         Format code with Black and Prettier"
	@echo "  security       Run security checks with bandit"
	@echo "  fix            Fix common issues automatically"
	@echo ""
	@echo "Testing Commands:"
	@echo "  test           Run all tests"
	@echo "  test-unit      Run unit tests only"
	@echo "  test-integration  Run integration tests only"
	@echo "  test-coverage  Run tests with coverage report"
	@echo "  benchmark      Run performance benchmarks"
	@echo ""
	@echo "Docker Commands:"
	@echo "  docker-build   Build Docker image"
	@echo "  docker-run     Run with Docker Compose"
	@echo "  docker-stop    Stop Docker containers"
	@echo "  docker-logs    View Docker logs"
	@echo ""
	@echo "Deployment Commands:"
	@echo "  deploy         Deploy to Cloudflare"
	@echo "  deploy-worker  Deploy worker only"
	@echo "  deploy-pages   Deploy pages only"
	@echo ""
	@echo "Utility Commands:"
	@echo "  clean          Clean build artifacts and cache"
	@echo "  docs           Generate documentation"
	@echo "  requirements   Update requirements files"

# Installation commands
venv:
	$(PYTHON) -m venv $(VENV_DIR)
	@echo "Virtual environment created. Activate with: source $(VENV_DIR)/bin/activate"

install:
	$(PIP) install -r brainsait_ocr_requirements.txt

dev: venv
	. $(VENV_DIR)/bin/activate && \
	$(PIP) install -r brainsait_ocr_requirements.txt && \
	$(PIP) install pytest pytest-asyncio pytest-cov fastapi[all] httpx && \
	npm install && \
	pre-commit install
	@echo "Development environment setup complete!"

# Code quality commands
lint:
	@echo "Running Python linting..."
	flake8 brainsait_ocr_backend.py --max-line-length=88 --extend-ignore=E203,W503
	mypy brainsait_ocr_backend.py --ignore-missing-imports
	@echo "Running JavaScript linting..."
	npx eslint src/ public/app/ --ext .js
	@echo "Running security checks..."
	bandit -r . -f json -o bandit-report.json || true
	@echo "Linting complete!"

format:
	@echo "Formatting Python code..."
	black .
	isort . --profile=black
	@echo "Formatting JavaScript code..."
	npx prettier --write "**/*.{js,json,yaml,yml,md}"
	@echo "Formatting complete!"

security:
	@echo "Running security analysis..."
	bandit -r . -ll
	npm audit
	@echo "Security analysis complete!"

fix: format
	@echo "Running automatic fixes..."
	# Fix common Python issues
	autopep8 --in-place --max-line-length=88 brainsait_ocr_backend.py || true
	# Fix JavaScript issues
	npx eslint src/ public/app/ --ext .js --fix || true
	@echo "Automatic fixes complete!"

# Testing commands
test:
	@echo "Running all tests..."
	$(PYTHON) -m pytest tests/ -v

test-unit:
	@echo "Running unit tests..."
	$(PYTHON) -m pytest tests/unit/ -v

test-integration:
	@echo "Running integration tests..."
	$(PYTHON) -m pytest tests/integration/ -v

test-coverage:
	@echo "Running tests with coverage..."
	$(PYTHON) -m pytest tests/ -v --cov=brainsait_ocr_backend --cov-report=html --cov-report=term

benchmark:
	@echo "Running performance benchmarks..."
	$(PYTHON) tests/benchmark_processing.py 2>/dev/null || echo "Benchmark script not found"

# Docker commands
docker-build:
	docker build -t $(DOCKER_TAG) .

docker-run:
	docker-compose up -d

docker-stop:
	docker-compose down

docker-logs:
	docker-compose logs -f

# Deployment commands
deploy:
	@echo "Deploying to Cloudflare..."
	chmod +x scripts/deploy.sh
	./scripts/deploy.sh

deploy-worker:
	@echo "Deploying Cloudflare Worker..."
	npx wrangler deploy

deploy-pages:
	@echo "Deploying Cloudflare Pages..."
	npx wrangler pages deploy ./public --project-name=brainsait-ocr

# Utility commands
clean:
	@echo "Cleaning build artifacts..."
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	rm -rf build/ dist/ .coverage htmlcov/ .mypy_cache/ .tox/
	rm -rf node_modules/.cache/
	rm -f bandit-report.json
	@echo "Clean complete!"

docs:
	@echo "Generating documentation..."
	$(PYTHON) -c "import brainsait_ocr_backend; help(brainsait_ocr_backend)" > docs/api_reference.txt || true
	@echo "Documentation generated!"

requirements:
	@echo "Updating requirements..."
	$(PIP) freeze > requirements-freeze.txt
	@echo "Requirements updated in requirements-freeze.txt"

# Pre-commit hooks
pre-commit:
	pre-commit run --all-files

# Quick development server
server:
	@echo "Starting development server..."
	$(PYTHON) brainsait_ocr_backend.py server --api-key demo --port 8000 --reload

# File watching for development
watch:
	@echo "Starting file watcher..."
	find . -name "*.py" | entr -r make test-unit