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
        
        // IMPORTANT: Set workerSrc for pdf.js when deploying to a web server/CDN
        if (typeof pdfjsLib !== 'undefined') {
            pdfjsLib.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        }

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
        this.uploadArea.addEventListener('click', () => this.fileInput.click()); // Enable click to open file dialog
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
        // Ensure voices are loaded when they are ready
        if ('onvoiceschanged' in this.speechSynthesis) {
            this.speechSynthesis.addEventListener('voiceschanged', () => this.loadVoices());
        } else {
            // Fallback for browsers that don't fire voiceschanged immediately
            setTimeout(() => this.loadVoices(), 1000); 
        }
        
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
        this.playSpeech();
    }

    clearTextInput() {
        this.textInput.value = '';
        this.updateTextStats();
        this.updateStatus('Text input cleared');
        this.stopSpeech(); // Stop any ongoing speech
        this.contentSection.style.display = 'none'; // Hide content display
        this.playerSection.style.display = 'none'; // Hide player
        this.fileList.innerHTML = ''; // Clear file list
        this.updateStatus('Ready to load documents');
    }

    loadTextContent(text, title = 'Text Content') {
        this.stopSpeech(); // Stop any currently playing speech
        this.currentText = text;
        this.sentences = this.splitIntoSentences(text);
        this.currentSentenceIndex = 0;
        
        // Update UI
        this.documentTitle.textContent = title;
        this.contentDisplay.innerHTML = this.highlightText(text, -1); // No highlight initially
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
        // Clear the file input value so that selecting the same file again triggers change event
        event.target.value = ''; 
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
        
        // Clear previous files from display if new files are being uploaded
        if (files.length > 0) {
            this.fileList.innerHTML = '';
        }
        
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
                    // Mobi parsing is very complex client-side.
                    // This is a placeholder and might not work for all mobi files.
                    // Consider server-side parsing for robust mobi support.
                    text = await this.parseMobiFile(file); 
                    break;
                default:
                    throw new Error(`Unsupported file format: ${fileExtension}`);
            }
            
            // Store the parsed text with the file item using a data attribute
            // This is crucial for the 'Read' button to access the content
            fileItem.dataset.fullText = text; // Changed to fullText to avoid conflict with `dataset.text` if any
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
            this.updateStatus(`Error processing ${file.name}: ${error.message}`, 'error');
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
                <button class="action-btn primary read-file-btn">
                    <i class="fas fa-play"></i> Read
                </button>
                <button class="action-btn remove-file-btn">
                    <i class="fas fa-trash"></i> Remove
                </button>
            </div>
        `;
        // Add event listeners directly to the buttons after creation
        fileItem.querySelector('.read-file-btn').addEventListener('click', () => {
            const fullText = fileItem.dataset.fullText;
            const filename = fileItem.dataset.filename;
            if (fullText) {
                this.loadTextContent(fullText, filename);
                this.playSpeech();
            } else {
                this.updateStatus('File content not available. Try re-uploading.', 'error');
            }
        });
        fileItem.querySelector('.remove-file-btn').addEventListener('click', () => this.removeFile(fileItem));
        
        return fileItem;
    }

    removeFile(fileItemElement) {
        fileItemElement.remove();
        this.updateStatus('File removed.');
        // Optionally clear current playback if the removed file was being read
        if (this.documentTitle.textContent === fileItemElement.dataset.filename) {
            this.clearTextInput(); // This also resets the player and content display
        }
        if (!this.fileList.hasChildNodes() && !this.textInput.value.trim()) {
            this.updateStatus('Ready to load documents');
        }
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
        // Corrected and completed parsePdfFile function
        return new Promise(async (resolve, reject) => {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
                let fullText = '';
                
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    fullText += pageText + '\n\n'; // Add spacing between pages
                }
                resolve(fullText);
            } catch (error) {
                reject(new Error('Failed to parse PDF file: ' + error.message));
            }
        });
    }

    async parseDocxFile(file) {
        if (typeof mammoth === 'undefined') {
            throw new Error("Mammoth.js library not loaded for DOCX parsing.");
        }
        return new Promise(async (resolve, reject) => {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                resolve(result.value); // The raw text content
            } catch (error) {
                reject(new Error('Failed to parse DOCX file: ' + error.message));
            }
        });
    }

    async parseEpubFile(file) {
        if (typeof JSZip === 'undefined') {
            throw new Error("JSZip library not loaded for EPUB parsing.");
        }
        return new Promise(async (resolve, reject) => {
            try {
                const zip = await JSZip.loadAsync(file);
                let fullText = '';
                // Common paths for content in EPUBs
                const contentFiles = zip.file(/.+\.(xhtml|html|ncx)$/i); 
                
                for (const fileEntry of contentFiles) {
                    const content = await fileEntry.async('string');
                    // Basic HTML stripping for EPUB content
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = content;
                    fullText += tempDiv.textContent || tempDiv.innerText || '';
                    fullText += '\n\n'; // Add some separation between parts
                }
                if (!fullText.trim()) {
                    // Fallback to text files if no xhtml/html content (e.g., plain text epub)
                    const txtFiles = zip.file(/.+\.txt$/i);
                    for (const fileEntry of txtFiles) {
                        fullText += await fileEntry.async('string');
                        fullText += '\n\n';
                    }
                }
                if (!fullText.trim()) {
                    reject(new Error('Could not extract readable text from EPUB.'));
                } else {
                    resolve(fullText);
                }
            } catch (error) {
                reject(new Error('Failed to parse EPUB file: ' + error.message));
            }
        });
    }

    async parseMobiFile(file) {
        // NOTE: Mobi parsing client-side is very complex and typically not supported well by JS libraries.
        // This is a rudimentary attempt and might not work for many MOBI files.
        // For robust MOBI support, consider a backend service or a more specialized library.
        this.updateStatus('MOBI parsing is experimental and may not work for all files.', 'warning');
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const buffer = e.target.result;
                try {
                    // This is a very simplistic approach, trying to extract readable strings.
                    // A proper MOBI parser would need to understand its internal structure.
                    const textDecoder = new TextDecoder('utf-8');
                    const text = textDecoder.decode(buffer);
                    // Attempt to clean up common binary/metadata artifacts
                    const cleanedText = text.replace(/[\x00-\x1F\x7F-\x9F]/g, '') // Remove control characters
                                            .replace(/[\uFFFD\u200B]/g, '') // Remove replacement characters and zero-width spaces
                                            .replace(/\s+/g, ' ') // Collapse multiple spaces
                                            .trim();
                    if (cleanedText.length < 50) { // If very little text, it probably failed
                         reject(new Error('MOBI parsing yielded very little content. File might be encrypted or unsupported.'));
                    } else {
                        resolve(cleanedText);
                    }
                } catch (error) {
                    reject(new Error('Failed to parse MOBI file (decode error): ' + error.message));
                }
            };
            reader.onerror = (e) => reject(new Error('Failed to read MOBI file'));
            reader.readAsArrayBuffer(file);
        });
    }

    // Speech synthesis methods
    loadVoices() {
        this.voices = this.speechSynthesis.getVoices();
        this.voiceSelect.innerHTML = ''; // Clear previous options
        
        // Add a default "Select Voice" option
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select Voice';
        this.voiceSelect.appendChild(defaultOption);

        this.voices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.name;
            option.textContent = `${voice.name} (${voice.lang})`;
            if (voice.default) {
                option.textContent += ' - Default';
                this.selectedVoice = voice; // Set default voice
            }
            this.voiceSelect.appendChild(option);
        });

        // Try to pre-select a default or common voice
        if (this.selectedVoice) {
            this.voiceSelect.value = this.selectedVoice.name;
        } else if (this.voices.length > 0) {
            // If no default, pick the first English voice, or just the first available
            const enVoice = this.voices.find(v => v.lang.startsWith('en'));
            this.selectedVoice = enVoice || this.voices[0];
            this.voiceSelect.value = this.selectedVoice.name;
        }
        this.updateStatus(`Voices loaded: ${this.voices.length}`);
    }

    changeVoice() {
        const voiceName = this.voiceSelect.value;
        this.selectedVoice = this.voices.find(voice => voice.name === voiceName);
        if (this.isPlaying) {
            this.resumeOrRestartSpeech(); // Apply new voice if playing
        }
    }

    changeSpeed() {
        this.speed = parseFloat(this.speedRange.value);
        this.speedValue.textContent = `${this.speed.toFixed(1)}x`;
        if (this.isPlaying) {
            this.resumeOrRestartSpeech(); // Apply new speed if playing
        }
    }

    changeVolume() {
        this.volume = parseFloat(this.volumeRange.value);
        // If an utterance is currently speaking, update its volume
        if (this.currentUtterance) {
            this.currentUtterance.volume = this.volume;
            // A new utterance might be needed for the change to take full effect depending on browser
            if (this.isPlaying && this.speechSynthesis.speaking) {
                 // No need to stop and restart, volume usually applies dynamically
            }
        }
    }

    playSpeech() {
        if (!this.currentText) {
            this.updateStatus('No text loaded to play.', 'warning');
            return;
        }

        this.isPlaying = true;
        this.isPaused = false;
        this.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
        this.updateStatus('Playing...');
        this.speakCurrentSentence();
    }

    pauseSpeech() {
        if (this.speechSynthesis.speaking && !this.isPaused) {
            this.speechSynthesis.pause();
            this.isPlaying = false;
            this.isPaused = true;
            this.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
            this.updateStatus('Paused.');
        }
    }

    resumeSpeech() {
        if (this.speechSynthesis.paused) {
            this.speechSynthesis.resume();
            this.isPlaying = true;
            this.isPaused = false;
            this.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
            this.updateStatus('Resuming...');
        } else if (this.isPlaying) {
            // Already playing
            return;
        } else {
            // Not playing or paused, start from current index
            this.playSpeech();
        }
    }

    togglePlayPause() {
        if (this.speechSynthesis.speaking && !this.isPaused) {
            this.pauseSpeech();
        } else {
            this.resumeSpeech();
        }
    }

    stopSpeech() {
        if (this.speechSynthesis.speaking || this.speechSynthesis.paused) {
            this.speechSynthesis.cancel();
        }
        this.isPlaying = false;
        this.isPaused = false;
        this.currentSentenceIndex = 0;
        this.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        this.updateTimeDisplay();
        this.updateProgressBar(0);
        this.updateStatus('Stopped.');
        this.contentDisplay.innerHTML = this.highlightText(this.currentText, -1); // Remove highlight
    }

    resumeOrRestartSpeech() {
        this.stopSpeech(); // Stop current utterance
        // Give a tiny delay to ensure cancel finishes
        setTimeout(() => {
            this.playSpeech(); // Start playing from the current index (which was reset to 0 by stopSpeech)
                               // If you want to continue from where it was, you'd need to save and restore currentSentenceIndex
                               // For now, new voice/speed applies from the start of the current text.
        }, 100); 
    }

    speakCurrentSentence() {
        if (this.currentSentenceIndex >= this.sentences.length) {
            this.stopSpeech();
            this.updateStatus('Finished reading.');
            return;
        }

        const sentence = this.sentences[this.currentSentenceIndex];
        this.currentUtterance = new SpeechSynthesisUtterance(sentence);
        
        if (this.selectedVoice) {
            this.currentUtterance.voice = this.selectedVoice;
        }
        this.currentUtterance.rate = this.speed;
        this.currentUtterance.volume = this.volume;

        this.currentUtterance.onend = () => {
            this.currentSentenceIndex++;
            this.updateTimeDisplay(); // Update time immediately after sentence ends
            this.updateProgressBar(this.currentSentenceIndex / this.sentences.length * 100);
            this.contentDisplay.innerHTML = this.highlightText(this.currentText, this.currentSentenceIndex);
            
            if (this.isPlaying) { // Only speak next if still in playing state
                this.speakCurrentSentence();
            }
        };

        this.currentUtterance.onerror = (event) => {
            console.error('SpeechSynthesisUtterance.onerror', event);
            this.updateStatus(`Speech error: ${event.error}`, 'error');
            this.isPlaying = false;
            this.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        };

        this.currentUtterance.onboundary = (event) => {
            // Update progress bar and highlight as words are spoken
            if (event.name === 'word') {
                const progress = ((this.currentSentenceIndex + (event.charIndex / sentence.length)) / this.sentences.length) * 100;
                this.updateProgressBar(progress);
            }
        };

        this.speechSynthesis.speak(this.currentUtterance);
        
        // Update highlight for the new sentence immediately when it starts speaking
        this.contentDisplay.innerHTML = this.highlightText(this.currentText, this.currentSentenceIndex);
    }

    previousSentence() {
        if (this.currentSentenceIndex > 0) {
            this.currentSentenceIndex--;
            this.stopSpeech(); // Stop current speech
            setTimeout(() => this.playSpeech(), 50); // Small delay before playing
            this.updateStatus('Playing previous sentence.');
        } else {
            this.updateStatus('Already at the beginning.', 'warning');
        }
    }

    nextSentence() {
        if (this.currentSentenceIndex < this.sentences.length - 1) {
            this.currentSentenceIndex++;
            this.stopSpeech(); // Stop current speech
            setTimeout(() => this.playSpeech(), 50); // Small delay before playing
            this.updateStatus('Playing next sentence.');
        } else {
            this.updateStatus('Already at the end.', 'warning');
            this.stopSpeech();
        }
    }

    // Progress bar and time
    updateProgressBar(percentage) {
        this.progressFill.style.width = `${percentage}%`;
    }

    updateTimeDisplay() {
        const totalDurationEstimate = this.sentences.length * 2; // Rough estimate: 2 seconds per sentence
        let elapsedSeconds = 0;
        for (let i = 0; i < this.currentSentenceIndex; i++) {
            // This is a very rough estimate. For accurate time, you'd need the actual duration of each utterance.
            // Modern browsers don't give this easily via SpeechSynthesisUtterance.
            elapsedSeconds += (this.sentences[i].length / 15) / this.speed; // Rough words per second / speed
        }
        
        const formatTime = (seconds) => {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = Math.floor(seconds % 60);
            return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
        };

        this.currentTime.textContent = formatTime(elapsedSeconds);
        this.totalTime.textContent = formatTime(totalDurationEstimate);
    }

    seekToPosition(event) {
        const progressBarWidth = this.progressBar.offsetWidth;
        const clickX = event.offsetX;
        const percentage = (clickX / progressBarWidth);
        const newSentenceIndex = Math.floor(percentage * this.sentences.length);
        
        if (newSentenceIndex < this.sentences.length) {
            this.currentSentenceIndex = newSentenceIndex;
            this.stopSpeech();
            setTimeout(() => this.playSpeech(), 50);
            this.updateStatus(`Seeking to ${formatTime(percentage * this.totalTime.textContent.split(':').reduce((acc, time) => (60 * acc) + +time, 0))}`); // This time calculation is tricky
        }
    }

    // Utility methods
    splitIntoSentences(text) {
        // A more robust sentence splitting regex
        // This regex handles common punctuation (.?!) and ensures we don't split on abbreviations.
        // It's still not perfect but better than a simple split.
        return text.match(/[^.!?]+[.!?]*|[^.!?]+$/g)
                   .map(s => s.trim())
                   .filter(s => s.length > 0);
    }

    highlightText(fullText, highlightIndex) {
        if (!fullText) return '';
        
        let resultHtml = '';
        let currentIndex = 0;
        
        this.sentences.forEach((sentence, index) => {
            const startIndex = fullText.indexOf(sentence, currentIndex);
            if (startIndex !== -1) {
                // Add unhighlighted part before current sentence (if any)
                resultHtml += fullText.substring(currentIndex, startIndex);

                // Add highlighted sentence
                if (index === highlightIndex) {
                    resultHtml += `<span class="current-sentence">${sentence}</span>`;
                } else {
                    resultHtml += sentence;
                }
                currentIndex = startIndex + sentence.length;
            } else {
                // Fallback: if sentence not found at expected index, just append
                resultHtml += sentence;
            }
        });
        
        // Add any remaining text after the last sentence
        resultHtml += fullText.substring(currentIndex);

        return resultHtml;
    }

    toggleContentDisplay() {
        const isHidden = this.contentDisplay.style.display === 'none' || this.contentDisplay.style.display === '';
        if (isHidden) {
            this.contentDisplay.style.display = 'block';
            this.toggleContentBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Hide Content';
            this.contentSection.classList.add('fade-in'); // Apply animation
        } else {
            this.contentDisplay.style.display = 'none';
            this.toggleContentBtn.innerHTML = '<i class="fas fa-eye"></i> Show Content';
            this.contentSection.classList.remove('fade-in');
        }
    }

    showLoading(show) {
        this.loadingOverlay.style.display = show ? 'flex' : 'none';
    }

    updateStatus(message, type = 'info') {
        const statusSpan = this.statusDisplay.querySelector('span');
        const statusIcon = this.statusDisplay.querySelector('i');
        
        statusSpan.textContent = message;
        
        // Reset colors
        statusSpan.style.color = '';
        statusIcon.style.color = '';

        // Apply specific styles based on type
        switch (type) {
            case 'info':
                statusIcon.className = 'fas fa-info-circle';
                statusIcon.style.color = 'var(--primary-green)';
                break;
            case 'warning':
                statusIcon.className = 'fas fa-exclamation-triangle';
                statusIcon.style.color = 'var(--warning-color)';
                break;
            case 'error':
                statusIcon.className = 'fas fa-times-circle';
                statusIcon.style.color = 'var(--error-color)';
                break;
            case 'success':
                statusIcon.className = 'fas fa-check-circle';
                statusIcon.style.color = 'var(--success-color)';
                break;
        }
    }
}

// Initialize the reader when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    window.reader = new TextToSpeechReader();
});
