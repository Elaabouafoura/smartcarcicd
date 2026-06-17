const KEY = 'rasa-chat-history'

export const saveChatHistory = (data: any) => {
    try {
        localStorage.setItem(KEY, JSON.stringify(data))
    } catch (err) {
        console.error('Error saving chat history:', err)
    }
}

export const loadChatHistory = () => {
    try {
        const data = localStorage.getItem(KEY)
        return data ? JSON.parse(data) : []
    } catch (err) {
        console.error('Error loading chat history:', err)
        return []
    }
}

export const clearChatHistory = () => {
    localStorage.removeItem(KEY)
}