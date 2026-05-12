import OpenAI from 'openai';

const openai = new OpenAI();

export async function GET() {
  const today = new Date().toLocaleDateString('en-US', { 
    month: 'long', year: 'numeric' 
  });
  
  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    max_tokens: 300,
    messages: [
      {
        role: 'system',
        content: `You are an anime expert assistant. Today is ${today}.
Generate exactly 4 suggestion buttons for an anime chatbot.
Be aware of currently airing anime in 2026, recent releases, and trending topics.
Return ONLY a valid JSON array, no markdown, no explanation:
[
  { "title": "short 3-4 word label", "prompt": "full question to ask the chatbot" },
  ...
]
Rules:
- titles must be max 4 words, catchy, specific
- prompts must be natural questions an anime fan would ask
- mix topics: one seasonal/current, one recommendation, one lore/character, one beginner-friendly
- reference real 2026 airing anime when possible`
      },
      { role: 'user', content: 'Generate 4 anime suggestion buttons for today.' }
    ]
  });

  try {
    const text = completion.choices[0].message.content?.trim() || '[]';
    const suggestions = JSON.parse(text);
    return Response.json({ suggestions, generatedAt: Date.now() });
  } catch {
    return Response.json({ 
      suggestions: [
        { title: 'Best anime of 2025', prompt: 'What are the best anime released in 2025?' },
        { title: 'Hidden gems', prompt: 'Recommend underrated anime most people have not seen.' },
        { title: 'Anime for beginners', prompt: 'What are the best starter anime for a complete beginner?' },
        { title: 'Top airing now', prompt: 'What anime are currently airing in 2026 that I should watch?' }
      ],
      generatedAt: Date.now()
    });
  }
}
