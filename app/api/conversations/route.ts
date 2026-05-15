import { auth } from '@/auth';
import { DataAPIClient } from '@datastax/astra-db-ts';
import { del } from '@vercel/blob';

export const runtime = 'nodejs';

interface ConvDoc {
  _id: string;
  userId: string;
  title: string;
  messages: unknown[];
  createdAt: number;
  updatedAt: number;
}

const client = new DataAPIClient(process.env.ASTRA_DB_APPLICATION_TOKEN!);
const db = client.db(process.env.ASTRA_DB_API_ENDPOINT!, {
  namespace: process.env.ASTRA_DB_NAMESPACE!,
});

async function getCollection() {
  try {
    return await db.createCollection<ConvDoc>('animegpt_conversations');
  } catch {
    return db.collection<ConvDoc>('animegpt_conversations');
  }
}

// GET — load all conversations for the signed-in user
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const col = await getCollection();
  const docs = await col
    .find({ userId: session.user.email })
    .sort({ updatedAt: -1 })
    .toArray();

  return Response.json({ conversations: docs });
}

// POST — create a new conversation
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({})) as {
    title?: string;
    messages?: unknown[];
  };

  const conversation: ConvDoc = {
    _id: crypto.randomUUID(),
    userId: session.user.email,
    title: body.title ?? 'New Chat',
    messages: body.messages ?? [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const col = await getCollection();
  await col.insertOne(conversation);

  return Response.json({ conversation });
}

// DELETE — clear all conversations and their Blob images for the signed-in user
export async function DELETE() {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const col = await getCollection();

  const docs = await col.find({ userId: session.user.email }).toArray();
  const imageUrls = docs
    .flatMap(doc => doc.messages as Array<{ imageUrl?: string }>)
    .map(m => m.imageUrl)
    .filter((url): url is string => typeof url === 'string');

  if (imageUrls.length > 0) {
    try {
      await del(imageUrls);
    } catch (err) {
      console.error('Blob deletion failed:', err);
    }
  }

  await col.deleteMany({ userId: session.user.email });
  return Response.json({ success: true });
}
