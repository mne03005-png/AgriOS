import { Body, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ListQueryDto } from './dto/list-query.dto';
export interface CrudService<TCreate extends object, TUpdate extends object = Partial<TCreate>> {
  create(dto: TCreate): unknown;
  findAll(query?: ListQueryDto): unknown;
  findOne(id: string): unknown;
  update(id: string, dto: TUpdate): unknown;
  remove(id: string): unknown;
}

export class BasicCrudController<TCreate extends object, TUpdate extends object = Partial<TCreate>> {
  constructor(private readonly crudService: CrudService<TCreate, TUpdate>) {}

  @Post()
  create(@Body() dto: TCreate) {
    return this.crudService.create(dto);
  }

  @Get()
  findAll(@Query() query: ListQueryDto) {
    return this.crudService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.crudService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: TUpdate) {
    return this.crudService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.crudService.remove(id);
  }
}
