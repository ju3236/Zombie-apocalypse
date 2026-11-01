import { toast } from '../game/bus';
import { ITEMS } from '../game/data/items';
import { store } from '../game/store';
import { buyFromMerchant, buyPrice, merchantHere, sellPrice, sellToMerchant } from '../game/systems/merchant';
import type { Character } from '../game/types';
import { formatDuration } from '../game/util';
import { FreshTag, Panel } from './common';

/** 유랑 상인 노점: 들고 간 물건을 팔아 점수를 쌓고 그 점수로 산다 */
export function MerchantPanel({ c }: { c: Character }) {
  const m = merchantHere(c);
  if (!m) return null;
  const credit = m.credit[c.id] ?? 0;
  const left = Math.max(0, m.until - store.s.time);
  return (
    <Panel title="🧳 유랑 상인" className="merchant" actions={<span className="muted small">{formatDuration(left)} 뒤 떠남</span>}>
      <div className="merchant-credit">
        🪙 {c.name}의 점수 <b>{credit}</b> <span className="muted small">— 가져온 물건을 팔면 쌓인다. 상인이 떠나면 사라진다.</span>
      </div>
      <div className="merchant-grid">
        <div>
          <div className="divider small">상인의 물건</div>
          {m.stock.length === 0 && <div className="muted small">다 팔렸다.</div>}
          {m.stock.map((it, i) => {
            const p = buyPrice(c, it.price);
            return (
              <div key={it.itemId} className="mrow">
                <span>
                  {ITEMS[it.itemId]?.icon} {ITEMS[it.itemId]?.name} <span className="muted">×{it.qty}</span>
                </span>
                <button className="small" disabled={credit + 1e-6 < p} title={ITEMS[it.itemId]?.desc} onClick={() => {
                  const r = buyFromMerchant(c, i);
                  if (r) toast(r, r.includes('샀다') ? 'good' : 'bad');
                }}>
                  🪙{p} 사기
                </button>
              </div>
            );
          })}
        </div>
        <div>
          <div className="divider small">{c.name}의 짐</div>
          {c.inventory.length === 0 && <div className="muted small">팔 물건을 챙겨 오자. (출발할 때 창고에서 소지품으로)</div>}
          {c.inventory.map((st) => {
            const v = sellPrice(c, st);
            return (
              <div key={st.uid} className="mrow">
                <span>
                  {ITEMS[st.itemId]?.icon} {ITEMS[st.itemId]?.name} <span className="muted">×{st.qty}</span> <FreshTag s={st} />
                </span>
                <span className="row">
                  <button className="small" disabled={v <= 0} onClick={() => {
                    const r = sellToMerchant(c, st.uid, 1);
                    if (r) toast(r, 'bad');
                  }}>
                    팔기 +{v}
                  </button>
                  {st.qty > 1 && (
                    <button className="small ghost" disabled={v <= 0} onClick={() => {
                      const r = sellToMerchant(c, st.uid, st.qty);
                      if (r) toast(r, 'bad');
                    }}>
                      전부 +{Math.round(v * st.qty * 10) / 10}
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="muted small">💡 거점 레벨이 높거나 협상·교역 특성이 있으면 더 싸게 사고 비싸게 판다.</div>
    </Panel>
  );
}
