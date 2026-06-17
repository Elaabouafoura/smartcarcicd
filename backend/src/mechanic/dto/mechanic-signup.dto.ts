import { IsEmail, IsString, MinLength, IsOptional, Length } from 'class-validator'

export class MechanicSignupDto {
  @IsEmail()
  email!: string

  @IsString()
  @MinLength(8, { message: 'Le mot de passe doit contenir au moins 8 caractères' })
  password!: string

  @IsString()
  @Length(2, 100)
  name!: string

  @IsOptional()
  @IsString()
  specialty?: string

  @IsOptional()
  @IsString()
  phone?: string

  @IsOptional()
  @IsString()
  location?: string
}