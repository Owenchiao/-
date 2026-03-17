import React from 'react';
import { motion } from 'motion/react';

interface Props {
  onGoogleLogin: () => void;
}

export default function LoginPage({ onGoogleLogin }: Props) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-sky-400 to-sky-600 p-4 text-white">
      <motion.div 
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center space-y-8 max-w-lg"
      >
        <h1 className="text-5xl md:text-7xl font-black tracking-tighter drop-shadow-lg">
          飛哥與小佛
        </h1>
        <div className="bg-white/20 backdrop-blur-md p-8 rounded-3xl border-4 border-white shadow-2xl space-y-6">
          <h2 className="text-3xl font-bold mb-4">杜芬舒斯博士最終對決</h2>
          <p className="text-lg opacity-90 mb-4">
            準備好加入這場跨越夏天的冒險了嗎？登入 Google 帳號，選擇你的小隊，擊敗杜芬舒斯的邪惡計畫！
          </p>
          
          <button 
            onClick={onGoogleLogin}
            className="w-full py-5 px-8 bg-white hover:bg-gray-100 text-gray-800 text-2xl font-black rounded-2xl shadow-xl transform transition hover:scale-105 active:scale-95 flex items-center justify-center gap-4"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-8 h-8" alt="Google" />
            使用 Google 登入
          </button>
        </div>
        <p className="text-sm opacity-70 italic">
          「嘿，小佛，我知道我們今天要做什麼了！」
        </p>
      </motion.div>
    </div>
  );
}
