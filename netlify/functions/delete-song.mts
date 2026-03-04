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
    const { songId, playlistId } = JSON.parse(event.body || '{}')

    if (!songId || !playlistId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing songId or playlistId' }) }
    }

    // Remove song from user data
    const userDataStore = getStore({ name: 'user-data', consistency: 'strong' })
    const userData = (await userDataStore.get(user.sub, { type: 'json' }) as { playlists: any[] } | null) || { playlists: [] }

    const playlist = userData.playlists.find((p: any) => String(p.id) === String(playlistId))
    if (!playlist) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Playlist not found' }) }
    }

    playlist.songs = playlist.songs.filter((s: any) => s.id !== songId)
    await userDataStore.setJSON(user.sub, userData)

    // Delete song and image files from Blobs
    const songsStore = getStore('songs')
    await songsStore.delete(songId)

    const imagesStore = getStore('images')
    await imagesStore.delete(songId)

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true })
    }
  } catch (e) {
    console.error('Error deleting song:', e)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to delete song' })
    }
  }
}

export { handler }
