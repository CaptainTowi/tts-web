// Text-to-Speech Reader JavaScript
class TextToSpeechReader {
    constructor() {
        this.currentText = '';
        this.sentences = [];
        this.currentSentenceIndex = 0;
        this.isPlaying = false;
        this.isPaused = false;
        this.speechSynthesis = window.speechSynthesis;
        this.currentUtterance = null;
        this.voices = [];
        this.selectedVoice = null;
        this.speed = 1.0;
        this.volume = 1.0;
        
        this.initializeElements();
        this.setupEventListeners();
        this.loadVoices();
    }

    initializeElements() {
        // Text input elements
        this.textInput = document.getElementById('textInput');
        this.readTextBtn = document.getElementById('readTextBtn');
        this.clearTextBtn = document.getElementById('clearTextBtn');
        this.textStats = document.getElementById('textStats');
        
        // File handling elements
        this.fileInput = document.getElementById('fileInput');
        this.uploadArea = document.getElementById('uploadArea');
        this.fileList = document.getElementById('fileList');
        
        // Content elements
        this.contentSection = document.getElementById('contentSection');
        this.contentDisplay = document.getElementById('contentDisplay');
        this.documentTitle = document.getElementById('documentTitle');
        this.toggleContentBtn = document.getElementById('toggleContentBtn');
        
        // Player elements
        this.playerSection = document.getElementById('playerSection');
        this.playPauseBtn = document.getElementById('playPauseBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        
        // Controls
        this.voiceSelect = document.getElementById('voiceSelect');
        this.speedRange = document.getElementById('speedRange');
        this.speedValue = document.getElementById('speedValue');
        this.volumeRange = document.getElementById('volumeRange');
        this.progressBar = document.getElementById('progressBar');
        this.progressFill = document.getElementById('progressFill');
        this.currentTime = document.getElementById('currentTime');
        this.totalTime = document.getElementById('totalTime');
        
        // Status and loading
        this.statusDisplay = document.getElementById('statusDisplay');
        this.loadingOverlay = document.getElementById('loadingOverlay');
    }

    setupEventListeners() {
        // Text input events
        this.textInput.addEventListener('input', () => this.updateTextStats());
        this.readTextBtn.addEventListener('click', () => this.readDirectText());
        this.clearTextBtn.addEventListener('click', () => this.clearTextInput());
        
        // File upload events
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.uploadArea.addEventListener('click', () => this.fileInput.click());
        this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.uploadArea.addEventListener('drop', (e) => this.handleFileDrop(e));
        
        // Player controls
        this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        this.stopBtn.addEventListener('click', () => this.stopSpeech());
        this.prevBtn.addEventListener('click', () => this.previousSentence());
        this.nextBtn.addEventListener('click', () => this.nextSentence());
        
        // Settings controls
        this.voiceSelect.addEventListener('change', () => this.changeVoice());
        this.speedRange.addEventListener('input', () => this.changeSpeed());
        this.volumeRange.addEventListener('input', () => this.changeVolume());
        this.progressBar.addEventListener('click', (e) => this.seekToPosition(e));
        
        // Content toggle
        this.toggleContentBtn.addEventListener('click', () => this.toggleContentDisplay());
        
        // Speech synthesis events
        this.speechSynthesis.addEventListener('voiceschanged', () => this.loadVoices());
        
        // Initialize text stats
        this.updateTextStats();
    }

    // Text input methods
    updateTextStats() {
        const text = this.textInput.value;
        const charCount = text.length;
        const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
        this.textStats.textContent = `${charCount} characters, ${wordCount} words`;
    }

    readDirectText() {
        const text = this.textInput.value.trim();
        if (!text) {
            this.updateStatus('Please enter some text to read');
            return;
        }

        this.loadTextContent(text, 'Direct Text Input');
    }

    clearTextInput() {
        this.textInput.value = '';
        this.updateTextStats();
        this.updateStatus('Text input cleared');
    }

    loadTextContent(text, title = 'Text Content') {
        this.currentText = text;
        this.sentences = this.splitIntoSentences(text);
        this.currentSentenceIndex = 0;
        
        // Update UI
        this.documentTitle.textContent = title;
        this.contentDisplay.innerHTML = this.highlightText(text, -1);
        this.contentSection.style.display = 'block';
        this.playerSection.style.display = 'block';
        
        // Update time display
        this.updateTimeDisplay();
        
        this.updateStatus(`Loaded: ${title} (${this.sentences.length} sentences)`);
    }

    // File handling methods
    handleFileSelect(event) {
        const files = Array.from(event.target.files);
        this.processFiles(files);
    }

    handleDragOver(event) {
        event.preventDefault();
        this.uploadArea.classList.add('dragover');
    }

    handleDragLeave(event) {
        event.preventDefault();
        this.uploadArea.classList.remove('dragover');
    }

    handleFileDrop(event) {
        event.preventDefault();
        this.uploadArea.classList.remove('dragover');
        const files = Array.from(event.dataTransfer.files);
        this.processFiles(files);
    }

    async processFiles(files) {
        this.showLoading(true);
        this.updateStatus('Processing files...');
        
        this.fileList.innerHTML = '';
        
        for (const file of files) {
            await this.processFile(file);
        }
        
        this.showLoading(false);
        this.updateStatus('Files processed successfully');
    }

    async processFile(file) {
        const fileItem = this.createFileItem(file);
        this.fileList.appendChild(fileItem);
        
        try {
            let text = '';
            const fileExtension = file.name.split('.').pop().toLowerCase();
            
            switch (fileExtension) {
                case 'txt':
                    text = await this.parseTextFile(file);
                    break;
                case 'html':
                    text = await this.parseHtmlFile(file);
                    break;
                case 'pdf':
                    text = await this.parsePdfFile(file);
                    break;
                case 'docx':
                    text = await this.parseDocxFile(file);
                    break;
                case 'epub':
                    text = await this.parseEpubFile(file);
                    break;
                case 'mobi':
                    text = await this.parseMobiFile(file);
                    break;
                default:
                    throw new Error(`Unsupported file format: ${fileExtension}`);
            }
            
            // Store the parsed text with the file item
            fileItem.dataset.text = text;
            fileItem.dataset.filename = file.name;
            
            // Update file item status
            const statusSpan = fileItem.querySelector('.file-status');
            statusSpan.textContent = 'Ready';
            statusSpan.style.color = 'var(--success-color)';
            
        } catch (error) {
            console.error('Error processing file:', error);
            const statusSpan = fileItem.querySelector('.file-status');
            statusSpan.textContent = 'Error';
            statusSpan.style.color = 'var(--error-color)';
            this.updateStatus(`Error processing ${file.name}: ${error.message}`);
        }
    }

    createFileItem(file) {
        const fileItem = document.createElement('div');
        fileItem.className = 'file-item fade-in';
        
        const fileSize = this.formatFileSize(file.size);
        const fileIcon = this.getFileIcon(file.name);
        
        fileItem.innerHTML = `
            <div class="file-info">
                <i class="file-icon ${fileIcon}"></i>
                <div class="file-details">
                    <h4>${file.name}</h4>
                    <p>${fileSize} • <span class="file-status">Processing...</span></p>
                </div>
            </div>
            <div class="file-actions">
                <button class="action-btn primary" onclick="reader.loadDocument(this.parentElement.parentElement)">
                    <i class="fas fa-play"></i> Read
                </button>
                <button class="action-btn" onclick="reader.removeFile(this.parentElement.parentElement)">
                    <i class="fas fa-trash"></i> Remove
                </button>
            </div>
        `;
        
        return fileItem;
    }

    getFileIcon(filename) {
        const extension = filename.split('.').pop().toLowerCase();
        const iconMap = {
            'txt': 'fas fa-file-alt',
            'html': 'fab fa-html5',
            'pdf': 'fas fa-file-pdf',
            'docx': 'fas fa-file-word',
            'epub': 'fas fa-book',
            'mobi': 'fas fa-book-open'
        };
        return iconMap[extension] || 'fas fa-file';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Document parsing methods
    async parseTextFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Failed to read text file'));
            reader.readAsText(file);
        });
    }

    async parseHtmlFile(file) {
        const htmlContent = await this.parseTextFile(file);
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, 'text/html');
        
        // Remove script and style elements
        const scripts = doc.querySelectorAll('script, style');
        scripts.forEach(el => el.remove());
        
        return doc.body.textContent || doc.body.innerText || '';
    }

    async parsePdfFile(file) {
        return new Promise(async (resolve, reject) => {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
                let fullText = '';
                
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    fullText += pageText + ' ';
                }
                
                resolve(fullText.trim());
            } catch (error) {
                reject(new Error('Failed to parse PDF file: ' + error.message));
            }
        });
    }

    async parseDocxFile(file) {
        return new Promise(async (resolve, reject) => {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer });
                resolve(result.value);
            } catch (error) {
                reject(new Error('Failed to parse DOCX file: ' + error.message));
            }
        });
    }

    async parseEpubFile(file) {
        // For now, return a placeholder. EPUB parsing requires additional libraries
        return new Promise((resolve, reject) => {
            reject(new Error('EPUB parsing not yet implemented. Please use a different format.'));
        });
    }

    async parseMobiFile(file) {
        // For now, return a placeholder. MOBI parsing requires additional libraries
        return new Promise((resolve, reject) => {
            reject(new Error('MOBI parsing not yet implemented. Please use a different format.'));
        });
    }

    // Document loading and display
    loadDocument(fileItem) {
        const text = fileItem.dataset.text;
        const filename = fileItem.dataset.filename;
        
        if (!text) {
            this.updateStatus('No text content available for this file');
            return;
        }
        
        this.loadTextContent(text, filename);
    }

    splitIntoSentences(text) {
        // Simple sentence splitting - can be improved with more sophisticated NLP
        return text.match(/[^\.!?]+[\.!?]+/g) || [text];
    }

    highlightText(text, currentIndex) {
        if (currentIndex < 0) return text;
        
        const sentences = this.splitIntoSentences(text);
        return sentences.map((sentence, index) => {
            if (index === currentIndex) {
                return `<span class="current-sentence">${sentence}</span>`;
            }
            return sentence;
        }).join('');
    }

    // Text-to-Speech methods
    loadVoices() {
        this.voices = this.speechSynthesis.getVoices();
        this.populateVoiceSelect();
    }

    populateVoiceSelect() {
        this.voiceSelect.innerHTML = '<option value="">Select Voice</option>';
        
        this.voices.forEach((voice, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${voice.name} (${voice.lang})`;
            this.voiceSelect.appendChild(option);
        });
        
        // Select default voice
        if (this.voices.length > 0) {
            this.selectedVoice = this.voices[0];
            this.voiceSelect.value = 0;
        }
    }

    changeVoice() {
        const selectedIndex = this.voiceSelect.value;
        if (selectedIndex !== '') {
            this.selectedVoice = this.voices[selectedIndex];
        }
    }

    changeSpeed() {
        this.speed = parseFloat(this.speedRange.value);
        this.speedValue.textContent = this.speed.toFixed(1) + 'x';
        
        if (this.currentUtterance) {
            this.currentUtterance.rate = this.speed;
        }
    }

    changeVolume() {
        this.volume = parseFloat(this.volumeRange.value);
        
        if (this.currentUtterance) {
            this.currentUtterance.volume = this.volume;
        }
    }

    togglePlayPause() {
        if (this.isPlaying) {
            this.pauseSpeech();
        } else {
            this.playSpeech();
        }
    }

    playSpeech() {
        if (!this.currentText) {
            this.updateStatus('No document loaded');
            return;
        }

        if (this.isPaused) {
            this.speechSynthesis.resume();
            this.isPaused = false;
        } else {
            this.speakCurrentSentence();
        }
        
        this.isPlaying = true;
        this.updatePlayButton();
        this.updateStatus('Playing...');
    }

    pauseSpeech() {
        this.speechSynthesis.pause();
        this.isPlaying = false;
        this.isPaused = true;
        this.updatePlayButton();
        this.updateStatu
(Content truncated due to size limit. Use line ranges to read in chunks)