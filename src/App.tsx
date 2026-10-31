import { useEffect, useState } from 'react';
import { toast } from './game/bus';
import { adapter, addNews, saveNow, sessionStore, store, useGameRev, useSession } from './game/store';
import { describeReport, tickProduction } from './game/systems/time';
import { activeCharacter, myCharacters, Toasts } from './ui/common';
import { BaseView } from './ui/BaseView';
import { CharactersView } from './ui/CharactersView';
import { CraftingView } from './ui/CraftingView';
import { ExpeditionView } from './ui/ExpeditionView';
import { PlayerSelect, Setup } from './ui/Setup';
import { RpLogView } from './ui/RpLogView';
import { SettingsView } from './ui/SettingsView';
import { StorageView } from './ui/StorageView';
import { LeftColumn } from './ui/LeftColumn';
import { RightColumn } from './ui/RightColumn';
import { WorldMapView } from './ui/WorldMapView';

export default function App() {
  const [loaded, setLoaded] = useState(false);
  useGameRev();
  const session = useSession();

  useEffect(() => {
    void adapter.load().then((data) => {
      if (data) {
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
    });
    const iv = window.setInterval(() => {
      if (!store.has) return;
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
        <BaseView visible={tab === 'base'} />
        {tab === 'characters' && <CharactersView />}
        {tab === 'storage' && <StorageView />}
        {tab === 'crafting' && <CraftingView />}
        {tab === 'map' && <WorldMapView />}
        {tab === 'expedition' && <ExpeditionView />}
        {tab === 'rp' && <RpLogView />}
        {tab === 'settings' && <SettingsView />}
      </main>
      <RightColumn />
      <Toasts />
    </div>
  );
}
