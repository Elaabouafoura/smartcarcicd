import useChatSend from '../hooks/useChatSend'
import {
    PiLightbulbDuotone,
    PiBookOpenTextDuotone,
    PiCompassDuotone,
    PiCodeDuotone,
} from 'react-icons/pi'
import type { ReactNode } from 'react'

type PromptType = 'idea' | 'guide' | 'writing' | 'coding'

const suggestionIcon: Record<PromptType, ReactNode> = {
    idea: <PiLightbulbDuotone className="text-blue-500" />,
    guide: <PiCompassDuotone className="text-emerald-500" />,
    writing: <PiBookOpenTextDuotone className="text-amber-500" />,
    coding: <PiCodeDuotone className="text-indigo-500" />,
}

const promptSuggestion: {
    title: string
    prompt: string
    type: PromptType
}[] = [
    {
        title: 'My car won\'t start',
        prompt: 'My car won\'t start',
        type: 'guide',
    },
    {
        title: 'The engine is overheating',
        prompt: 'The engine is overheating',
        type: 'idea',
    },
    {
        title: 'The brakes are squealing',
        prompt: 'The brakes are squealing',
        type: 'writing',
    },
    {
        title: 'What does P0300 mean?',
        prompt: 'What does P0300 mean?',
        type: 'coding',
    },
]

const ChatLandingView = () => {
    const { handleSend } = useChatSend()

    return (
        <div className="max-w-[900px] w-full mx-auto mt-20">
            <div>
                <div className="heading-text text-4xl leading-snug">
                    <span className="font-semibold bg-linear-to-r from-indigo-500 to-red-400 bg-clip-text text-transparent text-5xl">
                        Hello 👋
                    </span>
                    <br />
                    <span>Your smart mechanic</span>
                </div>

                <div className="mt-8 grid grid-cols-2 xl:grid-cols-4 gap-4">
                    {promptSuggestion.map((suggestion) => (
                        <div
                            key={suggestion.title}
                            className="flex flex-col gap-4 justify-between rounded-xl bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 p-5 min-h-40 cursor-pointer"
                            role="button"
                            onClick={() => handleSend(suggestion.prompt)}
                        >
                            <h6 className="font-normal">
                                {suggestion.title}
                            </h6>

                            <div className="bg-white dark:bg-gray-800 rounded-full p-2 inline-flex w-fit">
                                <span className="text-2xl">
                                    {suggestionIcon[suggestion.type]}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default ChatLandingView