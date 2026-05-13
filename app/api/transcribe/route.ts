import OpenAI, { toFile } from 'openai';
import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const audio = formData.get('audio') as File;

    if (!audio) {
      return Response.json({ error: 'No audio file' }, { status: 400 });
    }

    const openai = new OpenAI();

    const buffer = Buffer.from(await audio.arrayBuffer());
    const file = await toFile(buffer, 'recording.webm', { type: 'audio/webm' });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      response_format: 'verbose_json',
    });

    return Response.json({ text: transcription.text });
  } catch (err) {
    console.error('Transcription error:', err);
    return Response.json(
      { error: 'Transcription failed' },
      { status: 500 }
    );
  }
}
