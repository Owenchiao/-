import { ItemCard } from './types';

export const ITEM_CARDS: ItemCard[] = [
  {
    id: "item_doof_inator",
    type: "item",
    name: "毀滅三州地區",
    description: "本回合主要位置角色攻擊力 +40",
    usageTiming: "attack_phase",
    itemType: "atk_up",
    value: 40,
    needsManualReview: false
  },
  {
    id: "item_tracker",
    type: "item",
    name: "自動追蹤器",
    description: "攻擊時，可選擇對方的備戰區角色作為直接攻擊目標",
    usageTiming: "attack_phase",
    itemType: "direct_attack_sub",
    value: null,
    needsManualReview: false
  },
  {
    id: "item_terminator",
    type: "item",
    name: "終結者射線",
    description: "若對方生命值低於50%，此攻擊直接將其生命歸零",
    usageTiming: "attack_phase",
    itemType: "execute_if_below_half",
    value: 50,
    needsManualReview: false
  },
  {
    id: "item_ferb_blueprint",
    type: "item",
    name: "小佛的藍圖",
    description: "可在對方發起攻擊時使用，本回合我的角色受到的傷害減半（含主位與備戰區）",
    usageTiming: "enemy_attack_phase",
    itemType: "half_damage",
    value: 0.5,
    needsManualReview: false
  },
  {
    id: "item_medkit",
    type: "item",
    name: "美眉家族的醫藥箱",
    description: "回復一名角色60點生命值",
    usageTiming: "any_turn",
    itemType: "heal",
    value: 60,
    needsManualReview: false
  },
  {
    id: "item_hologram",
    type: "item",
    name: "全息影像裝置",
    description: "本回合對方攻擊有50%機率落空（拋擲硬幣決定）",
    usageTiming: "enemy_attack_phase",
    itemType: "coin_flip_miss",
    value: 0.5,
    needsManualReview: false
  },
  {
    id: "item_candace_report",
    type: "item",
    name: "凱蒂絲的檢舉信",
    description: "可在雙方回合使用，強制對手更換目前的主位角色，更換後的角色仍可以發起攻擊或使用特殊技能",
    usageTiming: "any_turn",
    itemType: "force_swap_main",
    value: null,
    needsManualReview: false
  },
  {
    id: "item_time_stop",
    type: "item",
    name: "時間停止器",
    description: "可在對方回合使用，使對方本回合無法使用道具卡",
    usageTiming: "enemy_attack_phase",
    itemType: "disable_enemy_items",
    value: null,
    needsManualReview: false
  },
  {
    id: "item_battery",
    type: "item",
    name: "能量電池",
    description: "使任一角色立即獲得2點能量點",
    usageTiming: "any_turn",
    itemType: "gain_energy",
    value: 2,
    needsManualReview: false
  },
  {
    id: "item_doof_converter",
    type: "item",
    name: "杜芬舒斯的轉換器",
    description: "替換，可在雙方回合使用，將自己備戰區和主要位置的角色互換",
    usageTiming: "any_turn",
    itemType: "swap_main_sub",
    value: null,
    needsManualReview: false
  },
  {
    id: "item_energy_general",
    type: "item",
    name: "通用能量點",
    description: "可以為任一角色灌注能量點",
    usageTiming: "any_turn",
    itemType: "gain_energy",
    value: 1,
    needsManualReview: false
  },
  {
    id: "item_energy_phineas",
    type: "item",
    name: "凱蒂斯家能量點",
    description: "可以為凱蒂斯家的角色灌注能量點",
    usageTiming: "any_turn",
    itemType: "gain_energy_phineas",
    value: 1,
    needsManualReview: false
  },
  {
    id: "item_energy_doof",
    type: "item",
    name: "杜芬舒斯家能量點",
    description: "可以為杜芬舒斯家的角色灌注能量點",
    usageTiming: "any_turn",
    itemType: "gain_energy_doof",
    value: 1,
    needsManualReview: false
  },
  {
    id: "item_energy_fireside",
    type: "item",
    name: "美眉家能量點",
    description: "可以為美眉家的角色灌注能量點",
    usageTiming: "any_turn",
    itemType: "gain_energy_fireside",
    value: 1,
    needsManualReview: false
  },
  {
    id: "item_splash_potion",
    type: "item",
    name: "濺射藥水",
    description: "本回合攻擊的濺射傷害提升至30%",
    usageTiming: "attack_phase",
    itemType: "splash_up",
    value: 0.3,
    needsManualReview: false
  }
];
