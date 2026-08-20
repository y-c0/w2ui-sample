
w2ui 1.5 + jQuery + Express 画面サンプル
https://github.com/y-c0/w2ui-sample


構成
package.json — Express依存
server.js — 都道府県マスタ、店舗データ(インメモリ)、GET /api/prefectures、GET /api/stores、POST /api/stores(新規行はサーバ側でID採番)
public/index.html — w2ui 1.5 のグリッド + 行追加/登録ボタン

起動
npm install
npm start
その後ブラウザで http://localhost:3000 を開く
