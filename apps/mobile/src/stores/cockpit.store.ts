import { getCockpit } from '../api/mobile-api';
import { farmStore } from './farm.store';

export const cockpitStore = {
  async load() {
    return getCockpit(farmStore.currentFarmIdOrDefault);
  }
};
