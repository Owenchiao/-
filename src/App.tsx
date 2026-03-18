import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signInAnonymously, signOut, User, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, db } from './firebase';
import { gameService } from './services/gameService';
import { UserProfile, Team, View } from './types';
import { Toaster, toast } from 'react-hot-toast';

// Pages
import LoginPage from './pages/LoginPage';
import TeamSelectionPage from './pages/TeamSelectionPage';
import MainMenuPage from './pages/MainMenuPage';
import InventoryPage from './pages/InventoryPage';
import LobbyPage from './pages/LobbyPage';
import CharacterSelectionPage from './pages/CharacterSelectionPage';
import BattlePage from './pages/BattlePage';
import RedeemPage from './pages/RedeemPage';
import HistoryPage from './pages/HistoryPage';


export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [view, setView] = useState<View>('login');
  const [currentRoomId, setCurrentRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);

  console.log('App component rendering, loading:', loading, 'view:', view);

  useEffect(() => {
    // Detect In-App Browsers (Line, FB, IG, etc.)
    const ua = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isInApp = /Line|FBAN|FBAV|Instagram|MicroMessenger/i.test(ua);
    setIsInAppBrowser(isInApp);

    console.log('App initialized, starting auth check...');
    // Safety timeout: if auth doesn't respond in 8 seconds, unblock the UI
    const safetyTimeout = setTimeout(() => {
      console.log('Safety timeout triggered, current loading state:', loading);
      if (loading) {
        console.warn('Auth initialization timed out, unblocking UI');
        setLoading(false);
        setView('login');
      }
    }, 8000);

    let unsubscribe: (() => void) | undefined;

    if (!auth) {
      console.error('Firebase Auth not initialized');
      setLoading(false);
      setView('login');
      return;
    }

    try {
      unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        try {
          setUser(firebaseUser);
          if (firebaseUser) {
            const userProfile = await gameService.getUserProfile(firebaseUser.uid);
            if (userProfile) {
              setProfile(userProfile);
              if (userProfile.selectedTeamId) {
                const userTeamId = `${firebaseUser.uid}_${userProfile.selectedTeamId}`;
                const teamData = await gameService.getTeam(userTeamId);
                if (teamData) {
                  setTeam(teamData);
                  setView('main_menu');
                } else {
                  // If team data is missing (e.g. after a reset or format change), 
                  // clear the selectedTeamId and go to selection
                  const updatedProfile = { ...userProfile, selectedTeamId: null };
                  await gameService.createUserProfile(updatedProfile);
                  setProfile(updatedProfile);
                  setView('team_selection');
                }
              } else {
                setView('team_selection');
              }
            } else {
              const newProfile: UserProfile = {
                uid: firebaseUser.uid,
                email: firebaseUser.email || 'anonymous@example.com',
                displayName: firebaseUser.displayName || `玩家_${firebaseUser.uid.slice(0, 4)}`,
              };
              await gameService.createUserProfile(newProfile);
              setProfile(newProfile);
              setView('team_selection');
            }
          } else {
            setProfile(null);
            setTeam(null);
            setView('login');
          }
        } catch (error: any) {
          console.error('Auth state change error:', error);
          toast.error('初始化失敗，請檢查網路或設定');
          setView('login');
        } finally {
          clearTimeout(safetyTimeout);
          setLoading(false);
        }
      }, (error) => {
        console.error('onAuthStateChanged error:', error);
        clearTimeout(safetyTimeout);
        setLoading(false);
        setView('login');
      });
    } catch (error) {
      console.error('Failed to register auth listener:', error);
      clearTimeout(safetyTimeout);
      setLoading(false);
      setView('login');
    }

    return () => {
      clearTimeout(safetyTimeout);
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error('Google login error:', error);
      toast.error(`Google 登入失敗: ${error.message}`);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setView('login');
    } catch (error) {
      toast.error('登出失敗');
    }
  };

  const handleReset = async () => {
    if (!profile || !team) {
      toast.error('找不到個人檔案或小隊資料，無法重置');
      return;
    }
    
    setShowResetConfirm(true);
  };

  const confirmReset = async () => {
    if (!profile) return;
    
    try {
      setLoading(true);
      setShowResetConfirm(false);
      console.log('Starting full reset for user:', profile.uid);
      await gameService.resetGameData(profile.uid);
      toast.success('遊戲紀錄已重置');
      
      // Clear local state before reload to be safe
      setProfile(null);
      setTeam(null);
      
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error: any) {
      console.error('Reset error details:', error);
      const errorMsg = error.message || '未知錯誤';
      toast.error(`重置失敗: ${errorMsg}`);
      setLoading(false);
    }
  };

  const handleSelectTeam = async (teamId: string) => {
    if (!profile) return;
    const updatedProfile = { ...profile, selectedTeamId: teamId };
    await gameService.createUserProfile(updatedProfile);
    setProfile(updatedProfile);
    
    // Initialize user-specific team data if it doesn't exist
    const userTeamId = `${profile.uid}_${teamId}`;
    let teamData = await gameService.getTeam(userTeamId);
    if (!teamData) {
      // Define initial cards (3 characters, 1 item as per rules)
      const initialChars = ['char_phineas_c', 'char_ferb_c', 'char_isabella_c'];
      const initialItems = ['item_heal_50'];

      teamData = {
        id: userTeamId,
        name: `小隊 ${teamId}`,
        inventory: {
          characters: initialChars,
          items: initialItems
        }
      };
      await gameService.updateTeam(teamData);

      // Record acquisitions
      const { CHARACTERS, ITEMS } = await import('./constants');
      for (const charId of initialChars) {
        const char = CHARACTERS.find(c => c.id === charId);
        if (char) {
          await gameService.recordCardAcquisition({
            id: '',
            userId: profile.uid,
            cardId: charId,
            cardName: char.name,
            cardType: 'character',
            source: 'initial',
            timestamp: null
          });
        }
      }
      for (const itemId of initialItems) {
        const item = ITEMS.find(i => i.id === itemId);
        if (item) {
          await gameService.recordCardAcquisition({
            id: '',
            userId: profile.uid,
            cardId: itemId,
            cardName: item.name,
            cardType: 'item',
            source: 'initial',
            timestamp: null
          });
        }
      }
    }
    setTeam(teamData);
    setView('main_menu');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-sky-100 flex flex-col items-center justify-center gap-6 p-6 text-center">
        <div className="text-3xl font-black text-sky-600 animate-bounce">載入中...</div>
        
        <div className="bg-white/50 backdrop-blur-sm p-6 rounded-3xl border-2 border-sky-200 max-w-sm space-y-4 shadow-inner">
          <p className="text-sky-700 font-bold">
            偵測到載入時間較長，這通常是因為瀏覽器封鎖了「第三方 Cookie」。
          </p>
          <p className="text-sm text-sky-600/80 leading-relaxed">
            如果您是在 AI Studio 預覽視窗中查看，請點擊下方按鈕在「新分頁」開啟，即可正常進入。
          </p>
          
          <div className="flex flex-col gap-3">
            <button 
              onClick={() => window.open(window.location.href, '_blank')}
              className="w-full py-4 bg-sky-500 text-white rounded-2xl font-black shadow-lg hover:bg-sky-600 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              在新分頁開啟遊戲
            </button>
            
            <button 
              onClick={() => {
                setLoading(false);
                setView('login');
              }}
              className="w-full py-3 bg-white text-sky-500 rounded-xl font-bold border-2 border-sky-100 hover:bg-sky-50 transition-all"
            >
              強制進入登入頁面
            </button>
          </div>
        </div>

        <div className="text-[10px] text-sky-300 font-mono opacity-50">
          Debug: {auth ? 'Auth OK' : 'Auth Fail'} | {db ? 'DB OK' : 'DB Fail'} | {view}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sky-100 font-sans text-gray-800">
      <Toaster position="top-center" />
      
      {view === 'login' && (
        <>
          {isInAppBrowser && (
            <div className="fixed top-0 left-0 w-full bg-yellow-500 text-white p-4 z-[100] flex items-center justify-between shadow-lg animate-in slide-in-from-top duration-300">
              <div className="flex items-center gap-3">
                <span className="text-2xl">⚠️</span>
                <p className="font-bold text-sm">
                  偵測到您正在使用 App 內建瀏覽器。請點擊右上角「...」並選擇「用瀏覽器開啟」以正常登入。
                </p>
              </div>
              <button onClick={() => setIsInAppBrowser(false)} className="text-white font-black p-2">✕</button>
            </div>
          )}
          <LoginPage 
            onGoogleLogin={handleGoogleLogin} 
          />
        </>
      )}
      
      {view === 'team_selection' && (
        <TeamSelectionPage onSelect={handleSelectTeam} />
      )}
      
      {view === 'main_menu' && team && (
        <MainMenuPage 
          team={team} 
          onNavigate={setView} 
          onLogout={handleLogout}
          onReset={handleReset}
          setCurrentRoomId={setCurrentRoomId}
        />
      )}
      
      {view === 'inventory' && team && (
        <InventoryPage team={team} onBack={() => setView('main_menu')} />
      )}
      
      {view === 'lobby' && team && profile && (
        <LobbyPage 
          team={team} 
          profile={profile} 
          onBack={() => setView('main_menu')} 
          onEnterRoom={(id) => {
            setCurrentRoomId(id);
            setView('selecting_chars');
          }}
        />
      )}

      {view === 'selecting_chars' && currentRoomId && team && profile && (
        <CharacterSelectionPage 
          roomId={currentRoomId}
          team={team}
          profile={profile}
          onStartBattle={() => setView('battle')}
          onCancel={() => {
            gameService.leaveRoom(currentRoomId, profile.uid);
            setView('main_menu');
          }}
        />
      )}

      {view === 'battle' && currentRoomId && team && profile && (
        <BattlePage 
          roomId={currentRoomId}
          team={team}
          profile={profile}
          onFinish={() => {
            gameService.leaveRoom(currentRoomId, profile.uid);
            // Refresh team data after battle
            gameService.getTeam(team.id).then(setTeam);
            setView('main_menu');
          }}
        />
      )}

      {view === 'redeem' && team && (
        <RedeemPage 
          team={team} 
          onBack={() => setView('main_menu')} 
          onUpdateTeam={setTeam}
        />
      )}

      {view === 'history' && profile && (
        <HistoryPage 
          profile={profile} 
          onBack={() => setView('main_menu')} 
        />
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border-4 border-red-500 animate-in zoom-in duration-200">
            <h3 className="text-2xl font-black text-red-600 mb-4">確定要重置嗎？</h3>
            <p className="text-gray-600 font-bold mb-8 leading-relaxed">
              這將會刪除您的小隊資料與背包卡片，且無法復原。您將需要重新選擇小隊並重新登錄卡片。
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 py-4 rounded-2xl font-black bg-gray-200 text-gray-700 hover:bg-gray-300 transition-colors"
              >
                取消
              </button>
              <button 
                onClick={confirmReset}
                className="flex-1 py-4 rounded-2xl font-black bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-200 transition-colors"
              >
                確定重置
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
