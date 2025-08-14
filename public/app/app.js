// BrainSAIT OCR App
class BrainSAITApp {
    constructor() {
        this.apiUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:8787/api' 
            : '/api';
        this.token = localStorage.getItem('auth_token');
        this.user = null;
        this.processedFiles = [];
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        
        if (this.token) {
            await this.checkAuth();
        }
        
        await this.loadHistory();
    }

    setupEventListeners() {
        // File upload
        const uploadZone = document.getElementById('uploadZone');
        const fileInput = document.getElementById('fileInput');
        
        uploadZone.addEventListener('click', () => fileInput.click());
        uploadZone.addEventListener('dragover', this.handleDragOver.bind(this));
        uploadZone.addEventListener('drop', this.handleDrop.bind(this));
        fileInput.addEventListener('change', this.handleFileSelect.bind(this));
        
        // Auth forms
        document.getElementById('loginForm').addEventListener('submit', this.handleLogin.bind(this));
        document.getElementById('registerForm').addEventListener('submit', this.handleRegister.bind(this));
    }

    // Authentication Methods
    async checkAuth() {
        try {
            const response = await this.apiCall('/users/profile', 'GET');
            
            if (response.success) {
                this.user = response.user;
                this.updateUI();
            } else {
                this.logout();
            }
        } catch (error) {
            console.error('Auth check failed:', error);
            this.logout();
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        try {
            const response = await fetch(`${this.apiUrl}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.token = data.token;
                this.user = data.user;
                localStorage.setItem('auth_token', this.token);
                
                this.hideAuth();
                this.updateUI();
                this.showNotification('تم تسجيل الدخول بنجاح', 'success');
                await this.loadHistory();
            } else {
                this.showNotification(data.error || 'خطأ في تسجيل الدخول', 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showNotification('خطأ في الاتصال بالخادم', 'error');
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const phone = document.getElementById('registerPhone').value;
        const password = document.getElementById('registerPassword').value;
        
        try {
            const response = await fetch(`${this.apiUrl}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, phone, password })
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.token = data.token;
                this.user = data.user;
                localStorage.setItem('auth_token', this.token);
                
                this.hideAuth();
                this.updateUI();
                this.showNotification('تم إنشاء الحساب بنجاح! حصلت على 10 معالجات مجانية', 'success');
            } else {
                this.showNotification(data.error || 'خطأ في إنشاء الحساب', 'error');
            }
        } catch (error) {
            console.error('Register error:', error);
            this.showNotification('خطأ في الاتصال بالخادم', 'error');
        }
    }

    logout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('auth_token');
        this.updateUI();
        
        // Call logout endpoint to blacklist token
        if (this.token) {
            this.apiCall('/auth/logout', 'POST').catch(console.error);
        }
    }

    // UI Methods
    updateUI() {
        const userInfo = document.getElementById('userInfo');
        const loginBtn = document.getElementById('loginBtn');
        const logoutBtn = document.getElementById('logoutBtn');
        
        if (this.user) {
            document.getElementById('userName').textContent = this.user.name;
            document.getElementById('userCredits').textContent = 
                this.user.subscription_tier === 'enterprise' ? '∞' : this.user.credits;
            
            userInfo.classList.remove('hidden');
            logoutBtn.classList.remove('hidden');
            loginBtn.classList.add('hidden');
        } else {
            userInfo.classList.add('hidden');
            logoutBtn.classList.add('hidden');
            loginBtn.classList.remove('hidden');
        }
    }

    showAuth(mode = 'login') {
        const modal = document.getElementById('authModal');
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const authTitle = document.getElementById('authTitle');
        const authToggle = document.getElementById('authToggle');
        
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        
        if (mode === 'login') {
            loginForm.classList.remove('hidden');
            registerForm.classList.add('hidden');
            authTitle.textContent = 'تسجيل الدخول';
            authToggle.textContent = 'ليس لديك حساب؟ إنشاء حساب جديد';
        } else {
            loginForm.classList.add('hidden');
            registerForm.classList.remove('hidden');
            authTitle.textContent = 'إنشاء حساب جديد';
            authToggle.textContent = 'لديك حساب بالفعل؟ تسجيل الدخول';
        }
    }

    hideAuth() {
        const modal = document.getElementById('authModal');
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }

    // File Upload Methods
    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        e.currentTarget.classList.add('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        e.currentTarget.classList.remove('dragover');
        const files = Array.from(e.dataTransfer.files);
        this.processFiles(files);
    }

    handleFileSelect(e) {
        const files = Array.from(e.target.files);
        this.processFiles(files);
    }

    async processFiles(files) {
        if (!this.token) {
            this.showAuth('login');
            this.showNotification('يرجى تسجيل الدخول أولاً', 'error');
            return;
        }

        // Validate files
        const validFiles = files.filter(file => {
            const validTypes = ['application/pdf', 'image/png', 'image/jpeg'];
            const maxSize = 50 * 1024 * 1024; // 50MB
            
            if (!validTypes.includes(file.type)) {
                this.showNotification(`نوع الملف غير مدعوم: ${file.name}`, 'error');
                return false;
            }
            
            if (file.size > maxSize) {
                this.showNotification(`حجم الملف كبير جداً: ${file.name}`, 'error');
                return false;
            }
            
            return true;
        });

        if (validFiles.length === 0) return;

        // Show processing section
        document.getElementById('processingSection').classList.remove('hidden');
        
        // Process each file
        for (let i = 0; i < validFiles.length; i++) {
            await this.processFile(validFiles[i], i);
        }
    }

    async processFile(file, index) {
        this.addFileToQueue(file, index, 'processing');
        
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('extractImages', document.getElementById('extractImages').checked);
            formData.append('preserveFormatting', document.getElementById('preserveFormatting').checked);
            formData.append('autoTranslate', document.getElementById('autoTranslate').checked);
            
            const response = await fetch(`${this.apiUrl}/ocr/process`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                },
                body: formData
            });
            
            const data = await response.json();
            
            if (data.success) {
                this.updateFileStatus(index, 'completed');
                this.processedFiles.push({
                    fileName: file.name,
                    result: data.result,
                    cached: data.cached
                });
                
                if (data.cached) {
                    this.showNotification(`تم تحميل النتيجة من الذاكرة المؤقتة: ${file.name}`, 'info');
                }
                
                // Update credits
                if (this.user && data.creditsRemaining !== 'unlimited') {
                    this.user.credits = data.creditsRemaining;
                    this.updateUI();
                }
                
                // Show results if this is the first completed file
                if (this.processedFiles.length === 1) {
                    this.showResults();
                }
            } else {
                this.updateFileStatus(index, 'error');
                this.showNotification(`خطأ في معالجة ${file.name}: ${data.error}`, 'error');
                
                if (response.status === 402) {
                    // Insufficient credits
                    setTimeout(() => {
                        window.location.href = '/#pricing';
                    }, 2000);
                }
            }
        } catch (error) {
            console.error('File processing error:', error);
            this.updateFileStatus(index, 'error');
            this.showNotification(`خطأ في معالجة ${file.name}`, 'error');
        }
    }

    addFileToQueue(file, index, status) {
        const queueElement = document.getElementById('fileQueue');
        const fileDiv = document.createElement('div');
        fileDiv.id = `file-${index}`;
        fileDiv.className = 'flex items-center justify-between glass rounded-lg p-3';
        
        fileDiv.innerHTML = `
            <div class="flex items-center space-x-3">
                <div class="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center">
                    <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"/>
                    </svg>
                </div>
                <div>
                    <p class="text-white font-medium">${file.name}</p>
                    <p class="text-purple-200 text-sm">${this.formatFileSize(file.size)}</p>
                </div>
            </div>
            <div id="status-${index}" class="flex items-center">
                <div class="spinner w-5 h-5"></div>
            </div>
        `;
        
        queueElement.appendChild(fileDiv);
    }

    updateFileStatus(index, status) {
        const statusElement = document.getElementById(`status-${index}`);
        
        if (status === 'completed') {
            statusElement.innerHTML = `
                <svg class="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                </svg>
            `;
        } else if (status === 'error') {
            statusElement.innerHTML = `
                <svg class="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                </svg>
            `;
        }
    }

    showResults() {
        const resultsSection = document.getElementById('resultsSection');
        resultsSection.classList.remove('hidden');
        
        if (this.processedFiles.length > 0) {
            const firstFile = this.processedFiles[0];
            this.displayFileResults(firstFile);
        }
    }

    displayFileResults(fileData) {
        // Display extracted text
        const extractedTextElement = document.getElementById('extractedText');
        extractedTextElement.textContent = fileData.result.text;
        
        // Display metadata
        const metadataElement = document.getElementById('documentMetadata');
        metadataElement.innerHTML = `
            <div class="text-purple-200">
                <span class="font-medium">اسم الملف:</span>
                <span class="text-white">${fileData.fileName}</span>
            </div>
            <div class="text-purple-200">
                <span class="font-medium">اللغة:</span>
                <span class="text-white">${fileData.result.language || 'غير محدد'}</span>
            </div>
            <div class="text-purple-200">
                <span class="font-medium">الدقة:</span>
                <span class="text-white">${(fileData.result.confidence * 100).toFixed(1)}%</span>
            </div>
            ${fileData.cached ? '<div class="text-yellow-400 text-sm">✓ من الذاكرة المؤقتة</div>' : ''}
        `;
    }

    // History and Export Methods
    async loadHistory() {
        if (!this.token) return;
        
        try {
            const response = await this.apiCall('/ocr/history?limit=10', 'GET');
            
            if (response.success && response.history.length > 0) {
                this.displayHistory(response.history);
            }
        } catch (error) {
            console.error('History load error:', error);
        }
    }

    displayHistory(history) {
        const historyList = document.getElementById('historyList');
        
        historyList.innerHTML = history.map(item => `
            <div class="glass rounded-lg p-3 flex items-center justify-between">
                <div>
                    <p class="text-white font-medium">${item.file_name}</p>
                    <p class="text-purple-200 text-sm">
                        ${new Date(item.created_at).toLocaleDateString('ar-SA')} • 
                        ${item.language || 'غير محدد'} • 
                        ${(item.confidence * 100).toFixed(0)}%
                    </p>
                </div>
                <button onclick="app.viewResult('${item.id}')" class="text-purple-200 hover:text-white">
                    عرض
                </button>
            </div>
        `).join('');
    }

    async viewResult(resultId) {
        try {
            const response = await this.apiCall(`/ocr/result/${resultId}`, 'GET');
            
            if (response.success) {
                // Show result in modal or update current display
                this.displayFileResults({
                    fileName: response.result.file_name,
                    result: {
                        text: response.result.extracted_text,
                        language: response.result.language,
                        confidence: response.result.confidence
                    },
                    cached: false
                });
                
                document.getElementById('resultsSection').classList.remove('hidden');
            }
        } catch (error) {
            console.error('Result view error:', error);
            this.showNotification('خطأ في عرض النتيجة', 'error');
        }
    }

    async downloadResults(format) {
        if (this.processedFiles.length === 0) return;
        
        let content, filename, mimeType;
        
        if (format === 'json') {
            content = JSON.stringify({
                timestamp: new Date().toISOString(),
                files: this.processedFiles
            }, null, 2);
            filename = 'brainsait-ocr-results.json';
            mimeType = 'application/json';
        } else if (format === 'markdown') {
            content = this.generateMarkdown();
            filename = 'brainsait-ocr-results.md';
            mimeType = 'text/markdown';
        }
        
        this.downloadFile(content, filename, mimeType);
    }

    generateMarkdown() {
        let markdown = '# BrainSAIT OCR Results\n\n';
        markdown += `Generated: ${new Date().toISOString()}\n\n`;
        
        this.processedFiles.forEach((file, index) => {
            markdown += `## ${index + 1}. ${file.fileName}\n\n`;
            markdown += `**Language:** ${file.result.language || 'Unknown'}\n`;
            markdown += `**Confidence:** ${(file.result.confidence * 100).toFixed(1)}%\n\n`;
            markdown += '### Content\n\n';
            markdown += file.result.text + '\n\n';
            markdown += '---\n\n';
        });
        
        return markdown;
    }

    async copyToClipboard() {
        if (this.processedFiles.length === 0) return;
        
        const allText = this.processedFiles.map(file => file.result.text).join('\n\n---\n\n');
        
        try {
            await navigator.clipboard.writeText(allText);
            this.showNotification('تم نسخ النص إلى الحافظة', 'success');
        } catch (error) {
            console.error('Clipboard error:', error);
            this.showNotification('خطأ في نسخ النص', 'error');
        }
    }

    // Utility Methods
    async apiCall(endpoint, method = 'GET', data = null) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`
            }
        };
        
        if (data && method !== 'GET') {
            options.body = JSON.stringify(data);
        }
        
        const response = await fetch(`${this.apiUrl}${endpoint}`, options);
        return response.json();
    }

    formatFileSize(bytes) {
        const sizes = ['بايت', 'كيلوبايت', 'ميجابايت', 'جيجابايت'];
        if (bytes === 0) return '0 بايت';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `fixed top-4 left-4 z-50 p-4 rounded-lg shadow-lg transition-all transform translate-x-full max-w-md`;
        
        const bgColor = type === 'success' ? 'bg-green-500' : 
                        type === 'error' ? 'bg-red-500' : 
                        type === 'warning' ? 'bg-yellow-500' : 'bg-blue-500';
        notification.classList.add(bgColor);
        
        notification.innerHTML = `
            <div class="flex items-start space-x-3">
                <span class="text-white flex-1">${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" class="text-white hover:text-gray-200 flex-shrink-0">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                    </svg>
                </button>
            </div>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.remove('translate-x-full');
        }, 100);
        
        setTimeout(() => {
            notification.classList.add('translate-x-full');
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 300);
        }, 5000);
    }
}

// Global functions
function showAuth(mode) {
    app.showAuth(mode);
}

function hideAuth() {
    app.hideAuth();
}

function toggleAuthForm() {
    const loginForm = document.getElementById('loginForm');
    const isLoginVisible = !loginForm.classList.contains('hidden');
    
    showAuth(isLoginVisible ? 'register' : 'login');
}

function logout() {
    app.logout();
}

function downloadResults(format) {
    app.downloadResults(format);
}

function copyToClipboard() {
    app.copyToClipboard();
}

// Initialize app
const app = new BrainSAITApp();