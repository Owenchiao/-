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
  skillEnergyCost: 0 | 1 | 2 | null;
  skillTrigger: SkillTrigger;
  skillType: string;
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
