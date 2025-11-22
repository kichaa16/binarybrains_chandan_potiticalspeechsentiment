import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.14.0';

// Skip local model checks since we are running in browser
env.allowLocalModels = false;
env.useBrowserCache = true;

let classifier = null;
let transcriber = null;

// Singleton to load the sentiment model
async function getClassifier() {
    if (!classifier) {
        console.log('Loading sentiment model...');
        classifier = await pipeline('sentiment-analysis', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english');
        console.log('Sentiment model loaded.');
    }
    return classifier;
}

// Singleton to load the transcription model
async function getTranscriber() {
    if (!transcriber) {
        console.log('Loading transcription model...');
        transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en');
        console.log('Transcription model loaded.');
    }
    return transcriber;
}

self.addEventListener('message', async (event) => {
    const { type, data, id } = event.data;

    try {
        if (type === 'analyze') {
            const text = data;
            const pipe = await getClassifier();

            // Split text into sentences (simple regex)
            const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
            const chunks = sentences.slice(0, 100); // Cap at 100 sentences for speed

            const results = await pipe(chunks);

            // Calculate aggregate score
            let totalScore = 0;
            let positiveCount = 0;
            let negativeCount = 0;

            const detailedResults = results.map((res, index) => {
                const isPositive = res.label === 'POSITIVE';
                const score = isPositive ? res.score : -res.score;

                if (isPositive) positiveCount++;
                else negativeCount++;

                totalScore += score;

                return {
                    sentence: chunks[index],
                    score: score,
                    label: res.label
                };
            });

            const averageScore = totalScore / chunks.length;

            self.postMessage({
                status: 'complete',
                type: 'analyze',
                id: id,
                result: {
                    averageScore: averageScore,
                    positiveCount,
                    negativeCount,
                    detailedResults
                }
            });

        } else if (type === 'transcribe') {
            const audio = data;
            const pipe = await getTranscriber();

            const result = await pipe(audio);

            self.postMessage({
                status: 'complete',
                type: 'transcribe',
                id: id,
                result: result.text
            });
        }

    } catch (error) {
        self.postMessage({
            status: 'error',
            type: type,
            id: id,
            error: error.message
        });
    }
});
