import React from 'react';
import { motion } from 'motion/react';
import { TEAMS, NPCS } from '../constants';

interface Props {
  onSelect: (teamId: string) => void;
}

export default function TeamSelectionPage({ onSelect }: Props) {
  return (
    <div className="min-h-screen bg-sky-100 p-8 flex flex-col items-center">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-4xl w-full space-y-12"
      >
        <section>
          <h1 className="text-4xl font-black text-sky-600 text-center mb-8 drop-shadow-sm">
            選擇你的小隊
          </h1>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {TEAMS.map((teamId) => (
              <button
                key={teamId}
                onClick={() => onSelect(teamId)}
                className="bg-white hover:bg-sky-500 hover:text-white text-sky-600 font-bold py-6 rounded-2xl shadow-md border-2 border-sky-200 transition-all transform hover:scale-105 active:scale-95 text-2xl"
              >
                {teamId}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-3xl font-black text-orange-500 text-center mb-8 drop-shadow-sm">
            NPC 對戰角色
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {NPCS.map((npcId) => (
              <button
                key={npcId}
                onClick={() => onSelect(npcId)}
                className="bg-orange-50 hover:bg-orange-500 hover:text-white text-orange-600 font-bold py-6 px-4 rounded-2xl shadow-md border-2 border-orange-200 transition-all transform hover:scale-105 active:scale-95 text-xl"
              >
                {npcId}
              </button>
            ))}
          </div>
        </section>
      </motion.div>
    </div>
  );
}
