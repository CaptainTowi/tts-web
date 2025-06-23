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
        // This line is correct for CDN usage. The issue is likely elsewhere if PDF parsing fails.
        if (typeof pdfjsLib !== 'undefined') {
            try {
                pdfjsLib.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                console.log('PDF.js workerSrc set:', pdfjsLib.workerSrc);
            } catch (e) {
                console.error('Error setting pdfjsLib.workerSrc:', e);
                this.updateStatus('Error initializing PDF reader. PDF files might not work.', 'error');
            }
        } else {
            console.warn('pdfjsLib is not defined. Ensure pdf.min.js is loaded before script.js.');
            this.updateStatus('PDF.js library not loaded. PDF files cannot be processed.', 'warning');
        }

        this.initializeElements();
        this.setupEventListeners();
        this.loadVoices(); // Initial voice loading
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
        // IMPORTANT: Removed reference to 'progressHandle' as it's a pseudo-element in CSS
        // and doesn't exist as a direct DOM element in the provided HTML.
        this.currentTime = document.getElementById('currentTime');
        this.totalTime = document.getElementById('totalTime');
        
        // Status and loading
        this.statusDisplay = document.getElementById('statusDisplay');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        
        // Dragging state for progress bar (renamed to avoid conflict)
        this.isDraggingProgressBar = false;
    }

    setupEventListeners() {
        // Text input events
        this.textInput.addEventListener('input', () => this.updateTextStats());
        this.readTextBtn.addEventListener('click', () => this.readDirectText());
        this.clearTextBtn.addEventListener('click', () => this.clearTextInput());
        
        // File upload events
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
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
        
        // Progress bar click and drag events
        this.progressBar.addEventListener('click', (e) => this.seekToPosition(e));
        // Using progressBar for mousedown/touchstart as per HTML structure for dragging
        this.progressBar.addEventListener('mousedown', (e) => this.startProgressBarDrag(e));
        this.progressBar.addEventListener('touchstart', (e) => this.startProgressBarDrag(e));
        
        // Global document listeners for dragging to allow dragging outside the bar
        document.addEventListener('mousemove', (e) => this.handleProgressBarDrag(e));
        document.addEventListener('touchmove', (e) => this.handleProgressBarDrag(e));
        document.addEventListener('mouseup', () => this.endProgressBarDrag());
        document.addEventListener('touchend', () => this.endProgressBarDrag());
        
        // Content toggle
        this.toggleContentBtn.addEventListener('click', () => this.toggleContentDisplay());
        
        // Speech synthesis events
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
            this.updateStatus('Please enter some text to read', 'warning');
            return;
        }
        this.loadTextContent(text, 'Direct Text Input');
        this.playSpeech(); // Start playing immediately after loading direct text
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
        
        // Set up click handlers for text navigation after content is rendered
        this.setupTextClickHandlers();
        
        // Update time display (will be 0:00 / 0:00 initially)
        this.updateTimeDisplay();
        this.updateProgressBar(0); // Reset progress bar
        
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
        this.showLoading(true, 'Processing files...');
        this.fileList.innerHTML = ''; // Clear previous files from display if new files are being uploaded
        
        if (files.length === 0) {
            this.showLoading(false);
            this.updateStatus('No files selected or dropped.');
            return;
        }

        const processedFileItems = [];
        for (const file of files) {
            const fileItem = this.createFileItem(file);
            this.fileList.appendChild(fileItem);
            processedFileItems.push({ file, fileItem });
        }

        for (const { file, fileItem } of processedFileItems) {
            try {
                let text = '';
                const fileExtension = file.name.split('.').pop().toLowerCase();
                
                // Show specific processing status
                fileItem.querySelector('.file-details p').textContent = 'Processing...';

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
                        text = await this.parseEpubFile(file); // Call the actual Epub parser
                        break;
                    case 'mobi':
                        text = await this.parseMobiFile(file); // Call the actual Mobi parser
                        break;
                    default:
                        throw new Error(`Unsupported file format: ${fileExtension}`);
                }
                
                if (text) {
                    fileItem.dataset.fileContent = text; // Store the parsed text
                    fileItem.querySelector('.file-details p').textContent = `Ready (${text.length} chars)`;
                    // If you have a 'Read' button in createFileItem that needs to be shown/hidden
                    const readButton = fileItem.querySelector('.read-file-btn');
                    if (readButton) readButton.style.display = 'inline-block'; 
                    this.updateStatus(`Successfully parsed "${file.name}"`);

                    // If it's the first file, load it directly
                    if (this.currentText === '') {
                        this.loadTextContent(text, file.name);
                    }
                } else {
                    fileItem.querySelector('.file-details p').textContent = 'Empty or failed to parse.';
                    this.updateStatus(`Could not extract text from "${file.name}"`, 'error');
                }

            } catch (error) {
                console.error(`Error processing file ${file.name}:`, error);
                fileItem.querySelector('.file-details p').textContent = `Error: ${error.message}`;
                this.updateStatus(`Error processing "${file.name}": ${error.message}`, 'error');
            }
        }
        
        this.showLoading(false);
        if (files.length > 0) {
            this.updateStatus('All selected files processed.', 'success');
        } else {
            this.updateStatus('Ready to load documents');
        }
    }

    createFileItem(file) {
        const fileItem = document.createElement('div');
        fileItem.classList.add('file-item');
        // Ensure read-file-btn exists and has its event listener if it was omitted previously
        fileItem.innerHTML = `
            <div class="file-info">
                <i class="file-icon fas fa-file"></i>
                <div class="file-details">
                    <h4>${file.name}</h4>
                    <p>${(file.size / 1024).toFixed(2)} KB</p>
                </div>
            </div>
            <div class="file-actions">
                <button class="action-btn read-file-btn" style="display:none;"><i class="fas fa-play"></i> Read</button>
                <button class="action-btn remove-file-btn"><i class="fas fa-times"></i> Remove</button>
            </div>
        `;
        
        // Attach event listeners directly to the buttons after creation
        fileItem.querySelector('.read-file-btn').addEventListener('click', () => {
            const textContent = fileItem.dataset.fileContent;
            if (textContent) {
                this.loadTextContent(textContent, file.name);
                this.playSpeech();
            } else {
                this.updateStatus('No content available for this file.', 'warning');
            }
        });

        fileItem.querySelector('.remove-file-btn').addEventListener('click', () => {
            fileItem.remove();
            if (this.fileList.children.length === 0) {
                this.contentSection.style.display = 'none';
                this.playerSection.style.display = 'none';
                this.stopSpeech();
                this.updateStatus('Ready to load documents');
            }
            // Optionally, if the removed file was the one currently being read, stop and clear.
            if (this.documentTitle.textContent === file.name) {
                this.stopSpeech();
                this.contentSection.style.display = 'none';
                this.playerSection.style.display = 'none';
            }
        });
        
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
        // Corrected and completed parsePdfFile function
        return new Promise(async (resolve, reject) => {
            try {
                // Ensure pdfjsLib is defined
                if (typeof pdfjsLib === 'undefined' || !pdfjsLib.getDocument) {
                    throw new Error('PDF.js library not loaded or initialized correctly.');
                }
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
                let fullText = '';
                
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(' ');
                    fullText += pageText + '\n\n'; // Add spacing between pages
                }
                resolve(fullText.trim());
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
        if (!this.currentText || this.sentences.length === 0) {
            this.updateStatus('No text loaded to play or no sentences found.', 'warning');
            return;
        }

        // If at the end, reset to start
        if (this.currentSentenceIndex >= this.sentences.length) {
            this.currentSentenceIndex = 0;
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
        } else if (!this.isPlaying && !this.speechSynthesis.speaking) {
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
        this.updateContentHighlight(); // Remove highlight by setting index to -1
    }

    resumeOrRestartSpeech() {
        this.speechSynthesis.cancel(); // Cancel current utterance if any
        this.isPlaying = false;
        this.isPaused = false;
        // Give a tiny delay to ensure cancel finishes before speaking again
        setTimeout(() => {
            this.playSpeech(); // Start playing from the current index
        }, 50); 
    }

    speakCurrentSentence() {
        if (!this.currentText || this.sentences.length === 0) {
            this.stopSpeech();
            return;
        }

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
            this.updateProgressBar((this.currentSentenceIndex / this.sentences.length) * 100);
            this.updateContentHighlight(); // Update highlight
            
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
            // Update progress bar as words are spoken within a sentence (more granular)
            if (event.name === 'word' && sentence.length > 0) {
                const charProgress = (event.charIndex + event.charLength) / sentence.length;
                const totalProgress = ((this.currentSentenceIndex + charProgress) / this.sentences.length) * 100;
                this.updateProgressBar(totalProgress);
            }
        };

        this.speechSynthesis.speak(this.currentUtterance);
        
        // Update highlight for the new sentence immediately when it starts speaking
        this.updateContentHighlight();
    }

    previousSentence() {
        if (this.currentSentenceIndex > 0) {
            this.currentSentenceIndex--;
            this.resumeOrRestartSpeech(); 
            this.updateStatus('Playing previous sentence.');
        } else {
            this.updateStatus('Already at the beginning.', 'warning');
        }
    }

    nextSentence() {
        if (this.currentSentenceIndex < this.sentences.length - 1) {
            this.currentSentenceIndex++;
            this.resumeOrRestartSpeech();
            this.updateStatus('Playing next sentence.');
        } else {
            this.updateStatus('Already at the end.', 'warning');
            this.stopSpeech();
        }
    }

    // Progress bar and time
    updateProgressBar(percentage) {
        this.progressFill.style.width = `${percentage}%`;
        // Handle pseudo-element positioning is automatic with width of fill.
    }

    updateTimeDisplay() {
        // Calculate rough total duration
        const wordsPerMinute = 150; // Average reading speed
        const totalWords = this.currentText.trim() ? this.currentText.trim().split(/\s+/).length : 0;
        const totalDurationSeconds = (totalWords / wordsPerMinute) * 60 / this.speed;

        let elapsedWords = 0;
        for (let i = 0; i < this.currentSentenceIndex; i++) {
            elapsedWords += this.sentences[i].trim().split(/\s+/).length;
        }
        const elapsedSeconds = (elapsedWords / wordsPerMinute) * 60 / this.speed;
        
        const formatTime = (seconds) => {
            if (isNaN(seconds) || seconds < 0) return '0:00';
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = Math.floor(seconds % 60);
            return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
        };

        this.currentTime.textContent = formatTime(elapsedSeconds);
        this.totalTime.textContent = formatTime(totalDurationSeconds);
    }

    // Progress Bar Interaction (Click and Drag)
    startProgressBarDrag(event) {
        this.isDraggingProgressBar = true;
        this.speechSynthesis.cancel(); // Stop speech immediately on drag start
        this.handleProgressBarDrag(event); // Update position immediately
    }

    handleProgressBarDrag(event) {
        if (!this.isDraggingProgressBar) return;

        event.preventDefault(); // Prevent text selection during drag

        const clientX = event.touches ? event.touches[0].clientX : event.clientX;
        const progressBarRect = this.progressBar.getBoundingClientRect();
        let newX = clientX - progressBarRect.left;
        newX = Math.max(0, Math.min(newX, progressBarRect.width)); // Clamp within bounds

        const percentage = (newX / progressBarRect.width) * 100;
        this.updateProgressBar(percentage);

        // Update current sentence index while dragging, but don't speak yet
        const newSentenceIndex = Math.floor((percentage / 100) * this.sentences.length);
        this.currentSentenceIndex = newSentenceIndex;
        this.updateTimeDisplay();
        this.updateContentHighlight(false); // Do not scroll into view during drag!
    }

    endProgressBarDrag() {
        if (!this.isDraggingProgressBar) return;
        this.isDraggingProgressBar = false;
        
        // After dragging, resume speech from the new position
        this.resumeSpeech(); 
        this.updateContentHighlight(true); // Now, scroll to the new position once drag ends
    }

    seekToPosition(event) {
        // This handles simple clicks on the progress bar, when not dragging
        if (this.isDraggingProgressBar) return; 

        const progressBarRect = this.progressBar.getBoundingClientRect();
        const clickX = event.clientX - progressBarRect.left;
        const percentage = (clickX / progressBarRect.width);
        const newSentenceIndex = Math.floor(percentage * this.sentences.length);
        
        this.jumpToSentence(newSentenceIndex);
    }

    // Utility methods
    splitIntoSentences(text) {
        // A more robust sentence splitting regex that handles common punctuation.
        // It tries to split on ., ?, ! followed by a space or end of string, 
        // but avoids splitting on common abbreviations like "Mr." or "U.S.".
        // This is a complex problem for a simple regex, but this is a good start.
        const sentences = text.match(/[^.!?\s][^.!?]*(?:[.!?](?!['"”)]?\s*(?:[A-Z]|\d|\s*$))|$)|\S+/g);
        return sentences ? sentences.map(s => s.trim()).filter(s => s.length > 0) : [];
    }

    highlightText(fullText, highlightIndex) {
        if (!fullText || this.sentences.length === 0) return fullText; // Return original if no sentences

        let resultHtml = '';
        let currentTextPosition = 0; // Tracks position in the original fullText

        this.sentences.forEach((sentence, index) => {
            const trimmedSentence = sentence.trim();
            if (trimmedSentence.length === 0) return;

            // Find the exact occurrence of the trimmed sentence in the original text
            const startIndex = fullText.indexOf(trimmedSentence, currentTextPosition);
            
            if (startIndex !== -1) {
                // Add the text before this sentence (unhighlighted)
                resultHtml += fullText.substring(currentTextPosition, startIndex);

                // Add the sentence, with or without highlight class
                if (index === highlightIndex) {
                    resultHtml += `<span class="clickable-sentence current-sentence" data-sentence-index="${index}">${trimmedSentence}</span>`;
                } else {
                    resultHtml += `<span class="clickable-sentence" data-sentence-index="${index}">${trimmedSentence}</span>`;
                }
                // Update the current text position past this sentence
                currentTextPosition = startIndex + trimmedSentence.length;
            } else {
                // Fallback: If sentence not found, append it as plain text and advance
                // This might happen with very aggressive trimming or complex text.
                resultHtml += `<span class="clickable-sentence" data-sentence-index="${index}">${trimmedSentence}</span>`;
                currentTextPosition += trimmedSentence.length; // Approximate advance
            }
        });

        // Add any remaining text after the last processed sentence
        resultHtml += fullText.substring(currentTextPosition);
        
        return resultHtml;
    }

    setupTextClickHandlers() {
        // Remove existing handlers to prevent duplicates if content is re-rendered
        this.contentDisplay.querySelectorAll('.clickable-sentence').forEach(el => {
            el.removeEventListener('click', el._boundJumpToSentence); // Use the stored reference
            delete el._boundJumpToSentence; // Clean up
        });

        // Add new click handlers to sentences in the content display
        this.contentDisplay.querySelectorAll('.clickable-sentence').forEach((element) => {
            // Bind `this` context for event listener, store reference to remove later
            const boundHandler = this.jumpToSentence.bind(this, parseInt(element.dataset.sentenceIndex));
            element.addEventListener('click', boundHandler);
            element._boundJumpToSentence = boundHandler; // Store reference
        });
    }

    jumpToSentence(sentenceIndex) {
        if (sentenceIndex < 0 || sentenceIndex >= this.sentences.length) {
            this.updateStatus('Invalid sentence index.', 'error');
            return;
        }
        
        this.speechSynthesis.cancel(); // Stop current speech
        this.currentSentenceIndex = sentenceIndex;
        
        // Play from the new sentence
        this.resumeOrRestartSpeech();
        this.updateStatus(`Jumping to sentence ${sentenceIndex + 1}.`);
    }

    // MODIFIED: Corrected to scroll only the contentDisplay element
    updateContentHighlight(shouldScroll = true) { 
        this.contentDisplay.innerHTML = this.highlightText(this.currentText, this.currentSentenceIndex);
        this.setupTextClickHandlers(); // Re-attach handlers after re-rendering HTML
        
        // Only scroll if explicitly requested (e.g., not during a drag)
        if (shouldScroll) {
            const highlightedElement = this.contentDisplay.querySelector('.current-sentence');
            if (highlightedElement) {
                const container = this.contentDisplay;
                
                const elementTop = highlightedElement.offsetTop;
                const elementHeight = highlightedElement.offsetHeight;
                const containerScrollTop = container.scrollTop;
                const containerHeight = container.clientHeight;

                // Determine if the element is currently visible within the container
                const isVisible = (elementTop >= containerScrollTop) && 
                                  ((elementTop + elementHeight) <= (containerScrollTop + containerHeight));

                // Only scroll if the element is not fully visible within the container
                if (!isVisible) {
                    // Calculate target scroll position to center the element (or near center)
                    container.scrollTo({
                        top: elementTop - (containerHeight / 2) + (elementHeight / 2),
                        behavior: 'smooth'
                    });
                }
            }
        }
    }

    toggleContentDisplay() {
        const isCurrentlyHidden = this.contentDisplay.style.display === 'none' || this.contentDisplay.style.display === '';
        this.contentDisplay.style.display = isCurrentlyHidden ? 'block' : 'none';
        this.toggleContentBtn.innerHTML = isCurrentlyHidden ? 
            '<i class="fas fa-eye-slash"></i> Hide Content' : 
            '<i class="fas fa-eye"></i> Show Content';
    }


    showLoading(show, message = 'Processing document...') {
        this.loadingOverlay.style.display = show ? 'flex' : 'none';
        this.loadingOverlay.querySelector('p').textContent = message;
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
            default:
                statusIcon.className = 'fas fa-info-circle'; // Default to info icon
                statusIcon.style.color = 'var(--primary-green)';
                break;
        }
        // Also update parent class for potential text color changes
        this.statusDisplay.classList.remove('status-info', 'status-warning', 'status-error', 'status-success');
        this.statusDisplay.classList.add(`status-${type}`); // Add new class
    }
}

// Initialize the reader when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    window.reader = new TextToSpeechReader();
});
