import { useEffect, useState } from 'react';
import { controls } from './game/homes';
import { bus, toast } from './game/bus';
import { notify } from './game/notify';
import { adapter, addNews, saveNow, sessionStore, store, useGameRev, useSession } from './game/store';
import { describeReport, tickProduction } from './game/systems/time';
import { syncWorld } from './game/newGame';
import { isTicker, loadConfig, resumeOnline, useOnline } from './game/online';
import { useAuth } from './game/auth';
import { AuthScreen, HUB_SKIP, isLocalOnly, pendingJoin, WorldHub } from './ui/Account';
import { runRealtime } from './game/systems/realtime';
import { activeCharacter, myCharacters, Toasts } from './ui/common';
import { CharactersView } from './ui/CharactersView';
import { PlayerSelect, Setup } from './ui/Setup';
import { RpLogView } from './ui/RpLogView';
import { SettingsView } from './ui/SettingsView';
import { GmView } from './ui/GmView';
import { LeftColumn } from './ui/LeftColumn';
import { MainView, TopTabs } from './ui/MainView';
import { StorageHub } from './ui/StorageHub';
import { RightColumn } from './ui/RightColumn';
import { MobileNav, MobileTop } from './ui/Mobile';
import { RequestCenter } from './ui/Social';

export default function App() {
  const [loaded, setLoaded] = useState(false);
  useGameRev();
  const session = useSession();
  const auth = useAuth();
  const online = useOnline();

  useEffect(() => {
    void adapter.load().then((data) => {
      if (data) {
        syncWorld(data);
        store.set(data);
        // 자리를 비운 동안 흐른 시간과 탐험 진행
        runRealtime();
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
    let n = 0;
    const iv = window.setInterval(() => {
      if (!store.has) return;
      // 실시간 시계와 탐험 (5초마다)
      let changed = runRealtime();
      // 같이 살기 중이면 생산 시계는 한 사람만 돌린다 (15초마다)
      if (++n % 3 === 0 && isTicker()) {
        const r = tickProduction();
        const txt = describeReport(r);
        if (txt) toast(`생산 완료: ${txt}`, 'good');
        changed = true;
      }
      if (changed) store.commit();
    }, 5000);
    // 알림: 내 캐릭터 일이거나 모두에게 해당하는 일만
    const offAlert = bus.on('alert', (a) => {
      if (a.characterId && store.has && !controls(store.s.characters[a.characterId], sessionStore.get().player)) return;
      notify(a.title, a.text, a.kind);
    });
    const onUnload = () => saveNow();
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.clearInterval(iv);
      offAlert();
      window.removeEventListener('beforeunload', onUnload);
    };
  }, []);

  if (!loaded || !auth.ready) return <div className="loading">불러오는 중…</div>;
  // 계정: 로그인 → 내 월드 → 게임
  const cfg = loadConfig();
  if (!auth.user) {
    if (!isLocalOnly() || pendingJoin() || cfg?.account) return <AuthScreen />;
  } else if (cfg?.account) {
    if (!store.has) return online.status === 'error' ? <WorldHub error={online.statusMsg} /> : <div className="loading">월드 불러오는 중…</div>;
    if (auth.name && session.player !== auth.name) queueMicrotask(() => sessionStore.update({ player: auth.name }));
    if (auth.name && !store.s.players.includes(auth.name)) {
      store.s.players.push(auth.name);
      queueMicrotask(() => store.commit());
    }
  } else if (pendingJoin() || !sessionStorage.getItem(HUB_SKIP)) return <WorldHub />;
  if (!store.has) return <Setup />;
  if (cfg?.account && auth.user) {
    if (!session.player) return <div className="loading">월드 불러오는 중…</div>;
  } else if (!session.player || !store.s.players.includes(session.player)) return <PlayerSelect />;

  // 조종 캐릭터 정리
  const active = activeCharacter();
  if (session.activeCharacterId && (!active || !controls(active, session.player))) {
    const mine = myCharacters()[0];
    queueMicrotask(() => sessionStore.update({ activeCharacterId: mine?.id ?? null }));
  }

  const tab = session.tab;

  return (
    <div className={`app pane-${session.pane ?? 'center'}`}>
      <LeftColumn />
      <main className="col-center">
        <MobileTop />
        {(tab === 'main' || tab === 'characters' || tab === 'storage' || tab === 'gm') && <TopTabs />}
        <MainView visible={tab === 'main'} />
        {tab === 'characters' && <CharactersView />}
        {tab === 'storage' && <StorageHub />}
        {tab === 'chat' && <RpLogView />}
        {tab === 'settings' && <SettingsView />}
        {tab === 'gm' && <GmView />}
      </main>
      <RightColumn />
      <MobileNav />
      <RequestCenter />
      <Toasts />
    </div>
  );
}
