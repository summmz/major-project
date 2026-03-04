import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions'
import { getStore } from '@netlify/blobs'

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const { user } = context.clientContext || {}
  if (!user) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }
  }

  try {
    const { name, description } = JSON.parse(event.body || '{}')

    if (!name) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Playlist name is required' }) }
    }

    const store = getStore({ name: 'user-data', consistency: 'strong' })
    const userData = (await store.get(user.sub, { type: 'json' }) as { playlists: any[] } | null) || { playlists: [] }

    const newPlaylist = {
      id: Date.now(),
      name,
      description: description || '',
      songs: [],
      createdAt: new Date().toISOString()
    }

    userData.playlists.push(newPlaylist)
    await store.setJSON(user.sub, userData)

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playlist: newPlaylist })
    }
  } catch (e) {
    console.error('Error saving playlist:', e)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to create playlist' })
    }
  }
}

export { handler }
