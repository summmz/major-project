import { getStore } from '@netlify/blobs'

export default async (req: Request) => {
  const url = new URL(req.url)
  const imageId = url.searchParams.get('id')

  if (!imageId) {
    return new Response('Missing image id', { status: 400 })
  }

  try {
    const store = getStore('images')
    const result = await store.getWithMetadata(imageId, { type: 'arrayBuffer' })

    if (!result) {
      return new Response('Image not found', { status: 404 })
    }

    return new Response(result.data, {
      headers: {
        'Content-Type': result.metadata?.contentType || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable'
      }
    })
  } catch (e) {
    console.error('Error serving image:', e)
    return new Response('Error loading image', { status: 500 })
  }
}
