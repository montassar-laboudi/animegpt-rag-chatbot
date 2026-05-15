import OpenAI from 'openai';

export const runtime = 'nodejs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { message, assistantMessage } = await req.json();

    if (!message) {
      return Response.json({ title: 'New Chat' });
    }

    const context = assistantMessage
      ? `User: ${message}\n\nAssistant: ${assistantMessage}`
      : `User: ${message}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      max_tokens: 15,
      messages: [
        {
          role: 'system',
          content:
            'Generate a 3-5 word title for this anime chat conversation. Be specific to the anime, character, or topic discussed. Sound like a real chat title, not a generic description. Good examples: "Naruto vs Sasuke fight", "Solo Leveling season 2", "Best 2026 isekai picks", "One Piece Elbaf". Bad examples: "Anime question", "Chat about anime", "New Chat". Return ONLY the title, no quotes, no punctuation, no explanation.',
        },
        { role: 'user', content: context },
      ],
    });

    const title = completion.choices[0].message.content?.trim() || 'New Chat';
    return Response.json({ title });
  } catch (error) {
    console.error('Error generating title:', error);
    return Response.json({ title: 'New Chat' });
  }
}
