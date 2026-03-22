import { BattleCharacter, ItemCard } from '../types';

export const calculateDamage = (
  attacker: BattleCharacter,
  defender: BattleCharacter,
  atkBoost: number,
  skillUsed: boolean,
  itemUsed?: ItemCard,
  defenderItems?: ItemCard[]
) => {
  let damage = attacker.atk;
  let isMiss = false;

  // 1. Check for Hologram Device (coin_flip_miss) on defender
  const hologram = defenderItems?.find(i => i.itemType === 'coin_flip_miss');
  if (hologram) {
    const coinFlip = Math.random() > 0.5;
    if (coinFlip) {
      isMiss = true;
      return { damage: 0, advantage: false, isMiss: true };
    }
  }

  // Energy boost
  if (atkBoost > 0) {
    damage += atkBoost;
  }

  // Skill logic
  const isSkillActive = skillUsed || attacker.skillEnergyCost === 0;
  if (isSkillActive) {
    switch (attacker.skillType) {
      case 'atk_up':
        damage += 30;
        break;
      case 'atk_up_fixed':
        // Check if it's a specific card with a different value
        if (attacker.id === 'char_holly_guard_r') damage += 25;
        else if (attacker.id === 'char_buford_scary_r') damage += 20;
        else damage += 20;
        break;
      case 'atk_if_low_hp':
        if (attacker.currentHp <= 50) damage += 30;
        break;
      case 'deal_percent_enemy_atk':
        // Suzy Dark U: 10%, Carl: 30%, Milly: 30%
        const percent = (attacker.id === 'char_suzy_r' || attacker.id === 'char_suzy_dark_u') ? 0.1 : 0.3;
        damage = Math.floor(defender.atk * percent);
        break;
      case 'deal_percent_enemy_hp':
        // Bigfoot U: 10% of maxHp
        damage = Math.floor(defender.maxHp * 0.1);
        break;
      case 'coin_damage':
        // Milly Cookie: 2 coins, each +30
        const heads = [Math.random() > 0.5, Math.random() > 0.5].filter(Boolean).length;
        damage += heads * 30;
        break;
      case 'atk_mult':
        damage = Math.floor(damage * 1.5);
        break;
      case 'ignore_defense_coin':
        const isHeads = Math.random() > 0.5;
        if (isHeads) {
          damage += 5;
          // Note: "ignore defense" is handled by setting damageMultiplier to 1 in applyDamage if we wanted to be precise, 
          // but here we can just add a flag or handle it in applyDamage.
        }
        break;
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

  return { damage, advantage, isMiss: false };
};

export const applyDamage = (
  characters: BattleCharacter[],
  mainDamage: number,
  targetId?: string | null,
  itemUsed?: ItemCard,
  hasAdvantage: boolean = false,
  defenderItems?: ItemCard[],
  attacker?: BattleCharacter,
  skillUsed?: boolean
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
  let damageMultiplier = halfDamageItem ? 0.5 : 1;

  // Hendel UR: Item effect double
  const hasHendel = characters.some(c => c.skillType === 'item_effect_double' && !c.isMain && !c.isDead);
  if (hasHendel && halfDamageItem) {
    damageMultiplier = 0.25; // Double the reduction (half of half)
  }

  // Skill-based damage reduction
  const defenderMain = characters.find(c => c.id === primaryTargetId);
  if (defenderMain?.skillType === 'self_damage_reduction') {
    // Ginger: -25, Brigitte: -20%, Parallel Doof: -150
    if (defenderMain.id === 'char_ginger_wind_u') {
      // Handled later in the map
    } else if (defenderMain.id === 'char_brigitte_strong_r') {
      damageMultiplier *= 0.8;
    }
  }

  // Rule: Splash damage (20%) is NOT affected by type advantage (+20)
  const baseDamageForSplash = hasAdvantage ? Math.max(0, mainDamage - 20) : mainDamage;

  // Splash percentage
  let splashPercent = 0.2;
  const isAttackerSkillActive = skillUsed || attacker?.skillEnergyCost === 0;
  if (isAttackerSkillActive && (attacker?.skillType === 'splash_30_percent' || attacker?.skillType === 'splash_damage_30')) {
    splashPercent = 0.3;
  } else if (itemUsed?.itemType === 'splash_up') {
    splashPercent = 0.3; // Assuming an item might do this
  }

  return characters.map(char => {
    if (char.isDead) return char;
    
    let damageTaken = 0;
    
    if (char.id === primaryTargetId) {
      // Primary target takes 100% damage (including advantage)
      damageTaken = Math.floor(mainDamage * damageMultiplier);
      
      // Fixed reduction for Ginger
      if (char.id === 'char_ginger_wind_u') {
        damageTaken = Math.max(5, damageTaken - 25);
      }
      // Perry Mech U: self_guard_first_turn
      if (char.skillType === 'self_guard_first_turn' && char.isFirstTurn) {
        damageTaken = Math.max(0, damageTaken - 20);
      }
      // Parallel Doof
      if (char.id === 'char_doof_parallel_ur') {
        damageTaken = Math.max(0, damageTaken - 150);
      }

      // Execute if target below 20 (Vader Doof)
      const isAttackerSkillActive = skillUsed || attacker?.skillEnergyCost === 0;
      if (attacker?.skillType === 'execute_if_target_below_20' && isAttackerSkillActive) {
        if (char.currentHp - damageTaken < 20) {
          damageTaken = char.currentHp;
        }
      }

      // Reflect direct damage (Brigitte Myth UR)
      if (char.skillType === 'reflect_direct_damage') {
        // This is tricky as we need to return damage to attacker.
        // For now, let's just note it in the logic or handle it in BattlePage.
      }
    } else {
      // Others take splash damage
      damageTaken = Math.floor(baseDamageForSplash * splashPercent * damageMultiplier);
    }

    let newHp = Math.max(0, char.currentHp - damageTaken);
    
    // Melissa Legend U: protect_ally_in_sub
    if (newHp === 0 && char.currentHp > 0) {
      const hasMelissa = characters.some(c => c.skillType === 'protect_ally_in_sub' && !c.isMain && !c.isDead);
      if (hasMelissa) {
        newHp = 10;
      }
    }

    return {
      ...char,
      currentHp: newHp,
      isDead: newHp === 0
    };
  });
};
