import { auth } from '@/auth';
import { get } from '@vercel/blob';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.email) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  if (!url) return new Response('Missing url', { status: 400 });

  const result = await get(url, { access: 'private' });
  if (!result || result.statusCode !== 200 || !result.stream) {
    return new Response('Not found', { status: 404 });
  }

  return new Response(result.stream, {
    headers: {
      'Content-Type': result.blob.contentType,
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
