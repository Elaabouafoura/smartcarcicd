import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { FailureNotification } from './entities/failure-notification.entity'
import { UsersService } from 'src/users/users.service'
import { Vehicle } from 'src/vehicle/entities/vehicle.entity'
import * as nodemailer from 'nodemailer'

@Injectable()
export class FailureNotificationService {
    constructor(
        @InjectRepository(FailureNotification)
        private readonly repo: Repository<FailureNotification>,
        @InjectRepository(Vehicle)
        private readonly vehicleRepo: Repository<Vehicle>,
        private readonly usersService: UsersService,
    ) {}

    private async sendHighRiskEmail(
        toEmail: string,
        userName: string,
        vehicle: { make: string; model: string; plateNumber?: string },
        component: string,
        riskScore: number,
        riskLevel: string,
    ): Promise<void> {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS,
            },
        })

        const vehicleLabel = `${vehicle.make} ${vehicle.model}${vehicle.plateNumber ? ` — ${vehicle.plateNumber}` : ''}`

        await transporter.sendMail({
            from: `"Fleet Monitor" <${process.env.EMAIL_USER}>`,
            to: toEmail,
            subject: `⚠️ High Risk Alert — ${component} (${vehicleLabel})`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #d97706;">⚠️ High Risk Detected</h2>
                    <p>Hello <strong>${userName}</strong>,</p>
                    <p>A high risk has been detected on one of your vehicles:</p>
                    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                        <tr style="background: #fef3c7;">
                            <td style="padding: 8px 12px; font-weight: bold;">Make</td>
                            <td style="padding: 8px 12px;">${vehicle.make}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 12px; font-weight: bold;">Model</td>
                            <td style="padding: 8px 12px;">${vehicle.model}</td>
                        </tr>
                        ${vehicle.plateNumber ? `
                        <tr style="background: #fef3c7;">
                            <td style="padding: 8px 12px; font-weight: bold;">Plate Number</td>
                            <td style="padding: 8px 12px;">${vehicle.plateNumber}</td>
                        </tr>` : ''}
                        <tr style="background: #fef3c7;">
                            <td style="padding: 8px 12px; font-weight: bold;">Component</td>
                            <td style="padding: 8px 12px;">${component}</td>
                        </tr>
                        <tr>
                            <td style="padding: 8px 12px; font-weight: bold;">Risk Level</td>
                            <td style="padding: 8px 12px;">${riskLevel.replace('_', ' ')}</td>
                        </tr>
                        <tr style="background: #fef3c7;">
                            <td style="padding: 8px 12px; font-weight: bold;">Probability</td>
                            <td style="padding: 8px 12px;">${(riskScore * 100).toFixed(1)}%</td>
                        </tr>
                    </table>
                    <p>Please check your vehicle as soon as possible to avoid further damage.</p>
                    <a href="${process.env.FRONTEND_URL}"
                       style="display: inline-block; padding: 10px 20px; background: #d97706; color: white; text-decoration: none; border-radius: 6px;">
                        View Dashboard
                    </a>
                    <p style="margin-top: 24px; color: #6b7280; font-size: 12px;">
                        This is an automated alert from Fleet Monitor.
                    </p>
                </div>
            `,
        })
    }

    async createMany(
        items: {
            vehicleId: string
            vehicleLabel?: string
            component: string
            riskScore: number
            riskLevel: string
            userId?: string
        }[],
    ): Promise<FailureNotification[]> {
        const results: FailureNotification[] = []

        for (const item of items) {
            const recent = await this.repo
                .createQueryBuilder('n')
                .where('n.vehicle_id = :vehicleId', { vehicleId: item.vehicleId })
                .andWhere('n.component = :component', { component: item.component })
                .andWhere(`n.created_at >= NOW() - INTERVAL '24 hours'`)
                .getOne()

            if (recent) {
                if (!recent.emailSent && item.userId) {
                    try {
                        const [user, vehicle] = await Promise.all([
                            this.usersService.findById(item.userId),
                            this.vehicleRepo.findOne({ where: { id: item.vehicleId } }),
                        ])
                        if (user?.email && vehicle) {
                            await this.sendHighRiskEmail(
                                user.email,
                                user.name,
                                { make: vehicle.make, model: vehicle.model, plateNumber: vehicle.plateNumber },
                                item.component,
                                item.riskScore,
                                item.riskLevel,
                            )
                            recent.emailSent = true
                            await this.repo.save(recent)
                        }
                    } catch (err) {
                        console.error('email error:', err)
                    }
                }
                continue
            }

            const notif = this.repo.create({
                vehicleId: item.vehicleId,
                vehicleLabel: item.vehicleLabel,
                component: item.component,
                riskScore: item.riskScore,
                riskLevel: item.riskLevel,
                readed: false,
                emailSent: false,
            })

            const saved = await this.repo.save(notif)
            results.push(saved)

            if (item.userId) {
                try {
                    const [user, vehicle] = await Promise.all([
                        this.usersService.findById(item.userId),
                        this.vehicleRepo.findOne({ where: { id: item.vehicleId } }),
                    ])
                    if (user?.email && vehicle) {
                        await this.sendHighRiskEmail(
                            user.email,
                            user.name,
                            { make: vehicle.make, model: vehicle.model, plateNumber: vehicle.plateNumber },
                            item.component,
                            item.riskScore,
                            item.riskLevel,
                        )
                        saved.emailSent = true
                        await this.repo.save(saved)
                    }
                } catch (err) {
                    console.error('email error:', err)
                }
            }
        }

        return results
    }

    async findByUser(userId: string): Promise<FailureNotification[]> {
        return this.repo
            .createQueryBuilder('notif')
            .innerJoin('notif.vehicle', 'vehicle')
            .where('vehicle.userId = :userId', { userId })
            .orderBy('notif.createdAt', 'DESC')
            .take(50)
            .getMany()
    }

    async markOneRead(id: string, userId: string): Promise<void> {
        const notif = await this.repo
            .createQueryBuilder('notif')
            .innerJoin('notif.vehicle', 'vehicle')
            .where('notif.id = :id', { id })
            .andWhere('vehicle.userId = :userId', { userId })
            .getOne()

        if (!notif) return

        notif.readed = true
        await this.repo.save(notif)
    }

    async markAllRead(userId: string): Promise<void> {
        const notifs = await this.repo
            .createQueryBuilder('notif')
            .innerJoin('notif.vehicle', 'vehicle')
            .where('vehicle.userId = :userId', { userId })
            .andWhere('notif.readed = false')
            .getMany()

        if (notifs.length === 0) return

        await this.repo.save(
            notifs.map((n) => ({ ...n, readed: true }))
        )
    }
}