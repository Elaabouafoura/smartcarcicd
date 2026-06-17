import axios from 'axios'

const RASA_URL = 'http://localhost:5005/webhooks/rest/webhook'

export const sendToRasa = async (
    message: string,
    sender = 'user1'
) => {
    const response = await axios.post(RASA_URL, {
        sender,
        message,
    })

    return response.data
}