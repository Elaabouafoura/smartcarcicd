import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Delete,
  UseGuards,
  Query,
  Req,
} from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import type { Request } from 'express'

import { MechanicService } from './mechanic.service'
import { CreateMechanicDto } from './dto/create-mechanic.dto'
import { UpdateMechanicDto } from './dto/update-mechanic.dto'
import { MechanicSignupDto } from './dto/mechanic-signup.dto'
import { RolesGuard } from 'src/auth/guards/roles.guard'
import { Roles } from 'src/auth/decorators/roles.decorator'
import { UserRole } from '../users/entities/user.entity'

/** Extrait l'id user depuis le payload JWT injecté par Passport. */
const userId = (req: Request): string => (req.user as { id: string }).id

@Controller('mechanics')
export class MechanicController {
  constructor(private readonly mechanicService: MechanicService) {}

  // ─── Auth (public) ───────────────────────────────────────────────────────────

  
  @Post('signup')
  signup(@Body() dto: MechanicSignupDto) {
    return this.mechanicService.signup(dto)
  }

  
  @Get('me')
  @Roles(UserRole.MECHANIC)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  getMyProfile(@Req() req: Request) {
    return this.mechanicService.findByUserId(userId(req))
  }

  /** Le mécanicien met à jour son propre profil. */
  @Patch('me')
  @Roles(UserRole.MECHANIC)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  updateMyProfile(@Req() req: Request, @Body() dto: UpdateMechanicDto) {
    return this.mechanicService.updateMyProfile(userId(req), dto)
  }

  /** Le mécanicien consulte ses propres bookings du jour. */
  @Get('me/bookings')
  @Roles(UserRole.MECHANIC)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  getMyBookings(@Req() req: Request, @Query('date') date: string) {
    return this.mechanicService.getMyBookings(userId(req), date)
  }

  // ─── Routes publiques (tout utilisateur connecté) ────────────────────────────

  /** Liste des mécaniciens actifs (pour les clients qui veulent réserver). */
  @Get()
  @UseGuards(AuthGuard('jwt'))
  findActiveForUsers() {
    return this.mechanicService.findActive()
  }

  /** Bookings d'un mécanicien précis (ex: affichage calendrier pour un client). */
  @Get(':id/bookings')
  @UseGuards(AuthGuard('jwt'))
  getBookings(@Param('id') id: string, @Query('date') date: string) {
    return this.mechanicService.getMechanicBookings(id, date)
  }

  // ─── Routes Admin ────────────────────────────────────────────────────────────

  @Get('admin/all')
  @Roles(UserRole.ADMIN)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  findAllForAdmin() {
    return this.mechanicService.findAll()
  }

  @Post()
  @Roles(UserRole.ADMIN)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  create(@Body() dto: CreateMechanicDto) {
    return this.mechanicService.create(dto)
  }

  @Get('admin/:id')
  @Roles(UserRole.ADMIN)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  findOne(@Param('id') id: string) {
    return this.mechanicService.findOne(id)
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  update(@Param('id') id: string, @Body() dto: UpdateMechanicDto) {
    return this.mechanicService.update(id, dto)
  }

  @Delete(':id')
  @Roles(UserRole.ADMIN)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  remove(@Param('id') id: string) {
    return this.mechanicService.remove(id)
  }
}