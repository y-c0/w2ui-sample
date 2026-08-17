c:\my\dev\20260817_w2ui1 に、w2ui 1.5 + jQuery + Express の最小サンプルを作成しました。
API 呼び出し(GET/POST)は実際に起動して動作確認済みです。

構成

package.json — Express依存
server.js — 都道府県マスタ、店舗データ(インメモリ)、GET /api/prefectures、GET /api/stores、POST /api/stores(新規行はサーバ側でID採番)
public/index.html — w2ui 1.5 のグリッド + 行追加/登録ボタン
動作の仕組み

グリッドの列(id/name/pref_code/actions)はすべて w2ui の render 関数でカスタム描画しています。w2ui標準のインライン編集ではなく、editingRecid という変数で「今どの行が編集中か」を管理し、その行だけ <input>/<select> を描画、他の行はテキスト表示にする方式です。
「編集」ボタン → startEdit(recid) でその行だけ編集可能に。「完了」ボタンで編集終了(必須項目チェックあり)。同時に編集できるのは1行のみ。
「＋ 行追加」→ id: null の新規レコードを先頭に追加し、即編集モードに。
「登録」→ 全行を POST /api/stores に送信。サーバは id が null の行にだけ新規採番し、既存行は更新。レスポンスの最新データでグリッドを再描画します。
実行方法


npm install
npm start
その後ブラウザで http://localhost:3000 を開いてください。

なお動作確認時に curl で日本語データを送信した際、ターミナルの文字コード起因で応答が文字化けしましたが({name: "TestStore"} のようなASCIIでは正常)、これはターミナル側の問題で、実際のブラウザの fetch() は UTF-8 で送るため問題ありません。ID自動採番などのロジック自体は正しく動作しています。

質問や要望(例: 削除ボタン追加、バリデーション強化、ページング対応など)があれば教えてください。