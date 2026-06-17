// user.entity.ts
import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, OneToOne,
} from 'typeorm';
import { Mechanic } from '../../mechanic/entities/mechanic.entity';

export enum UserRole {
  USER     = 'user',
  ADMIN    = 'admin',
  MECHANIC = 'mechanic', // ✅ nouveau rôle
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 255, unique: true })
  email!: string;

  @Column({ name: 'password_hash', length: 255 })
  passwordHash!: string;

  @Column({ length: 100 })
  name!: string;

  @Column({ name: 'avatar_url', length: 500, nullable: true })
  avatarUrl?: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role!: UserRole;

  @Column({ length: 5, default: 'en' })
  language!: string;

  @Column({ name: 'email_verified', default: false })
  emailVerified!: boolean;

  @Column({ name: 'notification_prefs', type: 'jsonb', default: () => "'{}'" })
  notificationPrefs!: Record<string, any>;

  // ✅ Un User peut être lié à un profil Mechanic
  @OneToOne(() => Mechanic, (mechanic) => mechanic.user, { nullable: true, cascade: true })
  mechanicProfile?: Mechanic;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}