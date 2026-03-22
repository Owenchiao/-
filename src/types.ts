export type View = 'login' | 'team_selection' | 'main_menu' | 'inventory' | 'lobby' | 'selecting_chars' | 'battle' | 'redeem' | 'history';

export type Rarity = 'C' | 'R' | 'U' | 'UR';
export type Faction = '飛哥家' | '杜芬舒斯家' | '美眉家';
export type EnergyFaction = '通用' | '飛哥家' | '杜芬舒斯家' | '美眉家' | '凱蒂斯家';

export type SkillTrigger = 
  | 'none' 
  | 'before_attack' 
  | 'on_attack' 
  | 'on_enter' 
  | 'on_defend' 
  | 'after_attack' 
  | 'passive_sub' 
  | 'after_battle' 
  | 'unknown';

export type SkillType = 
  | 'none'
  | 'atk_up'
  | 'atk_up_fixed'
  | 'atk_if_low_hp'
  | 'atk_mult'
  | 'heal_self_fixed'
  | 'heal_sub_fixed'
  | 'battle_start_heal_sub'
  | 'gain_energy_on_coin'
  | 'gain_energy'
  | 'coin_energy'
  | 'coin_damage'
  | 'coin_gold'
  | 'deal_percent_enemy_atk'
  | 'deal_percent_enemy_hp'
  | 'splash_30_percent'
  | 'splash_damage_30'
  | 'hp_up_fixed'
  | 'self_guard_first_turn'
  | 'hit_lowest_sub'
  | 'disable_enemy_skill'
  | 'swap_with_sub_and_heal'
  | 'counter_damage_and_buff_next_atk'
  | 'bonus_gold_on_kill'
  | 'execute_if_target_below_20'
  | 'ignore_defense_coin'
  | 'force_swap_main'
  | 'self_damage_reduction'
  | 'protect_ally_in_sub'
  | 'random_steal_item'
  | 'item_effect_double'
  | 'choose_sub_damage'
  | 'redirect_attack_to_sub'
  | 'end_enemy_turn_and_alt_win'
  | 'reflect_direct_damage'
  | 'attach_energy_to_sub'
  | 'gain_gold_on_coin'
  | 'swap_main_sub'
  | 'extra_energy_attach_on_coin'
  | 'unknown';

export interface CharacterCard {
  id: string;
  type: 'character';
  name: string;
  faction: Faction;
  rarity: Rarity;
  atk: number;
  hp: number | null;
  skillName: string | null;
  skillDescription: string;
  skillEnergyCost: number | null;
  skillTrigger: SkillTrigger;
  skillType: SkillType;
  needsManualReview: boolean;
}

export interface ItemCard {
  id: string;
  type: 'item';
  name: string;
  description: string;
  usageTiming: 'attack_phase' | 'enemy_attack_phase' | 'any_turn' | 'instant' | 'unknown';
  itemType: 
    | 'atk_up' 
    | 'direct_attack_sub' 
    | 'execute_if_below_half' 
    | 'half_damage' 
    | 'heal' 
    | 'coin_flip_miss' 
    | 'force_swap_main' 
    | 'disable_enemy_items' 
    | 'gain_energy' 
    | 'gain_energy_phineas'
    | 'gain_energy_doof'
    | 'gain_energy_fireside'
    | 'swap_main_sub'
    | 'splash_up'
    | 'unknown';
  value: number | null;
  needsManualReview: boolean;
}

export interface EnergyCard {
  id: string;
  type: 'energy';
  name: string;
  faction: EnergyFaction;
  energyValue: 1;
  aliasTo: string | null;
}

export interface Team {
  id: string;
  name: string;
  inventory: {
    characters: string[]; // IDs
    items: string[]; // IDs
  };
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  selectedTeamId?: string;
}

export interface BattleCharacter extends CharacterCard {
  currentHp: number;
  maxHp: number;
  isDead: boolean;
  isResting: boolean;
  isMain: boolean;
  isSkillDisabled?: boolean;
  isFirstTurn?: boolean;
  isSkillUsed?: boolean;
  tempEffects?: {
    type: string;
    value?: number;
    turns?: number;
  }[];
}

export interface PlayerState {
  uid: string;
  teamId: string;
  teamName: string;
  selectedChars: BattleCharacter[];
  items: ItemCard[];
  activeEffects?: ItemCard[]; // New field for reactive items
  energy: number;
  hasAttackedThisTurn: boolean;
  forcedToAttack?: boolean;
}

export interface Room {
  id: string;
  status: 'waiting' | 'selecting_first_player' | 'selecting_chars' | 'preparing' | 'battle' | 'finished';
  players: PlayerState[];
  turn: string; // uid
  currentRound: number;
  logs: string[];
  winner?: string; // uid or 'draw'
  createdAt: any;
  firstPlayerUid: string;
  lastActivity: any;
}

export interface BattleHistory {
  id: string;
  userId: string;
  opponentId: string;
  opponentTeamName: string;
  result: 'win' | 'loss' | 'draw';
  timestamp: any;
  roomId: string;
}

export interface CardAcquisition {
  id: string;
  userId: string;
  cardId: string;
  cardName: string;
  cardType: 'character' | 'item' | 'energy';
  source: 'initial' | 'redeem' | 'battle_reward';
  timestamp: any;
}
