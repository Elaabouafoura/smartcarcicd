import { useEffect } from 'react'
import Dialog from '@/components/ui/Dialog'
import { Form, FormItem } from '@/components/ui/Form'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { usGenerativeChatStore } from '../store/generativeChatStore'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

type FormSchema = {
    title: string
}

const validationSchema = z.object({
    title: z.string().min(1, 'Please do not leave chat title blank!'),
})

const ChatHistoryRenameDialog = () => {
    const {
        selectedConversation,
        chatHistory,
        setChatHistory,
    } = usGenerativeChatStore()

    // 🔥 find current chat safely
    const currentChat = chatHistory.find(
        (c) => c.id === selectedConversation,
    )

    // 🔥 dialog state (tu dois déjà l’avoir dans ton store normalement)
    const renameDialog =
        usGenerativeChatStore((state: any) => state.renameDialog)

    const setRenameDialog =
        usGenerativeChatStore((state: any) => state.setRenameDialog)

    const setChatHistoryName =
        usGenerativeChatStore((state: any) => state.setChatHistoryName)

    const {
        control,
        formState: { errors },
        handleSubmit,
        reset,
    } = useForm<FormSchema>({
        defaultValues: {
            title: currentChat?.title || '',
        },
        resolver: zodResolver(validationSchema),
    })

    useEffect(() => {
        if (renameDialog?.open) {
            reset({
                title: renameDialog.title || currentChat?.title || '',
            })
        }
    }, [renameDialog?.open, renameDialog?.title])

    const handleDialogClose = () => {
        setRenameDialog({
            id: '',
            title: '',
            open: false,
        })
    }

    const onFormSubmit = async ({ title }: FormSchema) => {
        const updated = chatHistory.map((chat) => {
            if (chat.id === renameDialog.id) {
                return {
                    ...chat,
                    title,
                }
            }
            return chat
        })

        setChatHistory(updated)
        setChatHistoryName?.({ id: renameDialog.id, title })
        handleDialogClose()
    }

    return (
        <Dialog
            isOpen={renameDialog?.open}
            onClose={handleDialogClose}
            onRequestClose={handleDialogClose}
        >
            <h5>Rename chat</h5>

            <div className="mt-8">
                <Form onSubmit={handleSubmit(onFormSubmit)}>
                    <FormItem
                        label="Chat title"
                        invalid={Boolean(errors.title)}
                        errorMessage={errors.title?.message}
                    >
                        <Controller
                            name="title"
                            control={control}
                            render={({ field }) => (
                                <Input
                                    placeholder="Rename chat"
                                    type="text"
                                    {...field}
                                />
                            )}
                        />
                    </FormItem>

                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            onClick={handleDialogClose}
                        >
                            Cancel
                        </Button>

                        <Button variant="solid" type="submit">
                            Rename
                        </Button>
                    </div>
                </Form>
            </div>
        </Dialog>
    )
}

export default ChatHistoryRenameDialog