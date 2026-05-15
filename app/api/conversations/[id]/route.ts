import { auth } from '@/auth';
import { DataAPIClient } from '@datastax/astra-db-ts';

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

// PATCH — update messages or title for one conversation
export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await req.json() as Partial<Pick<ConvDoc, 'title' | 'messages'>>;

  const col = await getCollection();
  // userId filter ensures users can only update their own conversations
  await col.updateOne(
    { _id: id, userId: session.user.email },
    { $set: { ...body, updatedAt: Date.now() } }
  );

  return Response.json({ success: true });
}

// DELETE — remove one conversation
export async function DELETE(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;

  const col = await getCollection();
  // userId filter ensures users can only delete their own conversations
  await col.deleteOne({ _id: id, userId: session.user.email });

  return Response.json({ success: true });
}
