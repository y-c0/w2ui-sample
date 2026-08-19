// --- API エンドポイント ---
const API_REGIONS = '/api/regions';
const API_CVS_LOCATIONS = '/api/cvs_locations';
const API_CVS_CHAINS = '/api/cvs_chains';
const API_STORES = '/api/stores';
const API_STORES_SEARCH = '/api/stores/search';
const API_FAVORITES = '/api/favorites';

// 本来は Spring Boot 側の認証(ログインユーザー)から取得する値。
// ここではモックとして固定IDを全リクエストのヘッダに載せる。
const CURRENT_USER_ID = 'user1';

let grid;
let regions = [];       // 都道府県マスタ { cd_region, nm_region }
let locations = [];     // 立地マスタ { cd_cvs_location, nm_cvs_location }
let chains = [];        // チェーンマスタ { cd_cvs_chain, nm_cvs_chain }
let editingRecid = null;   // 現在編集中の行の recid（null=編集中の行なし）
let newRowSeq = 0;         // 未登録行の recid 採番用（負数にして既存IDと衝突しないようにする）

// ポップアップを呼び出す側は、URLクエリパラメータ ?store_id=<店舗ID> を付けて開くことで
// 「その店舗を選択した状態」で表示できる（例: stores.html?store_id=3）。
// 指定店舗はお気に入り以外の可能性があるため、指定時は「お気に入りのみ表示」を外して
// 全件対象で検索する。ただしページングにより1ページ目に対象店舗が含まれていない場合は、
// 無理に探しにいかず未選択のままにする。
const initialStoreId = (() => {
  const raw = new URLSearchParams(location.search).get('store_id');
  const n = Number(raw);
  return raw != null && raw !== '' && Number.isFinite(n) ? n : null;
})();
let initialSelectionPending = initialStoreId !== null; // 初回ロード時に1回だけ選択・絞り込み解除を行うためのフラグ

function escapeHtml(str) {
  return String(str == null ? '' : str).replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

// select/input から呼ばれ、編集中データをレコードに反映するだけ（w2ui の再描画はしない＝入力中のフォーカス維持のため）
function updateField(recid, field, value) {
  const rec = grid.records.find((r) => r.recid === recid);
  if (rec) rec[field] = value;
}

// 行追加・編集した行は、登録するまで背景色を変えてわかりやすくする
const DIRTY_ROW_STYLE = 'background-color: #fff3cd;';

function markDirty(recid) {
  const rec = grid.records.find((r) => r.recid === recid);
  if (rec) rec.w2ui = Object.assign({}, rec.w2ui, { style: DIRTY_ROW_STYLE });
}

function isDirty(rec) {
  return !!(rec.w2ui && rec.w2ui.style === DIRTY_ROW_STYLE);
}

// 編集中の行、または完了はしたがまだ登録していない行（背景色付き）が
// 1つでもあれば「未保存の変更あり」とする。ポップアップのOK/キャンセルの判定に使う。
function hasUnsavedChanges() {
  return editingRecid !== null || grid.records.some(isDirty);
}

function startEdit(recid) {
  if (editingRecid !== null && editingRecid !== recid) {
    alert('編集中の行があります。先に「完了」を押してください。');
    return;
  }
  editingRecid = recid;
  markDirty(recid);
  grid.refresh();
}

function finishEdit(recid) {
  const rec = grid.records.find((r) => r.recid === recid);
  if (!rec.nm_cvs_store || !rec.cd_region || !rec.cd_cvs_location || !rec.cd_cvs_chain) {
    alert('店舗名・都道府県・立地・チェーンを入力してください。');
    return;
  }
  editingRecid = null;
  grid.refresh();
}

// 編集中/行追加中に検索・リロード・ソート・お気に入り絞り込み変更をしようとした場合の確認。
// 続行してよければ編集状態をリセットして true、キャンセルなら何もせず false を返す。
// （リロードすると、行追加でまだ登録していない行や、途中まで直した編集内容は失われる）
function confirmResetEdit() {
  if (editingRecid === null) return true;
  if (!confirm('編集中の状態をリセットします。よろしいですか？')) return false;
  editingRecid = null;
  return true;
}

// お気に入りチェックボックスは編集モードと独立して、クリックした瞬間に即保存する
function toggleFavorite(storeId, checked) {
  fetch(`${API_FAVORITES}/${storeId}`, {
    method: checked ? 'POST' : 'DELETE',
    headers: { 'X-User-Id': CURRENT_USER_ID }
  })
    .then((res) => {
      if (!res.ok) throw new Error('サーバエラー');
      const rec = grid.records.find((r) => r.id_cvs_store === storeId);
      if (rec) rec.favorite = checked;
      // 「お気に入りのみ表示」中に外した場合は一覧から消えるようにリロードする
      if (!checked && $('#chk-favorite-only').is(':checked')) {
        grid.reload();
      }
    })
    .catch((err) => {
      alert('お気に入りの更新に失敗しました: ' + err.message);
      grid.refresh(); // チェックボックスの見た目を元の状態に戻す
    });
}

// 都道府県・立地・チェーンはいずれも「マスタから選択するプルダウン列」という同じ形なので、
// 列定義を共通のファクトリ関数で生成する（コード/名称のペアをマスタ配列から解決する）
function makeMasterSelectColumn(idField, nameField, text, size, getMaster) {
  return {
    field: idField, text, size, sortable: true,
    render: (record) => {
      if (record.recid === editingRecid) {
        const opts = ['<option value="">選択してください</option>']
          .concat(getMaster().map((m) =>
            `<option value="${m[idField]}" ${m[idField] === record[idField] ? 'selected' : ''}>${escapeHtml(m[nameField])}</option>`
          )).join('');
        return `<select class="edit-select" onchange="updateField(${record.recid},'${idField}',this.value)">${opts}</select>`;
      }
      const m = getMaster().find((x) => x[idField] === record[idField]);
      return escapeHtml(m ? m[nameField] : '');
    }
  };
}

const columns = [
  {
    field: 'favorite', text: 'お気に入り', size: '90px', sortable: true,
    render: (record) => (
      `<input type="checkbox" ${record.favorite ? 'checked' : ''} ${record.id_cvs_store ? '' : 'disabled'}
         onchange="toggleFavorite(${record.id_cvs_store}, this.checked)">`
    )
  },
  {
    field: 'id_cvs_store', text: '店舗ID', size: '90px', sortable: true,
    render: (record) => (record.id_cvs_store ? record.id_cvs_store : '<span class="new-badge">(未登録)</span>')
  },
  {
    field: 'nm_cvs_store', text: '店舗名', size: '22%', sortable: true, searchable: true,
    render: (record) => {
      if (record.recid === editingRecid) {
        return `<input type="text" class="edit-input" value="${escapeHtml(record.nm_cvs_store)}"
                  oninput="updateField(${record.recid},'nm_cvs_store',this.value)">`;
      }
      return escapeHtml(record.nm_cvs_store);
    }
  },
  makeMasterSelectColumn('cd_region', 'nm_region', '都道府県', '18%', () => regions),
  makeMasterSelectColumn('cd_cvs_location', 'nm_cvs_location', '立地', '15%', () => locations),
  makeMasterSelectColumn('cd_cvs_chain', 'nm_cvs_chain', 'チェーン', '15%', () => chains),
  {
    field: 'actions', text: '', size: '100px',
    render: (record) => (
      record.recid === editingRecid
        ? `<button class="btn-done" onclick="finishEdit(${record.recid})">完了</button>`
        : `<button class="btn-edit" onclick="startEdit(${record.recid})">編集</button>`
    )
  }
];

function addRow() {
  if (editingRecid !== null) {
    alert('編集中の行があります。先に「完了」を押してください。');
    return;
  }
  newRowSeq -= 1;
  const recid = newRowSeq; // 負数なのでサーバ採番済みIDと衝突しない
  grid.records.unshift({
    recid, id_cvs_store: null, nm_cvs_store: '', cd_region: '', cd_cvs_location: '', cd_cvs_chain: '',
    favorite: false, w2ui: { style: DIRTY_ROW_STYLE }
  });
  editingRecid = recid;
  grid.refresh();
}

function submitAll() {
  if (editingRecid !== null) {
    alert('編集中の行があります。先に「完了」を押してください。');
    return;
  }

  // 行追加・編集で背景色がついている行（=まだ登録していない変更）だけを登録対象にする
  const dirtyRecords = grid.records.filter(isDirty);
  if (dirtyRecords.length === 0) {
    alert('更新内容がありません。');
    return;
  }

  for (const r of dirtyRecords) {
    if (!r.nm_cvs_store || !r.cd_region || !r.cd_cvs_location || !r.cd_cvs_chain) {
      alert('未入力の項目がある行があります。');
      return;
    }
  }

  const payload = {
    stores: dirtyRecords.map((r) => ({
      id_cvs_store: r.id_cvs_store,
      nm_cvs_store: r.nm_cvs_store,
      cd_region: r.cd_region,
      cd_cvs_location: r.cd_cvs_location,
      cd_cvs_chain: r.cd_cvs_chain
    }))
  };

  fetch(API_STORES, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then((res) => {
      if (!res.ok) throw new Error('サーバエラー');
      return res.json();
    })
    .then(() => {
      editingRecid = null;
      grid.reload(); // ページング/検索/お気に入り条件を維持したままサーバから最新状態を取り直す
      alert('登録しました。');
    })
    .catch((err) => alert('送信に失敗しました: ' + err.message));
}

// ポップアップとして組み込まれた際の結果表示用（単体動作確認用のデフォルト表示）
function showPopupResult(text) {
  $('#popup-result').text(text);
}

// OK: 選択中の1行を呼び出し元に返す。画面遷移・後処理は組込側で行う（ここでは行わない）。
function handleOk() {
  if (hasUnsavedChanges()) {
    alert('保存していない変更があります。「完了」と「登録」を行ってから選択してください。');
    return;
  }

  const selectedRecids = grid.getSelection();
  const recid = selectedRecids.length ? selectedRecids[0] : null;
  const record = recid != null ? grid.records.find((r) => r.recid === recid) : null;

  if (typeof window.onStoreSelect === 'function') {
    window.onStoreSelect(record);
  } else {
    console.log('[popup] onStoreSelect is not implemented. selected record =', record);
  }
  showPopupResult(record ? `選択: ${record.nm_cvs_store} (ID: ${record.id_cvs_store})` : '選択: なし');
}

// キャンセル: 店舗を選択せずに閉じる。未保存の変更があれば確認の上で破棄する。
function handleCancel() {
  if (hasUnsavedChanges()) {
    if (!confirm('保存していない変更があります。破棄してよろしいですか？')) {
      return; // 編集を続ける
    }
    editingRecid = null;
    grid.reload(); // 未登録の追加行・編集中の変更を破棄し、サーバの最新状態に戻す
  }

  if (typeof window.onStoreCancel === 'function') {
    window.onStoreCancel();
  } else {
    console.log('[popup] onStoreCancel is not implemented.');
  }
  showPopupResult('キャンセルされました');
}

$(function () {
  Promise.all([
    fetch(API_REGIONS).then((r) => r.json()),
    fetch(API_CVS_LOCATIONS).then((r) => r.json()),
    fetch(API_CVS_CHAINS).then((r) => r.json())
  ]).then(([regionRes, locationRes, chainRes]) => {
    regions = regionRes.regions;
    locations = locationRes.locations;
    chains = chainRes.chains;

    // store_id指定時は、お気に入り以外の店舗である可能性があるため「お気に入りのみ」を外す。
    // 表示中のチェックボックスの見た目も実際の検索条件に合わせておく。
    $('#chk-favorite-only').prop('checked', initialStoreId === null);

    $('#grid').w2grid({
      name: 'grid',
      header: '店舗一覧',
      url: API_STORES_SEARCH,
      httpHeaders: { 'X-User-Id': CURRENT_USER_ID },
      // 初期表示はお気に入りのみ。ただしstore_id指定時はお気に入りに絞らず全件を対象に検索する
      // （指定店舗がお気に入り以外の可能性があるため）
      postData: { favorite_only: initialStoreId === null },
      limit: 5,
      show: { header: false, toolbar: true, toolbarSearch: true, footer: true, lineNumbers: false },
      columns: columns,
      selectType: 'row',   // 行クリックで選択（OKボタンで使う）
      multiSelect: false,  // ポップアップの選択は1件のみ
      // グリッド内蔵の検索(検索ボックス/Enter)・リロードボタン・列ヘッダでのソートは、
      // 編集中/行追加中だと矛盾した状態になるため、確認の上でリセットしてから実行する
      onSearch: function (event) {
        if (event.phase !== 'before') return;
        if (!confirmResetEdit()) event.preventDefault();
      },
      onReload: function (event) {
        if (event.phase !== 'before') return;
        if (!confirmResetEdit()) event.preventDefault();
      },
      onSort: function (event) {
        if (event.phase !== 'before') return;
        if (!confirmResetEdit()) event.preventDefault();
      }
    });
    grid = w2ui.grid;

    // 初回ロード完了後、取得できた範囲（1ページ目）に対象店舗があれば選択状態にする。
    // ページングでまだ取得していない範囲にある場合は、無理に探しにいかず未選択のままでよい。
    // ('load' イベントの config オプション(onLoad)は before フェーズでしか呼ばれないため、
    //  after フェーズを拾うには on('load:after', ...) を使う必要がある)
    grid.on('load:after', function () {
      if (!initialSelectionPending) return;
      initialSelectionPending = false;
      const rec = grid.records.find((r) => r.id_cvs_store === initialStoreId);
      if (rec) grid.select(rec.recid);
    });

    $('#btn-add').on('click', addRow);
    $('#btn-submit').on('click', submitAll);
    $('#btn-ok').on('click', handleOk);
    $('#btn-cancel').on('click', handleCancel);
    $('#chk-favorite-only').on('change', function () {
      const $chk = $(this);
      if (!confirmResetEdit()) {
        $chk.prop('checked', !$chk.is(':checked')); // 確認をキャンセルしたので表示を元に戻す
        return;
      }
      grid.postData.favorite_only = $chk.is(':checked');
      grid.offset = 0;
      grid.reload();
    });
  });
});
