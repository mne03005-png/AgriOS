import { randomUUID } from 'node:crypto';

export interface BaseRecord {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export class CrudMemoryService<TCreate extends object, TUpdate extends object = Partial<TCreate>> {
  private readonly records = new Map<string, BaseRecord & TCreate>();

  create(dto: TCreate) {
    const now = new Date();
    const record = {
      id: randomUUID(),
      ...dto,
      createdAt: now,
      updatedAt: now
    } as BaseRecord & TCreate;
    this.records.set(record.id, record);
    return record;
  }

  findAll() {
    return [...this.records.values()];
  }

  findOne(id: string) {
    return this.records.get(id) ?? null;
  }

  update(id: string, dto: TUpdate) {
    const current = this.records.get(id);
    if (!current) {
      return null;
    }

    const updated = {
      ...current,
      ...dto,
      updatedAt: new Date()
    } as BaseRecord & TCreate;
    this.records.set(id, updated);
    return updated;
  }

  remove(id: string) {
    return { id, deleted: this.records.delete(id) };
  }
}
