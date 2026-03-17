import React from 'react';
import { motion } from 'motion/react';
import { Team, CharacterCard, ItemCard } from '../types';
import { CHARACTERS, ITEMS } from '../cardDatabase';
import { ArrowLeft, Shield, Sword, Heart, Zap, Package } from 'lucide-react';

interface Props {
  team: Team;
  onBack: () => void;
}

export default function InventoryPage({ team, onBack }: Props) {
  const teamChars = CHARACTERS.filter(c => team.inventory.characters.includes(c.id));
  const teamItems = ITEMS.filter(i => team.inventory.items.includes(i.id));

  return (
    <div className="min-h-screen bg-sky-50 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-3 bg-white rounded-2xl shadow-md hover:bg-sky-100 transition-colors"
          >
            <ArrowLeft className="w-6 h-6 text-sky-600" />
          </button>
          <h1 className="text-4xl font-black text-sky-600">小隊背包</h1>
        </div>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-700 flex items-center gap-2">
            <Sword className="text-orange-500" /> 角色卡 ({teamChars.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {teamChars.map(char => (
              <CharacterCardUI key={char.id} char={char} />
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-700 flex items-center gap-2">
            <Shield className="text-blue-500" /> 道具卡 ({teamItems.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {teamItems.map(item => (
              <ItemCardUI key={item.id} item={item} />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export function CharacterCardUI({ char, selected = false, onClick }: { char: CharacterCard, selected?: boolean, onClick?: () => void, key?: any }) {
  const factionColors = {
    '飛哥家': 'bg-orange-50 border-orange-400 text-orange-700',
    '杜芬舒斯家': 'bg-purple-50 border-purple-400 text-purple-700',
    '美眉家': 'bg-pink-50 border-pink-400 text-pink-700',
  };

  const rarityColors = {
    C: 'bg-gray-200 text-gray-600',
    R: 'bg-blue-200 text-blue-600',
    U: 'bg-purple-200 text-purple-600',
    UR: 'bg-yellow-200 text-yellow-700 border-yellow-400',
  };

  return (
    <motion.div 
      whileHover={{ y: -5 }}
      onClick={onClick}
      className={`${factionColors[char.faction]} border-4 rounded-3xl p-4 shadow-lg relative overflow-hidden cursor-pointer ${selected ? 'ring-4 ring-blue-500 scale-105' : ''}`}
    >
      <div className="flex justify-between items-start mb-2">
        <span className={`text-xs font-black px-2 py-1 rounded-lg ${rarityColors[char.rarity]}`}>
          {char.rarity}
        </span>
        <span className="text-xs font-bold opacity-70">{char.faction}</span>
      </div>
      
      <h3 className="text-xl font-black mb-3">{char.name}</h3>
      
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="flex items-center gap-1 bg-white/50 rounded-xl p-2">
          <Sword className="w-4 h-4" />
          <span className="font-bold">{char.atk}</span>
        </div>
        <div className="flex items-center gap-1 bg-white/50 rounded-xl p-2">
          <Heart className="w-4 h-4 text-red-500" />
          <span className="font-bold">{char.hp ?? '???'}</span>
        </div>
      </div>

      {char.skillName && (
        <div className="bg-white/40 rounded-xl p-3 text-sm">
          <div className="font-black flex justify-between">
            <span>{char.skillName}</span>
            <span className="flex items-center gap-1 text-blue-600">
              <Zap className="w-3 h-3" /> {char.skillEnergyCost}
            </span>
          </div>
          <p className="text-xs opacity-80 mt-1">{char.skillDescription}</p>
        </div>
      )}
    </motion.div>
  );
}

function ItemCardUI({ item }: { item: ItemCard, key?: any }) {
  return (
    <div className="bg-white border-4 border-sky-200 rounded-3xl p-4 shadow-md flex gap-4 items-center">
      <div className="w-16 h-16 bg-sky-100 rounded-2xl flex items-center justify-center">
        <Package className="w-8 h-8 text-sky-500" />
      </div>
      <div>
        <h3 className="font-black text-lg">{item.name}</h3>
        <p className="text-sm text-gray-500">{item.description}</p>
      </div>
    </div>
  );
}
