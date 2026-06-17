import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository, DataSource } from 'typeorm'
import * as bcrypt from 'bcrypt'

import { Mechanic } from './entities/mechanic.entity'
import { User, UserRole } from '../users/entities/user.entity'
import { CreateMechanicDto } from './dto/create-mechanic.dto'
import { UpdateMechanicDto } from './dto/update-mechanic.dto'
import { MechanicSignupDto } from './dto/mechanic-signup.dto'
import { MaintenanceRecord } from '../maintenance/entities/maintenance.entity'

@Injectable()
export class MechanicService {
  constructor(
    @InjectRepository(Mechanic)
    private mechanicRepo: Repository<Mechanic>,

    @InjectRepository(User)
    private userRepo: Repository<User>,

    @InjectRepository(MaintenanceRecord)
    private maintenanceRepo: Repository<MaintenanceRecord>,

    private dataSource: DataSource,
  ) {}

  // ─── Auth ────────────────────────────────────────────────────────────────────

  /**
   * Inscription publique d'un mécanicien.
   * Crée atomiquement un User (role=MECHANIC) + son profil Mechanic.
   */
  async signup(dto: MechanicSignupDto): Promise<Mechanic> {
    const emailTaken = await this.userRepo.findOneBy({ email: dto.email })
    if (emailTaken) throw new ConflictException('Email déjà utilisé')

    return this.dataSource.transaction(async (manager) => {
      const user = manager.create(User, {
        email:        dto.email,
        passwordHash: await bcrypt.hash(dto.password, 10),
        name:         dto.name,
        role:         UserRole.MECHANIC,
      })
      const savedUser = await manager.save(user)

      const mechanic = manager.create(Mechanic, {
        name:      dto.name,
        specialty: dto.specialty,
        phone:     dto.phone,
        location:  dto.location,
        user:      savedUser,
      })
      return manager.save(mechanic)
    })
  }

  // ─── Profil personnel (mécanicien connecté) ──────────────────────────────────

  /**
   * Retrouve le profil Mechanic à partir de l'id User (extrait du JWT).
   */
  async findByUserId(userId: string): Promise<Mechanic> {
    const mechanic = await this.mechanicRepo.findOne({
      where: { user: { id: userId } },
      relations: ['user'],
    })
    if (!mechanic) throw new NotFoundException('Profil mécanicien introuvable')
    return mechanic
  }

  /**
   * Permet au mécanicien de mettre à jour son propre profil.
   */
  async updateMyProfile(userId: string, dto: UpdateMechanicDto): Promise<Mechanic> {
    const mechanic = await this.findByUserId(userId)
    Object.assign(mechanic, dto)
    return this.mechanicRepo.save(mechanic)
  }

  // ─── Bookings ────────────────────────────────────────────────────────────────

  /**
   * Bookings d'un mécanicien identifié par son mechanicId (usage admin/public).
   */
  async getMechanicBookings(mechanicId: string, date: string) {
    await this.findOne(mechanicId)
    return this._fetchBookings('mechanic.id = :id', { id: mechanicId }, date)
  }

  /**
   * Bookings du mécanicien connecté (identifié par son userId JWT).
   */
  async getMyBookings(userId: string, date: string) {
    await this.findByUserId(userId)
    return this._fetchBookings('mechanic.user_id = :id', { id: userId }, date)
  }

  /** Requête partagée entre les deux variantes de bookings. */
  private async _fetchBookings(
    whereClause: string,
    params: Record<string, string>,
    date: string,
  ) {
    const startOfDay = new Date(`${date}T00:00:00.000Z`)
    const endOfDay   = new Date(`${date}T23:59:59.999Z`)

    const bookings = await this.maintenanceRepo
      .createQueryBuilder('maintenance')
      .leftJoin('maintenance.mechanic', 'mechanic')
      .leftJoin('maintenance.vehicle',  'vehicle')
      .where(whereClause, params)
      .andWhere('maintenance.appointmentStart IS NOT NULL')
      .andWhere('maintenance.appointmentEnd   IS NOT NULL')
      .andWhere('maintenance.appointmentStart BETWEEN :startOfDay AND :endOfDay', {
        startOfDay,
        endOfDay,
      })
      .select([
        'maintenance.id',
        'maintenance.appointmentStart',
        'maintenance.appointmentEnd',
        'maintenance.service_type',
        'vehicle.id',
        'vehicle.make',
        'vehicle.model',
        'vehicle.plateNumber',
      ])
      .getMany()

    return bookings.map((b) => ({
      id:               b.id,
      title:            'Réservé',
      appointmentStart: b.appointmentStart,
      appointmentEnd:   b.appointmentEnd,
      serviceType:      b.service_type,
      vehicle:          b.vehicle,
    }))
  }

  // ─── CRUD Admin ──────────────────────────────────────────────────────────────

  /** Création manuelle par un admin (sans compte auth). */
  async create(dto: CreateMechanicDto): Promise<Mechanic> {
    const mechanic = this.mechanicRepo.create(dto)
    return this.mechanicRepo.save(mechanic)
  }

  async findAll(): Promise<Mechanic[]> {
    return this.mechanicRepo.find({ order: { createdAt: 'DESC' } })
  }

  async findActive(): Promise<Mechanic[]> {
    return this.mechanicRepo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
    })
  }

  async findOne(id: string): Promise<Mechanic> {
    const mechanic = await this.mechanicRepo.findOne({ where: { id } })
    if (!mechanic) throw new NotFoundException('Mécanicien introuvable')
    return mechanic
  }

  async update(id: string, dto: UpdateMechanicDto): Promise<Mechanic> {
    const mechanic = await this.findOne(id)
    Object.assign(mechanic, dto)
    return this.mechanicRepo.save(mechanic)
  }

  /** Soft-delete : désactive le compte sans supprimer les données. */
  async remove(id: string): Promise<Mechanic> {
    const mechanic = await this.findOne(id)
    mechanic.isActive = false
    return this.mechanicRepo.save(mechanic)
  }
}