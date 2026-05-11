import OpenAI from "openai";
import { OpenAIStream, StreamingTextResponse } from "ai";
import { DataAPIClient } from "@datastax/astra-db-ts";

export const runtime = "nodejs";

type ChatMessage = {
  id?: string;
  role: "system" | "user" | "assistant" | "function" | "tool";
  content: string;
};

const {
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_COLLECTION,
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
  OPENAI_API_KEY,
} = process.env;

function validateEnv() {
  const missing = [];

  if (!ASTRA_DB_NAMESPACE) missing.push("ASTRA_DB_NAMESPACE");
  if (!ASTRA_DB_COLLECTION) missing.push("ASTRA_DB_COLLECTION");
  if (!ASTRA_DB_API_ENDPOINT) missing.push("ASTRA_DB_API_ENDPOINT");
  if (!ASTRA_DB_APPLICATION_TOKEN) missing.push("ASTRA_DB_APPLICATION_TOKEN");
  if (!OPENAI_API_KEY) missing.push("OPENAI_API_KEY");

  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }
}

validateEnv();

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);

const db = client.db(ASTRA_DB_API_ENDPOINT!, {
  namespace: ASTRA_DB_NAMESPACE!,
});

function cleanText(text: string) {
  return text
    .replace(/\s+/g, " ")
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .trim();
}

function buildContext(documents: any[]) {
  if (!documents || documents.length === 0) {
    return "No relevant anime database context was found.";
  }

  return documents
    .map((doc, index) => {
      const text = cleanText(doc.text || "");
      const source = doc.url ? `Source: ${doc.url}` : "Source: anime database";

      return `
[Context ${index + 1}]
${source}
${text}
`;
    })
    .join("\n\n")
    .slice(0, 12000);
}

function buildSystemPrompt(context: string) {
  return `
You are **AnimeGPT**, a friendly, up-to-date anime assistant operating in **May 2026**.

You help users with:
- Anime recommendations
- Character explanations
- Story summaries
- Watch orders
- Anime genres
- Similar anime suggestions
- Episode and filler guidance
- Manga and anime comparisons
- Anime news and trends

Use the anime database context below when it is relevant.

ANIME DATABASE CONTEXT:
${context}

RESPONSE RULES:
- Answer in a helpful, conversational style.
- Use Markdown formatting.
- Use **bold text** for anime titles, character names, and important points.
- Use bullet points when listing recommendations.
- Keep paragraphs short and easy to read.
- Avoid spoilers unless the user clearly asks for spoilers.
- If a question may involve spoilers, warn the user first.
- If you are not sure, say so honestly.
- If the database context does not contain enough information, use general anime knowledge but do not pretend the database confirmed it.
- For recommendations, give 3 to 5 options with short reasons.
- Do not mention embeddings, vectors, Astra DB, RAG, or internal technical details.

2026 Context Awareness
- Treat recommendations and news as up-to-date for **May 2026**
- Prefer currently relevant or modern popular anime when applicable
- You can mention ongoing seasonal anime trends and recent major releases (if relevant to the question)
- Avoid outdated framing like “recent years” — think in current 2026 anime landscape


GOOD RESPONSE STYLE EXAMPLE:

**Here are some anime you might like:**

- **Jujutsu Kaisen** — Great if you enjoy supernatural battles and fast pacing.
- **Demon Slayer** — Beautiful animation with emotional character moments.
- **Chainsaw Man** — Dark, chaotic, stylish, and action-heavy.

My top pick for you would be **Jujutsu Kaisen** because it has the closest mix of action, supernatural powers, and intense fights.
`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const messages: ChatMessage[] = body.messages || [];

    if (!messages.length) {
      return new Response("No messages provided.", {
        status: 400,
      });
    }

    const latestMessage = messages[messages.length - 1]?.content || "";

    if (!latestMessage.trim()) {
      return new Response("Message cannot be empty.", {
        status: 400,
      });
    }

    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: latestMessage,
      encoding_format: "float",
    });

    const vector = embeddingResponse.data[0].embedding;

    const collection = await db.collection(ASTRA_DB_COLLECTION!);

    const cursor = collection.find(
      {},
      {
        sort: {
          $vector: vector,
        },
        limit: 10,
      }
    );

    const documents = await cursor.toArray();

    const context = buildContext(documents);
    const systemPrompt = buildSystemPrompt(context);

    const openaiMessages = [
      {
        role: "system" as const,
        content: systemPrompt,
      },
      ...messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      stream: true,
      temperature: 0.7,
      messages: openaiMessages as any,
    });

    const stream = OpenAIStream(response as any);

    return new StreamingTextResponse(stream);
  } catch (error) {
    console.error("API route error:", error);

    return new Response(
      "Sorry, AnimeGPT had a problem answering that. Please try again.",
      {
        status: 500,
      }
    );
  }
}