import { getStore } from '@netlify/blobs'

export default async (req: Request) => {
  const url = new URL(req.url)
  const songId = url.searchParams.get('id')

  if (!songId) {
    return new Response('Missing song id', { status: 400 })
  }

  try {
    const store = getStore('songs')
    const result = await store.getWithMetadata(songId, { type: 'arrayBuffer' })

    if (!result) {
      return new Response('Song not found', { status: 404 })
    }

    return new Response(result.data, {
      headers: {
        'Content-Type': result.metadata?.contentType || 'audio/mpeg',
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    })
  } catch (e) {
    console.error('Error serving song:', e)
    return new Response('Error loading song', { status: 500 })
  }
}
