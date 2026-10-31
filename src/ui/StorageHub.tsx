import { sessionStore, useSession } from '../game/store';
import { CraftingView } from './CraftingView';
import { StorageView } from './StorageView';

export function StorageHub() {
  const session = useSession();
  return (
    <div>
      <div className="seg">
        <button className={session.storageSub === 'items' ? 'active' : ''} onClick={() => sessionStore.update({ storageSub: 'items' })}>
          ▤ 물품
        </button>
        <button className={session.storageSub === 'craft' ? 'active' : ''} onClick={() => sessionStore.update({ storageSub: 'craft' })}>
          ⚒ 제작
        </button>
      </div>
      {session.storageSub === 'items' ? <StorageView /> : <CraftingView />}
    </div>
  );
}
