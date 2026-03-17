import { EnergyCard } from './types';

export const ENERGY_CARDS: EnergyCard[] = [
  {
    id: "energy_general",
    type: "energy",
    name: "通用能量點",
    faction: "通用",
    energyValue: 1,
    aliasTo: null
  },
  {
    id: "energy_candace",
    type: "energy",
    name: "凱蒂斯家能量點",
    faction: "凱蒂斯家",
    energyValue: 1,
    aliasTo: "飛哥家"
  },
  {
    id: "energy_doof",
    type: "energy",
    name: "杜芬舒斯家能量點",
    faction: "杜芬舒斯家",
    energyValue: 1,
    aliasTo: null
  },
  {
    id: "energy_fireside",
    type: "energy",
    name: "美眉家能量點",
    faction: "美眉家",
    energyValue: 1,
    aliasTo: null
  }
];
