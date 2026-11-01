// ───────────── 공통 타입 정의 ─────────────

export type SkillId =
  | 'melee'
  | 'firearm'
  | 'scavenge'
  | 'stealth'
  | 'crafting'
  | 'cooking'
  | 'medical'
  | 'farming';

export type ItemCategory =
  | 'food'
  | 'drink'
  | 'medical'
  | 'weapon'
  | 'tool'
  | 'material'
  | 'furniture'
  | 'prop'
  | 'backpack'
  | 'clothing'
  | 'rare';

/** 몸 부위 */
export type BodyPart = 'head' | 'neck' | 'torso' | 'l_arm' | 'r_arm' | 'l_hand' | 'r_hand' | 'l_leg' | 'r_leg' | 'l_foot' | 'r_foot';

/** 착용 칸 */
export type WearSlot = 'hat' | 'top' | 'gloves' | 'bottom' | 'shoes';

/** 인벤토리 한 칸. 내구도가 있는 물건은 항상 qty 1 로 따로 보관된다. */
export interface ItemStack {
  uid: string;
  itemId: string;
  qty: number;
  durability?: number;
  /** 상한 정도(게임 시간). 아이템의 spoil 에 닿으면 상한 음식이 된다 */
  rot?: number;
}

export type InjuryType = 'scratch' | 'laceration' | 'bite';

export interface Injury {
  id: string;
  type: InjuryType;
  bandaged: boolean;
  /** 붕대를 감은 뒤 회복까지 남은 게임 시간(시간) */
  healHours: number;
  /** 다친 부위 */
  part?: BodyPart;
  /** 소독했는지 */
  disinfected?: boolean;
  /** 천 조각 같은 더러운 붕대 */
  dirtyBandage?: boolean;
}

export interface Appearance {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
}

export interface Relation {
  targetId: string;
  /** 오너가 직접 적는 관계 설명 (예: 소꿉친구, 앙숙) */
  text: string;
  /** 호감도 0~100. 같이 지내고 돕고 함께 겪을수록 오른다 */
  bond?: number;
}

export type CharacterStatus = 'base' | 'expedition' | 'moving' | 'away' | 'down' | 'dead';

export type BaseTask = 'free' | 'rest' | 'farm' | 'water' | 'guard' | 'workshop';

export interface MoveState {
  /** 들어가 살 거점 (있으면) */
  toBaseId?: string;
  /** 새로 자리 잡을 빈 집 후보 번호 */
  toStarter?: number;
  fromBaseId: string;
  /** 도착 시각(ms) */
  arriveAt: number;
  startedAt: number;
  items: ItemStack[];
  vehicle: ItemStack | null;
}

export interface ErrandState {
  baseId: string;
  /** 그 거점에 도착하는 시각(ms) / 집에 돌아오는 시각(ms) */
  arriveAt: number;
  returnAt: number;
  startedAt: number;
  /** 갖다줄 것 (도착하면 그 거점 창고로) */
  give: ItemStack[];
  /** 가져올 것 (출발할 때 그 거점 창고에서 맡아 두고, 돌아오면 집 창고로) */
  take: ItemStack[];
  delivered: boolean;
  vehicle: ItemStack | null;
}

export interface TradeOffer {
  reqId: string;
  items: { uid: string; qty: number; src: 'inv' | 'storage' }[];
  ready: boolean;
}

export type RequestKind = 'trade' | 'heal' | 'party';
/** 캐릭터 사이의 요청 (교환 · 치료 · 파티 초대) */
export interface SocialRequest {
  id: string;
  kind: RequestKind;
  from: string;
  to: string;
  /** 요청한 실제 시각(ms) */
  at: number;
  status: 'pending' | 'accepted' | 'declined' | 'done' | 'cancelled';
}

export interface TimedEffect {
  id: string;
  /** 사라지는 게임 시각(분) */
  until: number;
  /** 생긴 이유 */
  source: string;
}

/** 일기 한 장 (하루가 지나면 자동으로 쓰인다) */
export interface DiaryEntry {
  day: number;
  text: string;
  /** 오너가 덧붙인 한 줄 */
  note?: string;
}

export type MemoryKind = 'trauma' | 'resolve' | 'joy' | 'loss' | 'goal' | 'bond';
export interface Memory {
  t: number;
  kind: MemoryKind;
  text: string;
  locationId?: string;
}

/** 캐릭터가 품은 목표 (탐색 중 단서를 모은다) */
export interface PersonalGoal {
  text: string;
  /** 모은 단서 (3개면 목적지가 드러난다) */
  clues: number;
  /** 단서가 가리키는 장소 */
  target?: string;
  done?: boolean;
  /** 지금까지 찾은 단서 내용 */
  notes: string[];
}

export interface Character {
  id: string;
  /** 특성 (data/traits). undefined 면 아직 고르지 않았다 */
  traits?: string[];
  /** 읽은 책 */
  readBooks?: string[];
  /** 성장형 특성: 받지 않기로 한 것 */
  declined?: string[];
  /** 거점에 합류한 NPC 생존자 (누구나 조종할 수 있다) */
  npc?: boolean;
  /** NPC: 굶주린 채 버틴 시간(시간). 오래되면 떠난다 */
  grudge?: number;
  /** 오늘 있었던 일 (하루가 지나면 일기로) */
  today?: string[];
  diary?: DiaryEntry[];
  memories?: Memory[];
  /** 트라우마: 장소 id → 극복까지 남은 횟수 */
  fears?: Record<string, number>;
  goal?: PersonalGoal;
  name: string;
  owner: string;
  job: string;
  age: string;
  bio: string;
  appearance: Appearance;
  /** 직접 올린 도트 캐릭터 이미지 (PNG data URL) */
  sprite?: string;
  /** 사는 거점 */
  homeId: string;
  /** 이사 중 (짐을 들고 새 집으로 가는 중) */
  move?: MoveState;
  /** 심부름 중 (다른 거점에 물건을 가져오거나 갖다주러 다녀오는 중) */
  errand?: ErrandState;
  /** 파티 (같은 값이면 같은 파티) */
  partyId?: string;
  /** 교환 창에 올려 둔 물건 */
  offer?: TradeOffer;
  /** 진행 중인 제작 (실시간). 재료는 하나 만들 때마다 그때 쓴다 */
  crafting?: { recipeId: string; total: number; done: number; itemStart: number; itemEnd: number };
  /** 이 게임 시각(분)까지 잔다. 직접 재운다 */
  sleepUntil?: number;
  /** 잠들기 시작한 게임 시각 */
  sleepStart?: number;
  /** 시간이 지나면 사라지는 버프·디버프 */
  effects?: TimedEffect[];
  health: number; // 0~100
  hunger: number; // 포만감 100=배부름
  thirst: number; // 수분 100=충분
  energy: number; // 기력 100=쌩쌩
  infection: number; // 0~100
  injuries: Injury[];
  skills: Record<SkillId, number>; // 경험치
  weapon: ItemStack | null;
  /** 착용 중인 옷 */
  wear?: Partial<Record<WearSlot, ItemStack>>;
  backpack: ItemStack | null;
  inventory: ItemStack[];
  status: CharacterStatus;
  permadeathAllowed: boolean;
  relations: Relation[];
  journal: string;
  task: BaseTask;
  /** 거점 내 위치(타일) */
  pos: { x: number; y: number };
  createdAt: number;
  stats: { expeditions: number; kills: number; crafted: number; downs?: number };
}

// ───────────── 거점 ─────────────

export interface PlacedFurniture {
  uid: string;
  itemId: string;
  x: number;
  y: number;
  rot: 0 | 1 | 2 | 3;
  ownerId?: string;
  /** 위에 올려둔 소품 / 진열품 (아이템 id) */
  props: string[];
  /** 보관함 내용물 */
  items?: ItemStack[];
  /** 발전기 연료 (남은 시간) */
  fuel?: number;
  /** 생산 시설 상태 */
  prod?: {
    lastTick: number; // 실제 시간(ms)
    progress: number; // 0~1
    stored: number;
    planted?: boolean;
    /** 심은 씨앗이 자라 나오는 작물 */
    crop?: string;
  };
}

export interface BaseState {
  id: string;
  /** 거점 이름 (예: 한서윤의 옥탑방) */
  name: string;
  /** 지도 위 집 후보 번호 (cityGen starters) */
  starter: number;
  /** 이 거점의 창고 */
  storage: ItemStack[];
  width: number;
  height: number;
  /** 바닥 종류 id. '' 는 바깥 흙/풀 */
  floor: string[];
  /** 벽 종류 id. '' 는 벽 없음. 'door_*' 는 문 */
  walls: string[];
  /** 벽 방향: '' 자동(방에 맞춰) · 'x' ↘ 방향 한 장 · 'y' ↙ 방향 한 장 */
  wallDir?: string[];
  furniture: PlacedFurniture[];
  /** 평판 (습격을 막거나 사람을 받아들이면 오른다) */
  rep?: number;
  /** 거점 확장 레벨 (확장 가능 영역) */
  claimed: { x0: number; y0: number; x1: number; y1: number };
}

// ───────────── 탐험 ─────────────

export interface SpotState {
  remaining: number;
  searched: number;
}

export interface ZoneState {
  unlocked: boolean;
  spots: Record<string, SpotState>;
  secretFound: boolean;
  /** 우두머리(거구 감염자)를 쓰러뜨렸다 */
  bossDown?: boolean;
}

export interface LocationState {
  discovered: boolean;
  visits: number;
  zones: Record<string, ZoneState>;
  notes: string[];
  /** 일시적 장소(보급 투하)의 만료 게임시간 */
  expiresAt?: number;
}

export interface Zombie {
  id: string;
  hp: number;
  maxHp: number;
  kind: 'walker' | 'runner' | 'bloated' | 'brute' | 'screamer';
  staggered: boolean;
}

export interface Encounter {
  zombies: Zombie[];
  engaged: boolean; // 아직 들키지 않았으면 false (숨기 가능)
}

export interface FoundLoot {
  spotId: string;
  items: ItemStack[];
}

export interface Expedition {
  characterId: string;
  locationId: string;
  zoneId: string;
  noise: number;
  encounter: Encounter | null;
  found: FoundLoot | null;
  log: { t: number; text: string; kind?: 'good' | 'bad' | 'info' }[];
  startedAt: number;
  /** 직접 탐사(눌러서 진행) / 장기 탐사(자동, 정해진 시간 뒤 귀환) */
  mode: 'manual' | 'auto';
  /** 가는 중 / 현장 / 돌아오는 중 */
  phase: 'going' | 'there' | 'returning';
  /** 지금 단계가 끝나는 실제 시각(ms). 현장 단계는 장기 탐사에서만 쓴다 */
  phaseEnds: number;
  /** 편도 이동에 걸리는 실제 시간(ms) */
  travelMs: number;
  /** 타고 간 이동수단 */
  vehicle: ItemStack | null;
  /** 장기 탐사: 다음 자동 수색 시각(ms) */
  autoNext?: number;
  /** 장기 탐사: 현장에 머무를 시간(시간) */
  autoHours?: number;
}

// ───────────── 역극 ─────────────

export type RpKind = 'say' | 'action' | 'ooc' | 'system' | 'letter';

export interface RpMessage {
  id: string;
  t: number; // 게임 시간
  real: number; // 실제 시간
  kind: RpKind;
  characterId?: string;
  targetId?: string;
  owner: string;
  text: string;
  /** 감정 표현 이모지 (말풍선으로 크게) */
  emote?: string;
  /** 상호작용 동작 (안아 주기 등): 거점 화면에서 둘이 다가간다 */
  anim?: 'hug' | 'highfive' | 'comfort' | 'sit';
  /** 편지가 도착하는 실제 시각(ms). 다른 거점으로 보낸 편지는 시간이 걸린다 */
  deliverAt?: number;
}

// ───────────── 전체 상태 ─────────────

export interface NewsItem {
  t: number;
  text: string;
  kind?: 'good' | 'bad' | 'info';
  /** 모두에게 알릴 소식이면 알림 제목 (같이 사는 친구 화면에도 알림이 뜬다) */
  alert?: string;
}

export type WeatherKind = 'clear' | 'cloudy' | 'rain' | 'storm' | 'fog' | 'heat' | 'cold';

export interface GameEvent {
  id: string;
  kind: string;
  /** 사건이 벌어진 거점 */
  baseId: string;
  /** 시작한 실제 시각(ms) · 투표 마감(ms) */
  at: number;
  expiresAt: number;
  /** 사건에 휘말린 캐릭터들 */
  cast?: string[];
  /** 정해진 결과 (정해지면 잠깐 보여 주고 사라진다) */
  result?: string;
  chosen?: string;
  resolvedAt?: number;
}

export interface Merchant {
  locationId: string;
  /** 떠나는 게임 시각 */
  until: number;
  stock: { itemId: string; qty: number; price: number }[];
  /** 캐릭터별로 판 물건 값 (상인이 떠나면 사라진다) */
  credit: Record<string, number>;
}

export interface Raid {
  /** 습격당하는 거점 */
  baseId: string;
  /** 거점에 닥치는 실제 시각(ms) */
  arriveAt: number;
  /** 경고가 뜬 실제 시각(ms) */
  warnedAt: number;
  size: number;
}

export interface GameState {
  version: number;
  worldName: string;
  createdAt: number;
  lastRealTime: number;
  /** 게임 시간(분) */
  time: number;
  players: string[];
  characters: Record<string, Character>;
  characterOrder: string[];
  /** 거점들. 캐릭터마다 사는 거점(homeId)이 있다 */
  bases: Record<string, BaseState>;
  /**
   * 지금 보고 있는(또는 처리 중인) 거점과 그 창고. 저장되지 않는 바로가기다.
   * 어느 거점인지는 store.ts 의 withBase / currentBaseId 가 정한다.
   */
  storage: ItemStack[];
  base: BaseState;
  locations: Record<string, LocationState>;
  expeditions: Record<string, Expedition>;
  rpLog: RpMessage[];
  news: NewsItem[];
  settings: {
    autoConsume: boolean;
    /** 시계 속도: real = 현실 시계와 같게, 2·4 = 배속 */
    clockMode?: 'real' | 'x2' | 'x4';
    /** 거점 습격 빈도 */
    raids?: 'off' | 'low' | 'normal' | 'high';
    /** GM(운영자) 플레이어 이름 */
    gms?: string[];
  };
  /** 다가오는 좀비 떼 (없으면 null) */
  raid: Raid | null;
  /** 캐릭터 사이의 요청들 */
  requests: Record<string, SocialRequest>;
  /** 지금 벌어진 사건 (선택지를 투표로 고른다) */
  event: GameEvent | null;
  /** 사건 투표: 플레이어마다 따로 저장 */
  votes: Record<string, { eventId: string; player: string; option: string }>;
  /** 지도 위 유랑 상인 (없으면 null) */
  merchant: Merchant | null;
  /** 세력과의 관계 (-100 ~ 100) */
  factions: Record<string, number>;
  /** 지금 날씨와 바뀌는 게임 시각 */
  weather: { kind: WeatherKind; until: number };
  /** 실시간 시계 기준점: 게임 시간 = anchorGame + (지금 - anchorReal) × scale */
  clock: { anchorReal: number; anchorGame: number; scale: number };
}
