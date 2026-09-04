import textToSpeech from '@google-cloud/text-to-speech';

const client = new textToSpeech.TextToSpeechClient();

export async function synthesizeGoogleLiveTts(text) {
  const clean = text
    .replace(/[*#_`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean) return null;

  // Truncate to reasonable speech segment (up to 600 chars) for low latency
  const spokenText = clean.slice(0, 600);

  const request = {
    input: { text: spokenText },
    // Voice selection: Google Journey/Neural2 voice for warm, companion-like tone
    voice: {
      languageCode: 'en-US',
      name: 'en-US-Journey-F',
      ssmlGender: 'FEMALE',
    },
    audioConfig: {
      audioEncoding: 'MP3',
      speakingRate: 1.05,
      pitch: 0.0,
    },
  };

  try {
    const [response] = await client.synthesizeSpeech(request);
    return response.audioContent.toString('base64');
  } catch (err) {
    console.warn('[googleTts] Primary Journey voice fallback:', err.message);
    try {
      // Fallback to standard Neural2
      request.voice.name = 'en-US-Neural2-F';
      const [fallbackResponse] = await client.synthesizeSpeech(request);
      return fallbackResponse.audioContent.toString('base64');
    } catch (fallbackErr) {
      console.error('[googleTts] TTS failed:', fallbackErr.message);
      return null;
    }
  }
}
