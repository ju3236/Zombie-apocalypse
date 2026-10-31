import { useEffect, useState } from 'react';
import { toast } from './game/bus';
import { adapter, addNews, saveNow, sessionStore, store, useGameRev, useSession } from './game/store';
import { describeReport, tickProduction } from './game/systems/time';
import { syncWorld } from './game/newGame';
import { isTicker, resumeOnline } from './game/online';
import { activeCharacter, myCharacters, Toasts } from './ui/common';
import { CharactersView } from './ui/CharactersView';
import { PlayerSelect, Setup } from './ui/Setup';
import { RpLogView } from './ui/RpLogView';
import { SettingsView } from './ui/SettingsView';
import { LeftColumn } from './ui/LeftColumn';
import { MainView } from './ui/MainView';
import { StorageHub } from './ui/StorageHub';
import { RightColumn } from './ui/RightColumn';

export default function App() {
  const [loaded, setLoaded] = useState(false);
  useGameRev();
  const session = useSession();

  useEffect(() => {
    void adapter.load().then((data) => {
      if (data) {
        syncWorld(data);
        store.set(data);
        // 오프라인 동안의 안전한 생산 처리
        const report = tickProduction();
        const txt = describeReport(report);
        if (txt) {
          addNews(`자리를 비운 사이 시설이 작동했다: ${txt}`, 'good');
          toast(`자리를 비운 사이: ${txt}`, 'good');
        }
        store.commit();
      }
      setLoaded(true);
      void resumeOnline();
    });
    const iv = window.setInterval(() => {
      if (!store.has) return;
      // 같이 살기 중이면 생산 시계는 한 사람만 돌린다
      if (!isTicker()) return;
      const r = tickProduction();
      const txt = describeReport(r);
      if (txt) toast(`생산 완료: ${txt}`, 'good');
      store.commit();
    }, 15000);
    const onUnload = () => saveNow();
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.clearInterval(iv);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, []);

  if (!loaded) return <div className="loading">불러오는 중…</div>;
  if (!store.has) return <Setup />;
  if (!session.player || !store.s.players.includes(session.player)) return <PlayerSelect />;

  // 조종 캐릭터 정리
  const active = activeCharacter();
  if (session.activeCharacterId && (!active || active.owner !== session.player)) {
    const mine = myCharacters()[0];
    queueMicrotask(() => sessionStore.update({ activeCharacterId: mine?.id ?? null }));
  }

  const tab = session.tab;

  return (
    <div className="app">
      <LeftColumn />
      <main className="col-center">
        <MainView visible={tab === 'main'} />
        {tab === 'characters' && <CharactersView />}
        {tab === 'storage' && <StorageHub />}
        {tab === 'chat' && <RpLogView />}
        {tab === 'settings' && <SettingsView />}
      </main>
      <RightColumn />
      <Toasts />
    </div>
  );
}
