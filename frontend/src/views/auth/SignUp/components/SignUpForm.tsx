import { useState } from 'react'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import { FormItem, Form } from '@/components/ui/Form'
import { useAuth } from '@/auth'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { CommonProps } from '@/@types/common'
import AxiosBase from '@/services/axios/AxiosBase'

interface SignUpFormProps extends CommonProps {
    disableSubmit?: boolean
    setMessage?: (message: string) => void
}

type SignUpFormSchema = {
    name: string
    email: string
    password: string
    confirmPassword: string
    role: 'user' | 'mechanic'
}

const validationSchema = z
    .object({
        name: z.string().min(1, { message: 'Please enter your name' }),
        email: z.email({ message: 'Please enter a valid email' }),
        password: z.string().min(8, { message: 'Password must be at least 8 characters' }),
        confirmPassword: z.string().min(1, { message: 'Confirm Password Required' }),
        role: z.enum(['user', 'mechanic']),
    })
    .refine((data) => data.password === data.confirmPassword, {
        message: 'Passwords do not match',
        path: ['confirmPassword'],
    })

const SignUpForm = (props: SignUpFormProps) => {
    const { disableSubmit = false, className, setMessage } = props
    const [isSubmitting, setSubmitting] = useState(false)

    const { signUp } = useAuth()

    const {
        handleSubmit,
        formState: { errors },
        control,
        watch,
    } = useForm<SignUpFormSchema>({
        resolver: zodResolver(validationSchema),
        defaultValues: { role: 'user' },
    })

    const selectedRole = watch('role')

    const onSignUp = async (values: SignUpFormSchema) => {
        if (disableSubmit) return
        setSubmitting(true)

        try {
            if (values.role === 'mechanic') {
                // ── Signup mécanicien ──
                await AxiosBase.post('/mechanics/signup', {
                    name:     values.name,
                    email:    values.email,
                    password: values.password,
                })
                window.location.href = '/sign-in'
            } else {
                // ── Signup user normal ──
                const result = await signUp({
                    name:     values.name,
                    email:    values.email,
                    password: values.password,
                })
                if (result?.status === 'failed') {
                    setMessage?.(result.message)
                }
            }
        } catch (err: any) {
            setMessage?.(err.response?.data?.message ?? 'Signup failed')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className={className}>
            <Form onSubmit={handleSubmit(onSignUp)}>

                {/* ── Choix du rôle ── */}
                <FormItem label="I am a...">
                    <Controller
                        name="role"
                        control={control}
                        render={({ field }) => (
                            <div className="flex rounded-lg overflow-hidden border border-gray-200">
                                <button
                                    type="button"
                                    className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                                        field.value === 'user'
                                            ? 'bg-primary text-white'
                                            : 'bg-white text-gray-500 hover:bg-gray-50'
                                    }`}
                                    onClick={() => field.onChange('user')}
                                >
                                    User
                                </button>
                                <button
                                    type="button"
                                    className={`flex-1 py-2 text-sm font-semibold transition-colors ${
                                        field.value === 'mechanic'
                                            ? 'bg-primary text-white'
                                            : 'bg-white text-gray-500 hover:bg-gray-50'
                                    }`}
                                    onClick={() => field.onChange('mechanic')}
                                >
                                    Mechanic
                                </button>
                            </div>
                        )}
                    />
                </FormItem>

                {/* ── Champs communs ── */}
                <FormItem
                    label="Full Name"
                    invalid={Boolean(errors.name)}
                    errorMessage={errors.name?.message}
                >
                    <Controller
                        name="name"
                        control={control}
                        render={({ field }) => (
                            <Input
                                type="text"
                                placeholder="Full Name"
                                autoComplete="off"
                                {...field}
                            />
                        )}
                    />
                </FormItem>

                <FormItem
                    label="Email"
                    invalid={Boolean(errors.email)}
                    errorMessage={errors.email?.message}
                >
                    <Controller
                        name="email"
                        control={control}
                        render={({ field }) => (
                            <Input
                                type="email"
                                placeholder="Email"
                                autoComplete="off"
                                {...field}
                            />
                        )}
                    />
                </FormItem>

                <FormItem
                    label="Password"
                    invalid={Boolean(errors.password)}
                    errorMessage={errors.password?.message}
                >
                    <Controller
                        name="password"
                        control={control}
                        render={({ field }) => (
                            <Input
                                type="password"
                                placeholder="Password"
                                autoComplete="off"
                                {...field}
                            />
                        )}
                    />
                </FormItem>

                <FormItem
                    label="Confirm Password"
                    invalid={Boolean(errors.confirmPassword)}
                    errorMessage={errors.confirmPassword?.message}
                >
                    <Controller
                        name="confirmPassword"
                        control={control}
                        render={({ field }) => (
                            <Input
                                type="password"
                                placeholder="Confirm Password"
                                autoComplete="off"
                                {...field}
                            />
                        )}
                    />
                </FormItem>

                <Button
                    block
                    loading={isSubmitting}
                    variant="solid"
                    type="submit"
                >
                    {isSubmitting
                        ? 'Creating Account...'
                        : selectedRole === 'mechanic'
                            ? 'Sign Up as Mechanic'
                            : 'Sign Up'}
                </Button>

            </Form>
        </div>
    )
}

export default SignUpForm