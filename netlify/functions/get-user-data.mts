import type { Handler, HandlerEvent, HandlerContext } from '@netlify/functions'
import { getStore } from '@netlify/blobs'

const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  const { user } = context.clientContext || {}
  if (!user) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) }
  }

  try {
    const store = getStore({ name: 'user-data', consistency: 'strong' })
    const userData = await store.get(user.sub, { type: 'json' }) as { playlists: any[] } | null

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData || { playlists: [] })
    }
  } catch (e) {
    console.error('Error fetching user data:', e)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to load user data' })
    }
  }
}

export { handler }
