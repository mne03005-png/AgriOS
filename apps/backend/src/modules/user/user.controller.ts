import { Controller } from '@nestjs/common';
import { BasicCrudController } from '../../common/basic-crud.controller';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserService } from './user.service';

@Controller('users')
export class UserController extends BasicCrudController<CreateUserDto, UpdateUserDto> {
  constructor(service: UserService) {
    super(service);
  }
}
