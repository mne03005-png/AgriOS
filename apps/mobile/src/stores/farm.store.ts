import { defaultFarmId } from '../api/mock-data';

export const farmStore = {
  currentFarmId: defaultFarmId,
  setFarm(id: string) {
    this.currentFarmId = id;
  }
};
