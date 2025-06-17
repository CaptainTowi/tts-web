# Text-to-Speech Reader Web App - User Guide

## Overview
The Text-to-Speech Reader is a web application that converts various document formats and direct text input into spoken audio using your browser's built-in text-to-speech capabilities.

## Features
- **Direct Text Input**: Paste or type text directly into the app for immediate reading
- **File Upload Support**: Upload and read documents in multiple formats:
  - TEXT (.txt)
  - HTML (.html)
  - PDF (.pdf)
  - DOCX (.docx)
  - EPUB (.epub) - *Coming soon*
  - MOBI (.mobi) - *Coming soon*
- **Audio Player Controls**: Play, pause, stop, skip forward/backward
- **Voice Selection**: Choose from available system voices
- **Speed Control**: Adjust reading speed from 0.5x to 2.0x
- **Volume Control**: Adjust audio volume
- **Progress Tracking**: Visual progress bar and time display
- **Content Display**: View the text being read with current sentence highlighting
- **Dark & Green Theme**: Modern, eye-friendly interface

## How to Use

### Direct Text Input
1. Type or paste your text into the large text area at the top
2. The character and word count will update automatically
3. Click "Read Text" to start audio playback
4. Use "Clear" to empty the text area

### File Upload
1. Click "Browse Files" or drag and drop files into the upload area
2. Wait for the file to be processed (status will show "Ready" when complete)
3. Click the "Read" button next to the processed file
4. The content will load and audio controls will appear

### Audio Controls
- **Play/Pause**: Start or pause the audio playback
- **Stop**: Stop playback and return to the beginning
- **Previous/Next**: Skip to previous or next sentence
- **Progress Bar**: Click anywhere to jump to that position
- **Voice Selection**: Choose from available system voices
- **Speed Slider**: Adjust playback speed
- **Volume Slider**: Control audio volume

### Content Display
- Click "Show Content" to view the text being read
- The current sentence being spoken will be highlighted in green
- Click "Hide Content" to collapse the text display

## Browser Compatibility
This app works best in modern browsers that support the Web Speech API:
- Chrome (recommended)
- Edge
- Safari
- Firefox (limited voice options)

## Technical Notes
- The app runs entirely in your browser - no data is sent to external servers
- PDF and DOCX parsing is done client-side using JavaScript libraries
- Text-to-speech uses your browser's built-in capabilities
- EPUB and MOBI support will be added in future updates

## Troubleshooting
- If no voices appear in the dropdown, try refreshing the page
- If audio doesn't play, check your browser's audio permissions
- For best results, use Chrome or Edge browsers
- Large files may take a moment to process

## Privacy
- All processing happens locally in your browser
- No text or files are uploaded to external servers
- Your privacy is completely protected

