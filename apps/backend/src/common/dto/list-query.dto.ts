import { Allow } from 'class-validator';

export class ListQueryDto {
  @Allow()
  page?: number;

  @Allow()
  pageSize?: number;

  @Allow()
  keyword?: string;

  @Allow()
  fieldId?: string;

  @Allow()
  cropSeasonId?: string;

  @Allow()
  type?: string;
}
