import { BattleCharacter, ItemCard } from '../types';

export const calculateDamage = (
  attacker: BattleCharacter,
  defender: BattleCharacter,
  energyUsed: number,
  skillUsed: boolean,
  itemUsed?: ItemCard,
  defenderItems?: ItemCard[]
) => {
  let damage = attacker.atk;
  let isMiss = false;

  const coinFlips: boolean[] = [];

  // 1. Check for Hologram Device (coin_flip_miss) on defender
  const hologram = defenderItems?.find(i => i.itemType === 'coin_flip_miss');
  if (hologram) {
    const coinFlip = Math.random() > 0.5;
    coinFlips.push(coinFlip);
    if (coinFlip) {
      isMiss = true;
      return { damage: 0, advantage: false, isMiss: true, coinFlips };
    }
  }

  // Energy boost: 1 energy -> +20, 2 energy -> +60
  if (energyUsed === 1) {
    damage += 20;
  } else if (energyUsed === 2) {
    damage += 60;
  } else if (energyUsed > 2) {
    damage += energyUsed * 30;
  }

  // Skill boost (if applicable)
  if (skillUsed) {
    if (attacker.skillType === 'atk_up') {
      damage += 30;
    } else if (attacker.skillType === 'coin_damage') {
      // 擲硬幣2次，增加出現正面次數*30的傷害
      const c1 = Math.random() > 0.5;
      const c2 = Math.random() > 0.5;
      coinFlips.push(c1, c2);
      const heads = [c1, c2].filter(c => c).length;
      damage += heads * 30;
    } else if (attacker.skillType === 'ignore_defense_coin') {
      // 擲硬幣正面則可無視直接造成全額傷害並額外增加5點威力
      const coinFlip = Math.random() > 0.5;
      coinFlips.push(coinFlip);
      if (coinFlip) {
        damage += 5;
        // Ignore defense logic would be handled by not applying reduction, 
        // but current engine doesn't have much reduction yet except for items.
      }
    } else if (attacker.skillType === 'atk_if_low_hp') {
      if (attacker.currentHp <= 50) {
        damage += 30;
      }
    }
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

  // 2. Terminator Ray (execute_if_below_half)
  if (itemUsed?.itemType === 'execute_if_below_half') {
    const threshold = (itemUsed.value || 50) / 100;
    if (defender.currentHp <= defender.maxHp * threshold) {
      damage = defender.currentHp; // Direct execute
    }
  }

  return { damage, advantage, isMiss: false, coinFlips };
};

export const applyDamage = (
  characters: BattleCharacter[],
  mainDamage: number,
  targetId?: string | null,
  itemUsed?: ItemCard,
  hasAdvantage: boolean = false,
  defenderItems?: ItemCard[]
) => {
  // Determine who takes 100% damage
  let primaryTargetId: string | null = null;
  const isAutoTracker = itemUsed?.itemType === 'direct_attack_sub';

  if (isAutoTracker && targetId) {
    primaryTargetId = targetId;
  } else {
    // Default to main character or first alive
    const mainChar = characters.find(c => c.isMain && !c.isDead);
    if (mainChar) {
      primaryTargetId = mainChar.id;
    } else {
      const firstAlive = characters.find(c => !c.isDead);
      if (firstAlive) primaryTargetId = firstAlive.id;
    }
  }

  // 3. Ferb's Blueprint (half_damage) on defender
  const halfDamageItem = defenderItems?.find(i => i.itemType === 'half_damage');
  const damageMultiplier = halfDamageItem ? 0.5 : 1;

  // Rule: Splash damage (20%) is NOT affected by type advantage (+20)
  const baseDamageForSplash = hasAdvantage ? Math.max(0, mainDamage - 20) : mainDamage;

  return characters.map(char => {
    if (char.isDead) return char;
    
    let damageTaken = 0;
    
    if (char.id === primaryTargetId) {
      // Primary target takes 100% damage (including advantage)
      damageTaken = Math.floor(mainDamage * damageMultiplier);
    } else {
      // Others take 20% splash damage (based on base damage)
      damageTaken = Math.floor(baseDamageForSplash * 0.2 * damageMultiplier);
    }

    const newHp = Math.max(0, char.currentHp - damageTaken);
    return {
      ...char,
      currentHp: newHp,
      isDead: newHp === 0
    };
  });
};
