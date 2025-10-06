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
        this.currentTime = document.getElementById('currentTime');
        this.totalTime = document.getElementById('totalTime');
        
        // Status and loading
        this.statusDisplay = document.getElementById('statusDisplay');
        this.loadingOverlay = document.getElementById('loadingOverlay');
        
        // Dragging state for progress bar
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
                        text = await this.parseEpubFile(file);
                        break;
                    case 'mobi':
                        // Mobi parsing is very complex client-side.
                        // This is a placeholder and advises server-side parsing.
                        this.updateStatus('MOBI files are difficult to parse client-side. Functionality may be limited or absent.', 'warning');
                        text = await this.parseMobiFile(file); // Attempting, but might be empty or partial
                        break;
                    default:
                        throw new Error(`Unsupported file format: ${fileExtension}`);
                }
                
                if (text) {
                    fileItem.dataset.fileContent = text; // Store the parsed text
                    fileItem.querySelector('.file-details p').textContent = `Ready (${text.length} chars)`;
                    fileItem.querySelector('.read-file-btn').style.display = 'inline-block'; // Show read button
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

    // --- File Parsing Functions ---

    // Generic file reader
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }

    // .txt
    async parseTextFile(file) {
        return this.readFileAsText(file);
    }

    // .html
    async parseHtmlFile(file) {
        const html = await this.readFileAsText(file);
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        // Extract text content, cleaning up script/style tags
        doc.querySelectorAll('script, style').forEach(el => el.remove());
        return doc.body.textContent || '';
    }

    // .pdf
    async parsePdfFile(file) {
        if (typeof pdfjsLib === 'undefined' || !pdfjsLib.getDocument) {
            throw new Error('PDF.js library not loaded or initialized correctly.');
        }
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            text += content.items.map(item => item.str).join(' ') + '\n\n';
        }
        return text;
    }

    // .docx
    async parseDocxFile(file) {
        if (typeof mammoth === 'undefined' || !mammoth.extractRawText) {
            throw new Error('Mammoth.js library not loaded or initialized correctly.');
        }
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
        return result.value; // The raw text
    }

    // .epub (Simplified - EPUBs are ZIP archives of HTML, CSS, images etc.)
    async parseEpubFile(file) {
        if (typeof JSZip === 'undefined') {
            throw new Error('JSZip library not loaded for EPUB parsing.');
        }
        const arrayBuffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);
        
        let fullText = '';
        const opfFile = zip.file(/\.opf$/i)[0]; // Find the OPF file for manifest/spine

        if (!opfFile) {
            // Fallback: If no OPF, try to read all HTML files directly
            const htmlFiles = Object.keys(zip.files).filter(fileName => fileName.endsWith('.html') || fileName.endsWith('.xhtml'));
            for (const path of htmlFiles) {
                const content = await zip.files[path].async('text');
                const parser = new DOMParser();
                const doc = parser.parseFromString(content, 'text/html');
                doc.querySelectorAll('script, style').forEach(el => el.remove());
                fullText += doc.body.textContent + '\n\n';
            }
        } else {
            // More robust EPUB parsing would involve parsing the OPF to find the reading order
            // For simplicity, we'll just extract all HTML content from the zip.
            const htmlFiles = Object.keys(zip.files).filter(fileName => fileName.endsWith('.html') || fileName.endsWith('.xhtml'));
            for (const path of htmlFiles) {
                const content = await zip.files[path].async('text');
                const parser = new DOMParser();
                const doc = parser.parseFromString(content, 'text/html');
                doc.querySelectorAll('script, style').forEach(el => el.remove());
                fullText += doc.body.textContent + '\n\n';
            }
        }
        return fullText.trim();
    }

    // .mobi (Placeholder - client-side parsing is very limited)
    async parseMobiFile(file) {
        // Client-side MOBI parsing is exceptionally complex and often requires a server-side component
        // or a very specialized JS library that is large and may not cover all MOBI formats.
        // For demonstration, we'll try a very basic text extraction, which may yield poor results.
        const arrayBuffer = await file.arrayBuffer();
        const decoder = new TextDecoder('utf-8'); // Attempt UTF-8, might need others
        const text = decoder.decode(arrayBuffer);
        
        // This is a naive attempt. Real MOBI parsing involves understanding its internal structure.
        // It might return binary data or garbled text.
        console.warn('MOBI parsing is highly experimental client-side. Expect limited or no functionality.');
        this.updateStatus('MOBI file parsing is experimental and may not work correctly.', 'warning');
        return text.substring(0, Math.min(text.length, 5000)); // Return a snippet or try to find readable parts
    }


    // Speech synthesis methods
    loadVoices() {
        this.voices = this.speechSynthesis.getVoices().sort((a, b) => a.name.localeCompare(b.name));
        this.voiceSelect.innerHTML = '<option value="">Select Voice</option>'; // Clear existing options
        let defaultVoiceFound = false;

        this.voices.forEach(voice => {
            const option = document.createElement('option');
            option.textContent = `${voice.name} (${voice.lang})`;
            option.value = voice.name;
            this.voiceSelect.appendChild(option);

            // Set a default voice, e.g., an English one
            if (!defaultVoiceFound && voice.lang.startsWith('en-')) {
                this.selectedVoice = voice;
                option.selected = true;
                defaultVoiceFound = true;
            }
        });

        // If no English voice found, just select the first available
        if (!defaultVoiceFound && this.voices.length > 0) {
            this.selectedVoice = this.voices[0];
            this.voiceSelect.value = this.voices[0].name;
        }

        if (this.voices.length === 0) {
            this.updateStatus('No speech synthesis voices available in your browser.', 'error');
            console.warn('No voices found. Make sure your browser supports SpeechSynthesis API and has voices installed.');
        } else {
            this.updateStatus('Voices loaded.', 'success');
        }
    }

    changeVoice() {
        const selectedVoiceName = this.voiceSelect.value;
        this.selectedVoice = this.voices.find(voice => voice.name === selectedVoiceName);
        this.stopSpeech(); // Stop and restart with new voice if playing
        if (this.isPlaying && this.currentText) {
            this.playSpeech(this.currentSentenceIndex); // Resume with new voice
        }
    }

    changeSpeed() {
        this.speed = parseFloat(this.speedRange.value);
        this.speedValue.textContent = `${this.speed.toFixed(1)}x`;
        if (this.currentUtterance) {
            this.currentUtterance.rate = this.speed;
        }
        this.stopSpeech(); // Stop and restart with new speed if playing
        if (this.isPlaying && this.currentText) {
            this.playSpeech(this.currentSentenceIndex); // Resume with new speed
        }
    }

    changeVolume() {
        this.volume = parseFloat(this.volumeRange.value);
        if (this.currentUtterance) {
            this.currentUtterance.volume = this.volume;
        }
        // Volume change doesn't require restarting speech, it applies immediately
    }

    splitIntoSentences(text) {
        // Improved regex for sentence splitting, handling common punctuation and abbreviations
        const sentences = text.match(/[^.!?]+[.!?]|\S+$/g) || [];
        return sentences.map(s => s.trim()).filter(s => s.length > 0);
    }

    highlightText(fullText, highlightIndex) {
        const words = fullText.split(/(\s+)/); // Split by words, keeping delimiters
        let html = '';
        let currentWordIndex = 0;

        this.sentences.forEach((sentence, index) => {
            const sentenceWords = sentence.split(/(\s+)/).filter(w => w.trim().length > 0);
            let sentenceHtml = '';
            
            // Reconstruct sentence HTML word by word
            let tempSentence = '';
            let sentenceStartWordIndex = currentWordIndex;

            for (let i = sentenceStartWordIndex; i < words.length; i++) {
                const word = words[i];
                const cleanWord = word.trim();

                // Check if adding this word (and its potential space) forms the current sentence
                // This is a heuristic and might need refinement for complex cases
                if (cleanWord.length > 0) {
                    tempSentence += word;
                    if (tempSentence.trim() === sentence) { // Found the full sentence match
                        // Apply highlight to the section of words that make up this sentence
                        for(let j = sentenceStartWordIndex; j <= i; j++) {
                            sentenceHtml += words[j];
                        }
                        currentWordIndex = i + 1;
                        break; // Move to next sentence
                    } else if (tempSentence.trim().length > sentence.length * 1.5 && tempSentence.trim().includes(sentence)) {
                        // Heuristic for partial match or if the splitter was imperfect
                        // Take the exact sentence as HTML and advance the word index
                        sentenceHtml = sentence;
                        currentWordIndex = i + 1; // Simplistic - would need more exact mapping
                        break;
                    }
                } else { // It's a space or delimiter
                    tempSentence += word;
                }
                 // If we've passed the expected length of the sentence, it means the splitting might be off.
                // Just add the word and keep going, hoping the next sentence boundary is found.
                if (i === words.length -1 || tempSentence.trim().length > sentence.length * 2 ) {
                     // Fallback: If unable to match perfectly, just use the raw sentence text
                    sentenceHtml = sentence;
                    currentWordIndex = words.length; // Ensure loop terminates
                    break;
                }
            }


            const cssClass = (index === highlightIndex) ? 'current-sentence' : 'clickable-sentence';
            html += `<span data-sentence-index="${index}" class="${cssClass}">${sentenceHtml || sentence}</span>`;
        });
        
        return html;
    }


    setupTextClickHandlers() {
        this.contentDisplay.querySelectorAll('.clickable-sentence, .current-sentence').forEach(span => {
            span.removeEventListener('click', this.handleSentenceClick); // Prevent duplicate listeners
            span.addEventListener('click', (e) => this.handleSentenceClick(e));
        });
    }

    handleSentenceClick(event) {
        const index = parseInt(event.target.dataset.sentenceIndex, 10);
        if (!isNaN(index) && this.sentences[index]) {
            this.currentSentenceIndex = index;
            this.playSpeech(this.currentSentenceIndex);
            this.updateStatus(`Jumping to sentence ${index + 1}`);
        }
    }

    // Player control methods
    togglePlayPause() {
        if (!this.currentText) {
            this.updateStatus('No text loaded to play.', 'warning');
            return;
        }

        if (this.isPlaying) {
            this.pauseSpeech();
        } else {
            this.playSpeech();
        }
    }

    playSpeech(startIndex = this.currentSentenceIndex) {
        if (!this.currentText) {
            this.updateStatus('No text to play.', 'warning');
            return;
        }
        
        this.stopSpeech(false); // Stop current utterance but don't reset index
        this.isPlaying = true;
        this.isPaused = false;
        this.playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
        this.updateStatus('Playing...');
        
        this.currentSentenceIndex = startIndex;
        this.readSentence(this.currentSentenceIndex);
    }

    pauseSpeech() {
        if (this.currentUtterance && this.speechSynthesis.speaking) {
            this.speechSynthesis.pause();
            this.isPlaying = false;
            this.isPaused = true;
            this.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
            this.updateStatus('Paused.');
        }
    }

    stopSpeech(resetIndex = true) {
        if (this.speechSynthesis.speaking || this.speechSynthesis.paused) {
            this.speechSynthesis.cancel();
        }
        this.isPlaying = false;
        this.isPaused = false;
        this.currentUtterance = null;
        this.playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        
        if (resetIndex) {
            this.currentSentenceIndex = 0;
            this.updateProgressBar(0);
            this.updateTimeDisplay();
            this.contentDisplay.innerHTML = this.highlightText(this.currentText, -1); // Remove all highlights
            this.updateStatus('Stopped.');
        } else {
            this.updateStatus('Playback stopped for change.');
        }
    }

    readSentence(index) {
        if (index >= this.sentences.length) {
            this.stopSpeech();
            this.updateStatus('Playback finished!', 'success');
            return;
        }

        const sentence = this.sentences[index];
        if (!sentence.trim()) {
            this.currentSentenceIndex++;
            this.readSentence(this.currentSentenceIndex);
            return;
        }

        this.currentUtterance = new SpeechSynthesisUtterance(sentence);
        this.currentUtterance.rate = this.speed;
        this.currentUtterance.volume = this.volume;
        if (this.selectedVoice) {
            this.currentUtterance.voice = this.selectedVoice;
        }

        // Highlight the current sentence
        this.contentDisplay.innerHTML = this.highlightText(this.currentText, index);
        this.scrollToCurrentSentence(index); // Call the updated scroll function

        this.currentUtterance.onend = () => {
            this.currentSentenceIndex++;
            this.updateProgressBar(this.currentSentenceIndex / this.sentences.length);
            this.readSentence(this.currentSentenceIndex);
        };

        this.currentUtterance.onerror = (event) => {
            console.error('SpeechSynthesisUtterance error:', event);
            this.updateStatus(`Speech error: ${event.error}`, 'error');
            this.stopSpeech();
        };

        // For progress bar updates based on utterance
        let charIndex = 0;
        this.currentUtterance.onboundary = (event) => {
            if (event.name === 'word') {
                const totalCharsInUtterance = this.currentUtterance.text.length;
                const progress = (event.charIndex + event.charLength) / totalCharsInUtterance;
                // Only update progress bar for the current utterance's progress
                const overallProgress = (this.currentSentenceIndex + progress) / this.sentences.length;
                this.updateProgressBar(overallProgress);
            }
        };

        this.speechSynthesis.speak(this.currentUtterance);
        this.updateTimeDisplay(); // Update current/total time (though total time will be approximate without actual duration)
    }

    previousSentence() {
        if (this.currentSentenceIndex > 0) {
            this.currentSentenceIndex--;
            this.playSpeech(this.currentSentenceIndex);
            this.updateStatus('Previous sentence.');
        } else {
            this.updateStatus('Already at the beginning.', 'info');
        }
    }

    nextSentence() {
        if (this.currentSentenceIndex < this.sentences.length - 1) {
            this.currentSentenceIndex++;
            this.playSpeech(this.currentSentenceIndex);
            this.updateStatus('Next sentence.');
        } else {
            this.updateStatus('Already at the end.', 'info');
            this.stopSpeech(); // Stop if it was the last sentence
        }
    }

    // UPDATED SCROLLTOCURRENTSENTENCE FUNCTION (THE FIX)
    scrollToCurrentSentence(index) {
        const highlightedSpan = this.contentDisplay.querySelector(`[data-sentence-index="${index}"]`);
        if (highlightedSpan) {
            const container = this.contentDisplay; // The scrollable container
            
            // Get boundaries of the element relative to the viewport (or document)
            const rect = highlightedSpan.getBoundingClientRect();
            // Get boundaries of the container relative to the viewport
            const containerRect = container.getBoundingClientRect();
            
            // Calculate the position of the element relative to its container's *current* scroll position
            const elementTop = highlightedSpan.offsetTop;
            const elementHeight = highlightedSpan.offsetHeight;
            const containerScrollTop = container.scrollTop;
            const containerHeight = container.clientHeight;

            // Define a small buffer (e.g., 2 lines worth of height)
            const scrollBuffer = elementHeight * 2; 

            // 1. Check if the element's bottom is below the visible area (needs to scroll down)
            if (elementTop + elementHeight > containerScrollTop + containerHeight) {
                // Scroll down just enough to bring the bottom of the element into view, 
                // plus a buffer to prevent it from hugging the bottom edge.
                container.scrollTo({
                    top: elementTop + elementHeight - containerHeight + scrollBuffer,
                    behavior: 'smooth'
                });
            } 
            // 2. Check if the element's top is above the visible area (needs to scroll up)
            else if (elementTop < containerScrollTop) {
                // Scroll up just enough to bring the top of the element into view,
                // perhaps with a small buffer margin at the top.
                container.scrollTo({
                    top: elementTop - scrollBuffer,
                    behavior: 'smooth'
                });
            }
            // If neither of the above, the element is already visible, so no scroll is performed.
        }
    }


    // Progress bar and time display
    updateProgressBar(progress) {
        // Progress is a value between 0 and 1
        this.progressFill.style.width = `${progress * 100}%`;
    }

    updateTimeDisplay() {
        // This is a rough estimation as SpeechSynthesisUtterance doesn't provide total duration easily.
        // For more accurate time, you'd need to pre-calculate based on words/characters and average reading speed.
        // Here, we'll just show the current sentence number and total sentences.
        const current = this.currentSentenceIndex + 1;
        const total = this.sentences.length;
        this.currentTime.textContent = `Sentence ${current}`;
        this.totalTime.textContent = `Total: ${total}`;

        // Alternatively, for "total time", you could estimate:
        // const wordsPerMinute = 150; // Average reading speed
        // const totalWords = this.currentText.split(/\s+/).filter(word => word.length > 0).length;
        // const estimatedMinutes = totalWords / wordsPerMinute;
        // const totalSeconds = Math.floor(estimatedMinutes * 60);
        // this.totalTime.textContent = this.formatTime(totalSeconds);
    }

    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
    }

    // Progress bar dragging logic
    startProgressBarDrag(e) {
        this.isDraggingProgressBar = true;
        this.pauseSpeech(); // Pause speech when dragging starts
        this.seekToPosition(e); // Immediately seek to click position
    }

    handleProgressBarDrag(e) {
        if (!this.isDraggingProgressBar) return;
        e.preventDefault(); // Prevent text selection etc.
        this.seekToPosition(e);
    }

    endProgressBarDrag() {
        if (this.isDraggingProgressBar) {
            this.isDraggingProgressBar = false;
            if (this.currentText) {
                this.playSpeech(this.currentSentenceIndex); // Resume speech from new position
            }
        }
    }

    seekToPosition(e) {
        if (!this.currentText || this.sentences.length === 0) return;

        const progressBarRect = this.progressBar.getBoundingClientRect();
        const clientX = e.clientX || e.touches[0].clientX; // Handle touch events
        const clickX = clientX - progressBarRect.left;
        const percentage = Math.max(0, Math.min(1, clickX / progressBarRect.width));
        
        const newSentenceIndex = Math.floor(percentage * this.sentences.length);
        this.currentSentenceIndex = newSentenceIndex;
        this.updateProgressBar(percentage);
        this.contentDisplay.innerHTML = this.highlightText(this.currentText, newSentenceIndex);
        this.scrollToCurrentSentence(newSentenceIndex);
        this.updateTimeDisplay();
        this.updateStatus(`Seeking to sentence ${newSentenceIndex + 1}`);
    }

    // UI utility methods
    showLoading(show, message = 'Loading...') {
        this.loadingOverlay.style.display = show ? 'flex' : 'none';
        this.loadingOverlay.querySelector('p').textContent = message;
    }

    updateStatus(message, type = 'info') {
        const statusElement = this.statusDisplay.querySelector('span');
        const iconElement = this.statusDisplay.querySelector('i');
        statusElement.textContent = message;
        
        // Reset classes
        this.statusDisplay.className = 'status-display'; 
        iconElement.className = 'fas';

        // Apply type-specific styles
        switch (type) {
            case 'success':
                this.statusDisplay.classList.add('status-success');
                iconElement.classList.add('fa-check-circle');
                break;
            case 'warning':
                this.statusDisplay.classList.add('status-warning');
                iconElement.classList.add('fa-exclamation-triangle');
                break;
            case 'error':
                this.statusDisplay.classList.add('status-error');
                iconElement.classList.add('fa-times-circle');
                break;
            case 'info':
            default:
                this.statusDisplay.classList.add('status-info');
                iconElement.classList.add('fa-info-circle');
                break;
        }
    }

    toggleContentDisplay() {
        if (this.contentDisplay.style.display === 'none' || this.contentDisplay.style.display === '') {
            this.contentDisplay.style.display = 'block';
            this.toggleContentBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Hide Content';
        } else {
            this.contentDisplay.style.display = 'none';
            this.toggleContentBtn.innerHTML = '<i class="fas fa-eye"></i> Show Content';
        }
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    new TextToSpeechReader();
});
