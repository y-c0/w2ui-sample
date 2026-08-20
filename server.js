const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), { index: 'cvs_store.html' }));

// --- 都道府県マスタ ---
const regions = [
  { cd_region: '01', nm_region: '北海道' }, { cd_region: '02', nm_region: '青森県' }, { cd_region: '03', nm_region: '岩手県' },
  { cd_region: '04', nm_region: '宮城県' }, { cd_region: '05', nm_region: '秋田県' }, { cd_region: '06', nm_region: '山形県' },
  { cd_region: '07', nm_region: '福島県' }, { cd_region: '08', nm_region: '茨城県' }, { cd_region: '09', nm_region: '栃木県' },
  { cd_region: '10', nm_region: '群馬県' }, { cd_region: '11', nm_region: '埼玉県' }, { cd_region: '12', nm_region: '千葉県' },
  { cd_region: '13', nm_region: '東京都' }, { cd_region: '14', nm_region: '神奈川県' }, { cd_region: '15', nm_region: '新潟県' },
  { cd_region: '16', nm_region: '富山県' }, { cd_region: '17', nm_region: '石川県' }, { cd_region: '18', nm_region: '福井県' },
  { cd_region: '19', nm_region: '山梨県' }, { cd_region: '20', nm_region: '長野県' }, { cd_region: '21', nm_region: '岐阜県' },
  { cd_region: '22', nm_region: '静岡県' }, { cd_region: '23', nm_region: '愛知県' }, { cd_region: '24', nm_region: '三重県' },
  { cd_region: '25', nm_region: '滋賀県' }, { cd_region: '26', nm_region: '京都府' }, { cd_region: '27', nm_region: '大阪府' },
  { cd_region: '28', nm_region: '兵庫県' }, { cd_region: '29', nm_region: '奈良県' }, { cd_region: '30', nm_region: '和歌山県' },
  { cd_region: '31', nm_region: '鳥取県' }, { cd_region: '32', nm_region: '島根県' }, { cd_region: '33', nm_region: '岡山県' },
  { cd_region: '34', nm_region: '広島県' }, { cd_region: '35', nm_region: '山口県' }, { cd_region: '36', nm_region: '徳島県' },
  { cd_region: '37', nm_region: '香川県' }, { cd_region: '38', nm_region: '愛媛県' }, { cd_region: '39', nm_region: '高知県' },
  { cd_region: '40', nm_region: '福岡県' }, { cd_region: '41', nm_region: '佐賀県' }, { cd_region: '42', nm_region: '長崎県' },
  { cd_region: '43', nm_region: '熊本県' }, { cd_region: '44', nm_region: '大分県' }, { cd_region: '45', nm_region: '宮崎県' },
  { cd_region: '46', nm_region: '鹿児島県' }, { cd_region: '47', nm_region: '沖縄県' }
];

// --- 立地マスタ ---
const cvsLocations = [
  { cd_cvs_location: '01', nm_cvs_location: '駅前' },
  { cd_cvs_location: '02', nm_cvs_location: '繁華街' },
  { cd_cvs_location: '03', nm_cvs_location: '郊外' }
];

// --- チェーンマスタ ---
const cvsChains = [
  { cd_cvs_chain: '01', nm_cvs_chain: 'セブン-イレブン' },
  { cd_cvs_chain: '02', nm_cvs_chain: 'ローソン' },
  { cd_cvs_chain: '03', nm_cvs_chain: 'ファミリーマート' },
  { cd_cvs_chain: '04', nm_cvs_chain: 'ミニストップ' }
];

// --- 店舗データ（インメモリ） ---
let stores = [
  { id_cvs_store: 1, nm_cvs_store: '渋谷本店', cd_region: '13', cd_cvs_location: '01', cd_cvs_chain: '01' },
  { id_cvs_store: 2, nm_cvs_store: '大阪支店', cd_region: '27', cd_cvs_location: '02', cd_cvs_chain: '02' },
  { id_cvs_store: 3, nm_cvs_store: '福岡支店', cd_region: '40', cd_cvs_location: '01', cd_cvs_chain: '03' },
  { id_cvs_store: 4, nm_cvs_store: '札幌支店', cd_region: '01', cd_cvs_location: '03', cd_cvs_chain: '01' },
  { id_cvs_store: 5, nm_cvs_store: '仙台支店', cd_region: '04', cd_cvs_location: '02', cd_cvs_chain: '02' },
  { id_cvs_store: 6, nm_cvs_store: '横浜支店', cd_region: '14', cd_cvs_location: '01', cd_cvs_chain: '04' },
  { id_cvs_store: 7, nm_cvs_store: '名古屋支店', cd_region: '23', cd_cvs_location: '02', cd_cvs_chain: '01' },
  { id_cvs_store: 8, nm_cvs_store: '京都支店', cd_region: '26', cd_cvs_location: '03', cd_cvs_chain: '03' },
  { id_cvs_store: 9, nm_cvs_store: '神戸支店', cd_region: '28', cd_cvs_location: '01', cd_cvs_chain: '02' },
  { id_cvs_store: 10, nm_cvs_store: '広島支店', cd_region: '34', cd_cvs_location: '02', cd_cvs_chain: '04' },
  { id_cvs_store: 11, nm_cvs_store: '那覇支店', cd_region: '47', cd_cvs_location: '03', cd_cvs_chain: '01' },
  { id_cvs_store: 12, nm_cvs_store: '金沢支店', cd_region: '17', cd_cvs_location: '01', cd_cvs_chain: '03' }
];
let nextId = 13;

// --- お気に入り（インメモリ、ユーザーID -> 店舗IDのSet） ---
// 本番(Spring Boot)側では認証済みユーザーのIDを使う想定。このモックではヘッダで疑似指定する。
const favoritesByUser = {
  user1: new Set([1, 3])
};

function getUserId(req) {
  return req.headers['x-user-id'] || 'user1';
}

function getFavoriteSet(userId) {
  if (!favoritesByUser[userId]) favoritesByUser[userId] = new Set();
  return favoritesByUser[userId];
}

app.get('/api/regions', (req, res) => {
  res.json({ regions });
});

app.get('/api/cvs_locations', (req, res) => {
  res.json({ locations: cvsLocations });
});

app.get('/api/cvs_chains', (req, res) => {
  res.json({ chains: cvsChains });
});

// デバッグ/動作確認用（グリッドからは使用しない。フィルタ・ページングなしの全件）
app.get('/api/stores', (req, res) => {
  res.json({ stores });
});

// w2ui グリッドのリモートデータソース用エンドポイント
// リクエスト形式(w2ui既定の dataType: 'HTTPJSON'): GET + クエリパラメータ request=<JSONエンコード文字列>
//   { limit, offset, search: [{field,type,operator,value}], sort: [{field,direction}], favorite_only }
// レスポンス形式(w2uiが期待する形): { status: 'success', total, records: [{recid, id_cvs_store, nm_cvs_store, cd_region, cd_cvs_location, cd_cvs_chain, favorite}] }
app.get('/api/stores/search', (req, res) => {
  const userId = getUserId(req);
  const favSet = getFavoriteSet(userId);
  let parsed = {};
  try {
    parsed = JSON.parse(req.query.request || '{}');
  } catch (e) {
    return res.status(400).json({ status: 'error', message: 'invalid request param' });
  }
  const {
    limit = 20,
    offset = 0,
    search = [],
    sort = [],
    favorite_only = false
  } = parsed;

  let result = stores.map((s) => ({ ...s, favorite: favSet.has(s.id_cvs_store) }));

  if (favorite_only) {
    result = result.filter((s) => s.favorite);
  }

  search.forEach((cond) => {
    const value = String(cond.value || '').toLowerCase();
    if (!value) return;
    if (cond.field === 'nm_cvs_store') {
      result = result.filter((s) => {
        const name = s.nm_cvs_store.toLowerCase();
        return cond.operator === 'contains' ? name.includes(value) : name.startsWith(value);
      });
    } else if (cond.field === 'cd_region') {
      result = result.filter((s) => s.cd_region === cond.value);
    } else if (cond.field === 'cd_cvs_location') {
      result = result.filter((s) => s.cd_cvs_location === cond.value);
    } else if (cond.field === 'cd_cvs_chain') {
      result = result.filter((s) => s.cd_cvs_chain === cond.value);
    }
  });

  sort.forEach((s) => {
    result.sort((a, b) => {
      const av = a[s.field];
      const bv = b[s.field];
      const cmp = av > bv ? 1 : av < bv ? -1 : 0;
      return s.direction === 'desc' ? -cmp : cmp;
    });
  });

  const total = result.length;
  const paged = result.slice(offset, offset + limit).map((s) => ({ ...s, recid: s.id_cvs_store }));

  res.json({ status: 'success', total, records: paged });
});

// お気に入り登録/解除（クリックした瞬間に即時反映）
app.post('/api/favorites/:storeId', (req, res) => {
  const userId = getUserId(req);
  getFavoriteSet(userId).add(Number(req.params.storeId));
  res.json({ status: 'success' });
});

app.delete('/api/favorites/:storeId', (req, res) => {
  const userId = getUserId(req);
  getFavoriteSet(userId).delete(Number(req.params.storeId));
  res.json({ status: 'success' });
});

// 編集/追加された行をまとめて受け取り、新規行にはサーバ側でIDを採番する
app.post('/api/stores', (req, res) => {
  const incoming = (req.body && req.body.stores) || [];

  for (const item of incoming) {
    if (!item.nm_cvs_store || !item.cd_region || !item.cd_cvs_location || !item.cd_cvs_chain) {
      return res.status(400).json({ error: '店舗名・都道府県・立地・チェーンは必須です' });
    }
  }

  incoming.forEach((item) => {
    if (!item.id_cvs_store) {
      // 新規登録: サーバ側で採番
      stores.push({
        id_cvs_store: nextId++,
        nm_cvs_store: item.nm_cvs_store,
        cd_region: item.cd_region,
        cd_cvs_location: item.cd_cvs_location,
        cd_cvs_chain: item.cd_cvs_chain
      });
    } else {
      // 既存行の更新
      const existing = stores.find((s) => s.id_cvs_store === item.id_cvs_store);
      if (existing) {
        existing.nm_cvs_store = item.nm_cvs_store;
        existing.cd_region = item.cd_region;
        existing.cd_cvs_location = item.cd_cvs_location;
        existing.cd_cvs_chain = item.cd_cvs_chain;
      }
    }
  });

  res.json({ stores });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
