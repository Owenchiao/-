import { BattleCharacter, ItemCard } from '../types';

export const calculateDamage = (
  attacker: BattleCharacter,
  defender: BattleCharacter,
  energyUsed: number,
  skillUsed: boolean,
  itemUsed?: ItemCard
) => {
  let damage = attacker.atk;

  // Energy boost
  if (energyUsed === 1) damage += 20;
  if (energyUsed === 2) damage += 60;

  // Skill boost (if applicable)
  if (skillUsed && attacker.skillType === 'atk_up') {
    damage += 30; // Default skill boost for now
  }

  // Item boost
  if (itemUsed?.itemType === 'atk_up') {
    damage += itemUsed.value || 0;
  }

  // Type Advantage
  // 飛哥家 > 杜芬舒斯家 > 美眉家 > 飛哥家
  const advantage = 
    (attacker.faction === '飛哥家' && defender.faction === '杜芬舒斯家') ||
    (attacker.faction === '杜芬舒斯家' && defender.faction === '美眉家') ||
    (attacker.faction === '美眉家' && defender.faction === '飛哥家');

  if (advantage) {
    damage += 20;
  }

  return { damage, advantage };
};

export const applyDamage = (
  characters: BattleCharacter[],
  mainDamage: number,
  isMainTarget: boolean
) => {
  return characters.map(char => {
    if (char.isDead) return char;
    
    let damageTaken = 0;
    if (char.isMain) {
      damageTaken = mainDamage;
    } else {
      damageTaken = Math.floor(mainDamage * 0.2);
    }

    const newHp = Math.max(0, char.currentHp - damageTaken);
    return {
      ...char,
      currentHp: newHp,
      isDead: newHp === 0
    };
  });
};
