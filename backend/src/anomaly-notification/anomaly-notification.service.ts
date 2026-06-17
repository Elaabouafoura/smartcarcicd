import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { AnomalyNotification } from './entities/anomaly-notification.entity'

@Injectable()
export class AnomalyNotificationService {
    constructor(
        @InjectRepository(AnomalyNotification)
        private readonly repo: Repository<AnomalyNotification>,
    ) {}

    async createMany(
        items: {
            vehicleId: string
            vehicleLabel?: string
            sensorReadingId: string
            timestamp: string
            score: number
            anomalyProbability: number
        }[],
    ): Promise<AnomalyNotification[]> {
        // Éviter les doublons par sensorReadingId
        const results: AnomalyNotification[] = []

        for (const item of items) {
            const exists = await this.repo.findOne({
                where: { sensorReadingId: item.sensorReadingId },
            })

            if (exists) continue

            const notif = this.repo.create({
                vehicleId: item.vehicleId,
                vehicleLabel: item.vehicleLabel,
                sensorReadingId: item.sensorReadingId,
                timestamp: new Date(item.timestamp),
                score: item.score,
                anomalyProbability: item.anomalyProbability,
                readed: false,
            })

            results.push(await this.repo.save(notif))
        }

        return results
    }

   async findByUser(userId: string): Promise<AnomalyNotification[]> {
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

    async deleteOne(id: string, userId: string): Promise<void> {
        await this.repo
            .createQueryBuilder()
            .delete()
            .from(AnomalyNotification)
            .where('id = :id', { id })
            .andWhere(
                `vehicle_id IN (
                    SELECT id FROM vehicles WHERE user_id = :userId
                )`,
                { userId },
            )
            .execute()
    }
}