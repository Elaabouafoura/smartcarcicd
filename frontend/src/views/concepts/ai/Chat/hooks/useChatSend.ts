import { usGenerativeChatStore } from '../store/generativeChatStore'
import dayjs from 'dayjs'
import uniqueId from 'lodash/uniqueId'
import { sendToRasa } from '@/services/rasaApi'

const useChatSend = () => {
    const {
        selectedConversation,
        setSelectedConversation,
        pushChatHistory,
        pushConversation,
        setIsTyping,
    } = usGenerativeChatStore()

    const createMyMessage = (id: string, prompt: string) => {
        pushConversation(id, {
            id: uniqueId('user-msg-'),
            sender: {
                id: 'user',
                name: 'User',
            },
            content: prompt,
            timestamp: dayjs().toDate(),
            type: 'regular',
            isMyMessage: true,
        })
    }

    const sendMessage = async (id: string, prompt: string) => {
        const rasaResponse = await sendToRasa(prompt)

        const botText =
            rasaResponse?.length > 0
                ? rasaResponse.map((r: any) => r.text).join('\n')
                : "I didn't understand your problem. Could you please provide more details or rephrase your question?"

        pushConversation(id, {
            id: uniqueId('ai-msg-'),
            sender: {
                id: 'ai',
                name: 'Mechanic AI',
                avatarImageUrl: '/img/logo/ai.png',
            },
            content: botText,
            timestamp: dayjs().toDate(),
            type: 'regular',
            isMyMessage: false,
            fresh: true,
        })

        setIsTyping(false)
    }

    const createConversation = async (id: string, prompt: string) => {
        setSelectedConversation(id)
        await sendMessage(id, prompt)
    }

    const handleSend = async (prompt: string) => {
        setIsTyping(true)

        if (selectedConversation) {
            createMyMessage(selectedConversation, prompt)
            await sendMessage(selectedConversation, prompt)
        } else {
            const newId = uniqueId('rasa-chat-')

            pushChatHistory({
                id: newId,
                title: prompt,
                lastConversation: '',
                createdTime: dayjs().unix(),
                updatedTime: dayjs().unix(),
                enable: false,
            })

            createMyMessage(newId, prompt)
            await createConversation(newId, prompt)
        }
    }

    return {
        handleSend,
    }
}

export default useChatSend