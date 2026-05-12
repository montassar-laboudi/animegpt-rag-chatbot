import OpenAI from 'openai';

export const runtime = 'nodejs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { message } = await req.json();

    if (!message) {
      return Response.json({ title: 'New Chat' });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      max_tokens: 10,
      messages: [
        {
          role: 'system',
          content:
            'Generate a short 3-4 word title for this anime chat. Return ONLY the title, no quotes, no punctuation, no explanation.',
        },
        { role: 'user', content: message },
      ],
    });

    const title = completion.choices[0].message.content?.trim() || 'New Chat';
    return Response.json({ title });
  } catch (error) {
    console.error('Error generating title:', error);
    return Response.json({ title: 'New Chat' });
  }
}
