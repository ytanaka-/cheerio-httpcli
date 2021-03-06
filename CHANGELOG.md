# 0.3.2 (2015-05-11)

* 依存ライブラリを最新バージョンに更新
* 元からHTMLエンティティで表記されている文字列を`.text()`や`.html()`で取得する際に可読文字にデコードするように変更(HTMLエンティティのままにしておきたい場合は`._text()`および`._html()`で可能)
* Shift_JISのページをiconvでUTF-8に変換する際にチルダが波ダッシュ(0x301C)に変換されてしまう不具合を修正
* iconv-jpをデフォルトの文字コード変換エンジン候補から除外(長期間メンテされていないため)
* サイト側のHTML構成が変わって動かなくなっていたサンプルスクリプトを修正

# 0.3.1 (2015-02-15)

* 依存ライブラリを最新バージョンに更新
* `.html()`で取得する文字列がHTMLエンティティに変換されないようにした

# 0.3.0 (2015-01-14)

* `fetch()`をプロミス形式と従来のコールバック形式とのハイブリッド化
* `fetch()`のcallback第2引数のcheerioオブジェクトのプロトタイプを独自拡張し、以下のメソッドを追加
    * `$.documentInfo()`
    * `$(<form element>).submit()`
    * `$(<link element>).click()`
* `fetch()`のcallback第3引数のresponseオブジェクトに`cookies`プロパティを追加
* `fetch()`のcallback第4引数にUTF-8変換後の生HTMLコンテンツを追加
* `setBrowser()`メソッド追加(ブラウザごとのUser-Agentの簡易指定)
* 自動的にRefererをセットするオプション追加
* テスト機構を一新(mocha & power-assert & blanket)

# 0.2.0 (2014-06-22)

* デフォルトでiconv-liteを使用するように変更(ネイティブモジュールをコンパイルするためのVisualStudioなどの開発環境のないWindowsでもインストールできるようになった)
* 文字コードの判別にjschardetを利用するようにした
* requestモジュールのクッキーを有効にした
* デフォルトのUser-Agent情報をIE11にした

# 0.1.3 (2013-09-09)

* エラーオブジェクトに呼び出し時にセットした`param`を追加

# 0.1.2 (2013-09-06)

* リクエストヘッダのHostを自動でセットするようにした
* gzip転送オプション追加
* `fetch()`のcallbackの第3引数にrequestモジュールの`response`オブジェクトを追加
* HTTPステータスコードが200以外によるエラーでもコンテンツを取得するようにした

# 0.1.1 (2013-04-11)

* charset=xxxというようにダブル(or シングル)クォーテーションがない場合に文字コードの判定に失敗するケースを修正

# 0.1.0 (2013-03-18)

* 初版リリース
