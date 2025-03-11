import { fetchRedis } from '@/helpers/redis'
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { pusherServer } from '@/lib/pusher'
import { toPusherKey } from '@/lib/utils'
import { Message, messageValidator } from '@/lib/validations/message'
import { nanoid } from 'nanoid'
import { getServerSession } from 'next-auth'

export async function POST(req: Request) {
  try {
    const { text, chatId }: { text: string; chatId: string } = await req.json()

    if (!text || !chatId) {
      return new Response('Invalid request body', { status: 400 })
    }

    const session = await getServerSession(authOptions)
    if (!session) return new Response('Unauthorized', { status: 401 })

    const [userId1, userId2] = chatId.split('--')

    if (session.user.id !== userId1 && session.user.id !== userId2) {
      return new Response('Unauthorized', { status: 401 })
    }

    const friendId = session.user.id === userId1 ? userId2 : userId1

    // ✅ Check friendship
    const friendList = (await fetchRedis(
      'smembers',
      `user:${session.user.id}:friends`
    )) as string[]
    if (!friendList.includes(friendId)) {
      return new Response('Unauthorized', { status: 401 })
    }

    // ✅ Get sender info
    const rawSender = (await fetchRedis(
      'get',
      `user:${session.user.id}`
    )) as string
    if (!rawSender) return new Response('Sender not found', { status: 404 })

    const sender = JSON.parse(rawSender) as User

    const timestamp = Date.now()

    const messageData: Message = {
      id: nanoid(),
      senderId: session.user.id,
      text,
      timestamp,
    }

    const message = messageValidator.parse(messageData)

    // ✅ Notify connected clients
    try {
      await pusherServer.trigger(toPusherKey(`chat:${chatId}`), 'incoming-message', message)
      await pusherServer.trigger(toPusherKey(`user:${friendId}:chats`), 'new_message', {
        ...message,
        senderImg: sender.image,
        senderName: sender.name,
      })
    } catch (pusherError) {
      console.error('Pusher error:', pusherError)
      return new Response('Failed to send message', { status: 500 })
    }

    // ✅ Store message in Redis
    await db.zadd(`chat:${chatId}:messages`, {
      score: timestamp,
      member: JSON.stringify(message),
    })

    return new Response('OK')
  } catch (error) {
    console.error('Error in message sending:', error)

    if (error instanceof Error) {
      return new Response(error.message, { status: 500 })
    }

    return new Response('Internal Server Error', { status: 500 })
  }
}

