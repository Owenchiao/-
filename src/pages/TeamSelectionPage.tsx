import React from 'react';
import { motion } from 'motion/react';
import { TEAMS } from '../constants';

interface Props {
  onSelect: (teamId: string) => void;
}

export default function TeamSelectionPage({ onSelect }: Props) {
  return (
    <div className="min-h-screen bg-sky-100 p-8 flex flex-col items-center">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-4xl w-full"
      >
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
      </motion.div>
    </div>
  );
}
