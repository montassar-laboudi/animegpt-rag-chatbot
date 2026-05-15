import { auth } from '@/auth';
import { put } from '@vercel/blob';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await req.formData();
  const image = formData.get('image');
  const conversationId = formData.get('conversationId') as string | null;
  const messageId = formData.get('messageId') as string | null;

  if (!(image instanceof File)) {
    return Response.json({ error: 'No image file' }, { status: 400 });
  }
  if (!conversationId || !messageId) {
    return Response.json({ error: 'Missing conversationId or messageId' }, { status: 400 });
  }
  if (image.size > 5 * 1024 * 1024) {
    return Response.json({ error: 'File too large (max 5MB)' }, { status: 400 });
  }

  const blob = await put(
    `animegpt/${conversationId}/${messageId}.jpg`,
    image,
    { access: 'public' }
  );

  return Response.json({ url: blob.url });
}
