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
    const body = JSON.parse(event.body || '{}')
    const { title, artist, playlistId, duration, audioData, audioType, imageData, imageType } = body

    if (!title || !artist || !playlistId || !audioData) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields (title, artist, playlistId, audioData)' }) }
    }

    const songId = `${user.sub}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

    // Store audio file in Blobs
    const songsStore = getStore('songs')
    const audioBuffer = Buffer.from(audioData, 'base64')
    await songsStore.set(songId, audioBuffer, {
      metadata: { contentType: audioType || 'audio/mpeg' }
    })

    // Store cover image if provided
    let imageUrl = null
    if (imageData) {
      const imagesStore = getStore('images')
      const imageBuffer = Buffer.from(imageData, 'base64')
      await imagesStore.set(songId, imageBuffer, {
        metadata: { contentType: imageType || 'image/jpeg' }
      })
      imageUrl = `/.netlify/functions/get-image-file?id=${songId}`
    }

    // Build song metadata
    const songMeta = {
      id: songId,
      title,
      artist,
      duration: duration || 0,
      isUploaded: true,
      url: `/.netlify/functions/get-song-file?id=${songId}`,
      image: imageUrl
    }

    // Update user data with the new song in the specified playlist
    const userDataStore = getStore({ name: 'user-data', consistency: 'strong' })
    const userData = (await userDataStore.get(user.sub, { type: 'json' }) as { playlists: any[] } | null) || { playlists: [] }

    const playlist = userData.playlists.find((p: any) => String(p.id) === String(playlistId))
    if (!playlist) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Playlist not found' }) }
    }

    playlist.songs.push(songMeta)
    await userDataStore.setJSON(user.sub, userData)

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ song: songMeta })
    }
  } catch (e) {
    console.error('Error uploading song:', e)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to upload song' })
    }
  }
}

export { handler }
