const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io/v1';

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

export async function elevenlabsTTS({
  text,
  voiceId,
  modelId,
  outputFormat,
}) {
  const apiKey = requiredEnv('ELEVENLABS_API_KEY');
  if (!text || typeof text !== 'string') throw new Error('text is required');

  const resolvedVoiceId = voiceId || process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM'; // Rachel
  const resolvedModelId = modelId || process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
  const resolvedOutputFormat = outputFormat || process.env.ELEVENLABS_OUTPUT_FORMAT || 'mp3_44100_128';

  const res = await fetch(
    `${ELEVENLABS_API_BASE}/text-to-speech/${encodeURIComponent(resolvedVoiceId)}?output_format=${encodeURIComponent(resolvedOutputFormat)}`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'content-type': 'application/json',
        accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: resolvedModelId,
      }),
    },
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`ElevenLabs TTS failed (${res.status}): ${errText || res.statusText}`);
  }

  const audioBuffer = Buffer.from(await res.arrayBuffer());
  return {
    audioBuffer,
    mimeType: 'audio/mpeg',
    voiceId: resolvedVoiceId,
    modelId: resolvedModelId,
    outputFormat: resolvedOutputFormat,
  };
}

