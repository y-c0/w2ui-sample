const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- 都道府県マスタ ---
const prefectures = [
  { code: '01', name: '北海道' }, { code: '02', name: '青森県' }, { code: '03', name: '岩手県' },
  { code: '04', name: '宮城県' }, { code: '05', name: '秋田県' }, { code: '06', name: '山形県' },
  { code: '07', name: '福島県' }, { code: '08', name: '茨城県' }, { code: '09', name: '栃木県' },
  { code: '10', name: '群馬県' }, { code: '11', name: '埼玉県' }, { code: '12', name: '千葉県' },
  { code: '13', name: '東京都' }, { code: '14', name: '神奈川県' }, { code: '15', name: '新潟県' },
  { code: '16', name: '富山県' }, { code: '17', name: '石川県' }, { code: '18', name: '福井県' },
  { code: '19', name: '山梨県' }, { code: '20', name: '長野県' }, { code: '21', name: '岐阜県' },
  { code: '22', name: '静岡県' }, { code: '23', name: '愛知県' }, { code: '24', name: '三重県' },
  { code: '25', name: '滋賀県' }, { code: '26', name: '京都府' }, { code: '27', name: '大阪府' },
  { code: '28', name: '兵庫県' }, { code: '29', name: '奈良県' }, { code: '30', name: '和歌山県' },
  { code: '31', name: '鳥取県' }, { code: '32', name: '島根県' }, { code: '33', name: '岡山県' },
  { code: '34', name: '広島県' }, { code: '35', name: '山口県' }, { code: '36', name: '徳島県' },
  { code: '37', name: '香川県' }, { code: '38', name: '愛媛県' }, { code: '39', name: '高知県' },
  { code: '40', name: '福岡県' }, { code: '41', name: '佐賀県' }, { code: '42', name: '長崎県' },
  { code: '43', name: '熊本県' }, { code: '44', name: '大分県' }, { code: '45', name: '宮崎県' },
  { code: '46', name: '鹿児島県' }, { code: '47', name: '沖縄県' }
];

// --- 店舗データ（インメモリ） ---
let stores = [
  { id: 1, name: '渋谷本店', pref_code: '13' },
  { id: 2, name: '大阪支店', pref_code: '27' },
  { id: 3, name: '福岡支店', pref_code: '40' },
  { id: 4, name: '札幌支店', pref_code: '01' },
  { id: 5, name: '仙台支店', pref_code: '04' },
  { id: 6, name: '横浜支店', pref_code: '14' },
  { id: 7, name: '名古屋支店', pref_code: '23' },
  { id: 8, name: '京都支店', pref_code: '26' },
  { id: 9, name: '神戸支店', pref_code: '28' },
  { id: 10, name: '広島支店', pref_code: '34' },
  { id: 11, name: '那覇支店', pref_code: '47' },
  { id: 12, name: '金沢支店', pref_code: '17' }
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

app.get('/api/prefectures', (req, res) => {
  res.json({ prefectures });
});

// デバッグ/動作確認用（グリッドからは使用しない。フィルタ・ページングなしの全件）
app.get('/api/stores', (req, res) => {
  res.json({ stores });
});

// w2ui グリッドのリモートデータソース用エンドポイント
// リクエスト形式(w2ui既定の dataType: 'HTTPJSON'): GET + クエリパラメータ request=<JSONエンコード文字列>
//   { limit, offset, search: [{field,type,operator,value}], sort: [{field,direction}], favorite_only }
// レスポンス形式(w2uiが期待する形): { status: 'success', total, records: [{recid, id, name, pref_code, favorite}] }
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

  let result = stores.map((s) => ({ ...s, favorite: favSet.has(s.id) }));

  if (favorite_only) {
    result = result.filter((s) => s.favorite);
  }

  search.forEach((cond) => {
    const value = String(cond.value || '').toLowerCase();
    if (!value) return;
    if (cond.field === 'name') {
      result = result.filter((s) => {
        const name = s.name.toLowerCase();
        return cond.operator === 'contains' ? name.includes(value) : name.startsWith(value);
      });
    } else if (cond.field === 'pref_code') {
      result = result.filter((s) => s.pref_code === cond.value);
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
  const paged = result.slice(offset, offset + limit).map((s) => ({ ...s, recid: s.id }));

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
    if (!item.name || !item.pref_code) {
      return res.status(400).json({ error: '店舗名と都道府県は必須です' });
    }
  }

  incoming.forEach((item) => {
    if (!item.id) {
      // 新規登録: サーバ側で採番
      stores.push({ id: nextId++, name: item.name, pref_code: item.pref_code });
    } else {
      // 既存行の更新
      const existing = stores.find((s) => s.id === item.id);
      if (existing) {
        existing.name = item.name;
        existing.pref_code = item.pref_code;
      }
    }
  });

  res.json({ stores });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
