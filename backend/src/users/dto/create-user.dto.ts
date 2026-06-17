import { IsEnum } from "class-validator/types/decorator/typechecker/IsEnum";
import { UserRole } from "../entities/user.entity";
export class CreateUserDto {

  email!: string;
  password!: string;
  name!: string;
  avatarUrl?: string;
  language?: string;
  @IsEnum(UserRole)
  role?: UserRole;
}
  