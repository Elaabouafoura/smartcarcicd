// mechanic.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  OneToMany, OneToOne, JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { MaintenanceRecord } from '../../maintenance/entities/maintenance.entity';

@Entity('mechanic')
export class Mechanic {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ length: 100, nullable: true })
  specialty?: string;

  @Column({ length: 20, nullable: true })
  phone?: string;

  @Column({ length: 100, nullable: true })
  location?: string;

  @Column({ default: true })
  isActive!: boolean;

  // ✅ Lien vers le compte User (auth)
  @OneToOne(() => User, (user) => user.mechanicProfile, { eager: true })
  @JoinColumn({ name: 'user_id' })   // FK user_id dans la table mechanic
  user!: User;

  @OneToMany(() => MaintenanceRecord, (maintenance) => maintenance.mechanic)
  maintenanceRecords!: MaintenanceRecord[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}