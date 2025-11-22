// State
let speeches = [];
let chart = null;
const worker = new Worker('worker.js', { type: 'module' });
let mediaRecorder = null;
let audioChunks = [];

// DOM Elements
const titleInput = document.getElementById('speech-title');
const dateInput = document.getElementById('speech-date');
const textInput = document.getElementById('speech-text');
const analyzeBtn = document.getElementById('analyze-btn');
const statusMsg = document.getElementById('status-message');
const speechList = document.getElementById('speech-list');
const ctx = document.getElementById('sentiment-chart').getContext('2d');

// Media Elements
const recordBtn = document.getElementById('record-btn');
const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('file-input');
const recordingStatus = document.getElementById('recording-status');
const recordingTime = document.getElementById('recording-time');
const stopRecordBtn = document.getElementById('stop-record-btn');
const transcriptionStatus = document.getElementById('transcription-status');

// Initialize Chart
function initChart() {
    if (typeof Chart === 'undefined') {
        statusMsg.textContent = 'Error: Chart.js library not loaded.';
        statusMsg.style.color = 'var(--danger)';
        console.error('Chart.js not loaded');
        return;
    }

    try {
        // Create gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

        chart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Sentiment Trend',
                    data: [],
                    borderColor: '#3b82f6',
                    backgroundColor: gradient,
                    borderWidth: 2,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#3b82f6',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'month',
                            tooltipFormat: 'MMM d, yyyy',
                            displayFormats: {
                                month: 'MMM yyyy'
                            }
                        },
                        grid: {
                            color: '#e2e8f0'
                        },
                        ticks: {
                            color: '#64748b'
                        }
                    },
                    y: {
                        min: -1,
                        max: 1,
                        grid: {
                            color: '#e2e8f0'
                        },
                        ticks: {
                            color: '#64748b',
                            callback: function (value) {
                                if (value === 1) return 'Positive';
                                if (value === -1) return 'Negative';
                                if (value === 0) return 'Neutral';
                                return '';
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: '#1e293b',
                        titleColor: '#fff',
                        bodyColor: '#f1f5f9',
                        padding: 10,
                        callbacks: {
                            label: function (context) {
                                const score = context.raw.y.toFixed(2);
                                return `Sentiment: ${score}`;
                            }
                        }
                    }
                }
            }
        });
        console.log('Chart initialized successfully');
    } catch (error) {
        console.error('Chart initialization failed:', error);
        statusMsg.textContent = 'Chart Error: ' + error.message;
        statusMsg.style.color = 'var(--danger)';
    }
}

// Worker Message Handler
worker.onmessage = (e) => {
    const { status, type, result, error } = e.data;

    if (type === 'analyze') {
        setLoading(false);
        if (status === 'complete') {
            addSpeechToState(result);
            statusMsg.textContent = 'Analysis complete!';
            statusMsg.style.color = 'var(--success)';

            // Clear inputs
            titleInput.value = '';
            textInput.value = '';
            dateInput.value = '';
        } else {
            statusMsg.textContent = 'Error: ' + error;
            statusMsg.style.color = 'var(--danger)';
        }
    } else if (type === 'transcribe') {
        transcriptionStatus.classList.add('hidden');
        if (status === 'complete') {
            textInput.value = result;
            statusMsg.textContent = 'Transcription complete! You can now analyze the text.';
            statusMsg.style.color = 'var(--success)';
        } else {
            statusMsg.textContent = 'Transcription Error: ' + error;
            statusMsg.style.color = 'var(--danger)';
        }
    }
};

function setLoading(isLoading) {
    if (isLoading) {
        analyzeBtn.classList.add('loading');
        analyzeBtn.disabled = true;
        statusMsg.textContent = 'Analyzing... (This may take a moment for the first run)';
        statusMsg.style.color = 'var(--text-secondary)';
    } else {
        analyzeBtn.classList.remove('loading');
        analyzeBtn.disabled = false;
    }
}

function addSpeechToState(analysisResult) {
    const title = titleInput.value || 'Untitled Speech';
    const date = dateInput.value || new Date().toISOString().split('T')[0];

    const newSpeech = {
        id: Date.now(),
        title,
        date,
        score: analysisResult.averageScore,
        details: analysisResult
    };

    speeches.push(newSpeech);

    // Sort by date
    speeches.sort((a, b) => new Date(a.date) - new Date(b.date));

    updateUI();
}

function updateUI() {
    // Update List
    speechList.innerHTML = '';
    if (speeches.length === 0) {
        speechList.innerHTML = '<li class="empty-state">No speeches analyzed yet.</li>';
    } else {
        speeches.forEach(speech => {
            const li = document.createElement('li');
            li.className = 'speech-item';

            const scoreClass = speech.score > 0.2 ? 'score-positive' : (speech.score < -0.2 ? 'score-negative' : 'score-neutral');
            const sentimentLabel = speech.score > 0.2 ? 'Positive' : (speech.score < -0.2 ? 'Negative' : 'Neutral');

            li.innerHTML = `
                <div class="speech-header">
                    <span class="speech-title">${speech.title}</span>
                    <span class="speech-date">${new Date(speech.date).toLocaleDateString()}</span>
                </div>
                <div class="speech-sentiment">
                    <span>Score:</span>
                    <span class="sentiment-score ${scoreClass}">${speech.score.toFixed(2)} (${sentimentLabel})</span>
                </div>
            `;
            speechList.appendChild(li);
        });
    }

    // Update Chart
    const chartData = speeches.map(s => ({
        x: s.date,
        y: s.score,
        title: s.title // Custom prop for tooltip? Need to access via context.raw
    }));

    chart.data.datasets[0].data = chartData;
    chart.update();
}

// Media Handling
uploadBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        await processAudio(file);
    }
});

recordBtn.addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = (event) => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
            await processAudio(audioBlob);
        };

        mediaRecorder.start();

        // UI Updates
        recordBtn.classList.add('hidden');
        recordingStatus.classList.remove('hidden');
        startTimer();

    } catch (err) {
        console.error('Error accessing microphone:', err);
        statusMsg.textContent = 'Error accessing microphone. Please allow permissions.';
        statusMsg.style.color = 'var(--danger)';
    }
});

stopRecordBtn.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
        mediaRecorder.stream.getTracks().forEach(track => track.stop());

        // UI Updates
        recordBtn.classList.remove('hidden');
        recordingStatus.classList.add('hidden');
        stopTimer();
    }
});

let timerInterval;
function startTimer() {
    let seconds = 0;
    recordingTime.textContent = '00:00';
    timerInterval = setInterval(() => {
        seconds++;
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        recordingTime.textContent = `${mins}:${secs}`;
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}

async function processAudio(blobOrFile) {
    transcriptionStatus.classList.remove('hidden');
    statusMsg.textContent = 'Processing audio...';
    statusMsg.style.color = 'var(--text-secondary)';

    try {
        const arrayBuffer = await blobOrFile.arrayBuffer();
        const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Get channel data (mono)
        const channelData = audioBuffer.getChannelData(0);

        startTranscription(channelData);
    } catch (error) {
        console.error('Audio processing error:', error);
        statusMsg.textContent = 'Error processing audio: ' + error.message;
        statusMsg.style.color = 'var(--danger)';
        transcriptionStatus.classList.add('hidden');
    }
}

function startTranscription(audioData) {
    statusMsg.textContent = 'Transcribing... (This may take a moment)';

    worker.postMessage({
        type: 'transcribe',
        data: audioData,
        id: Date.now()
    });
}

// Event Listeners
analyzeBtn.addEventListener('click', () => {
    const text = textInput.value.trim();
    if (!text) {
        statusMsg.textContent = 'Please enter some text.';
        statusMsg.style.color = 'var(--danger)';
        return;
    }

    setLoading(true);
    worker.postMessage({
        type: 'analyze',
        data: text,
        id: Date.now()
    });
});

// Initialize
initChart();

// Set default date to today
dateInput.valueAsDate = new Date();

// Demo Data
const loadDemoBtn = document.getElementById('load-demo-btn');
if (loadDemoBtn) {
    loadDemoBtn.addEventListener('click', loadDemoData);
}

function loadDemoData() {
    const demoSpeeches = [
        { title: "Campaign Launch", date: "2023-01-15", score: 0.85, details: {} },
        { title: "Town Hall Meeting", date: "2023-02-10", score: 0.45, details: {} },
        { title: "Press Conference", date: "2023-03-05", score: -0.20, details: {} },
        { title: "Policy Speech", date: "2023-04-20", score: 0.60, details: {} },
        { title: "Crisis Response", date: "2023-05-12", score: -0.55, details: {} },
        { title: "Victory Rally", date: "2023-06-30", score: 0.95, details: {} }
    ];

    speeches = demoSpeeches.map(s => ({
        id: Date.now() + Math.random(),
        ...s
    }));

    // Sort by date
    speeches.sort((a, b) => new Date(a.date) - new Date(b.date));

    updateUI();
    statusMsg.textContent = 'Demo data loaded!';
    statusMsg.style.color = 'var(--success)';
}
