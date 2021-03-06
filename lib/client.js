/*jshint node:true */
'use strict';

var request   = require('request');
var urlParser = require('url');
var zlib      = require('zlib');
var RSVP      = require('rsvp');

// クッキー設定
var jar = request.jar();
request.defaults({ jar: jar });

/**
 * http(s)リクエスト処理メインモジュール
 */
module.exports = {
  /**
   * プロパティ
   */

  core     : null, // cheerio-httpcli本体
  encoding : null, // encodingモジュール
  cheerio  : null, // 拡張cheerioオブジェクト

  /**
   * メソッド
   */

  /**
   * promise/callbackに両対応したエラー終了処理(promise実行後)
   *
   * @param err     Errorオブジェクトもしくはエラーメッセージ文字列
   * @param options prepareで作成したオプション情報
   * @param extra   Errorオブジェクトに追加する情報
   * @param result  処理結果オブジェクト
   * @param reject  (promise処理時のみ)reject関数
   */
  fail: function (err, options, extra, result, reject) {
    extra = extra || {};
    result = result || {};
    var error = (err instanceof Error) ? err : new Error(err);
    if (options.param.uri) {
      error.url = options.param.uri;
    }
    if (options.param.form) {
      error.param = options.param.form;
    } else if (options.param.qs) {
      error.param = options.param.qs;
    }
    Object.keys(extra).forEach(function (ex) {
      if (typeof(extra[ex]) !== 'undefined') {
        error[ex] = extra[ex];
      }
    });

    // promise処理時とcallback処理時で処理の返し方を切り替え
    if (options.callback instanceof Function) {
      options.callback(error, result.$, result.response, result.body);
    } else {
      Object.keys(result).forEach(function (r) {
        if (typeof(result[r]) !== 'undefined') {
          error[r] = result[r];
        }
      });
      reject(error);
    }
  },

  /**
   * promise/callbackに両対応したエラー終了処理(promise実行前)
   *
   * @param err     Errorオブジェクトもしくはエラーメッセージ文字列
   * @param options prepareで作成したオプション情報
   * @param extra   Errorオブジェクトに追加する情報
   * @param result  処理結果オブジェクト
   * @param reject  (promise処理時のみ)reject関数
   */
  error: function (err, options, extra, result) {
    extra = extra || {};
    result = result || {};
    if (options.callback instanceof Function) {
      return this.fail(err, options, extra, result);
    }

    // callbackを指定しなかった場合はpromiseオブジェクトを返す
    return new RSVP.Promise((function (resolve, reject) {
      return this.fail(err, options, extra, result, reject);
    }).bind(this));
  },

  /**
   * gzip転送に対応したリクエスト処理
   *
   * @param param    requestモジュールでのhttpアクセス時に指定するパラメータ
   * @param gzip     gzip転送をするかどうか
   * @param callback リクエスト完了時のコールバック関数(err, response, body(buffer))
   * @param retry    内部処理用引数(リトライ回数)
   */
  request: function (param, gzip, callback, retry) {
    if (gzip) {
      // gzipヘッダ追加
      param.headers['Accept-Encoding'] = 'gzip, deflate';
    }

    // リクエスト実行
    request(param, (function (err, res, body) {
      if (err) {
        return callback(err, res, body);
      }

      // POSTした先でリダイレクトされてもちゃんと飛んでくれないことがあるので自力で飛ぶ
      if (/^30\d$/.test(res.statusCode) && res.headers.location) {
        retry = retry || 0;
        if (retry > 5) {
          return callback(new Error('redirect limit over'), res, body);
        }

        // パラメータの調整
        param.url = res.headers.location;
        param.method = 'GET';
        delete(param.form);
        delete(param.qs);
        return this.request(param, gzip, callback, retry + 1);
      }

      // レスポンスヘッダを確認してコンテンツがgzip圧縮されているかどうかチェック
      var gzipped = false;
      for (var h in res.headers) {
        if (h.toLowerCase() === 'content-encoding' && res.headers[h].toLowerCase() === 'gzip') {
          gzipped = true;
          break;
        }
      }

      if (gzipped) {
        // gzip化されているコンテンツを解凍したものをセットしてコールバック
        zlib.unzip(body, function (err, buf) {
          callback(err, res, buf);
        });
      } else {
        callback(undefined, res, body);
      }
    }).bind(this));
  },

  /**
   * http通信処理本体
   *
   * @param options prepareで作成したオプション情報
   * @param resolve (promise処理時のみ)resolve関数
   * @param reject  (promise処理時のみ)reject関数
   */
  execute: function (options, resolve, reject) {
    // 処理結果格納先
    var result = {};

    // リクエスト実行
    this.request(options.param, options.gzip, (function (err, res, body) {
      // クッキー取得
      if (res) {
        res.cookies = {};
        options.param.jar.getCookies(options.param.uri).forEach(function (c) {
          res.cookies[c.key] = c.value;
        });
      }

      result.response = res;

      if (err) {
        return this.fail(err, options, {}, result, reject);
      }
      if ((body || []).length === 0) {
        return this.fail('no content', options, { statusCode: res.statusCode }, result, reject);
      }

      //content-lengthが5MB以上ならエラーとする
      //40MB以上の場合この後の処理でメモリリークする場合がある
      //何MB以上で再現するかは調査中
      var contentLength = res.headers['content-length']
      if (contentLength){
        if (contentLength > 1000*1000*5){
          return this.fail('content-length is too large', options, { contentLength: contentLength }, result, reject);
        }
      }

      // Buffer状態のHTMLコンテンツからエンコーディングを判定してUTF-8に変換
      var enc = options.encode || this.encoding.detect(body);
      if (enc) {
        enc = enc.toLowerCase();
        try {
          body = this.encoding.convert(enc, body);
        } catch (e) {
          return this.fail(e, options, { charset: enc }, result, reject);
        }
      }
      result.body = body.toString('utf8');

      // cheerioでHTMLコンテンツをパース & 現在のページ情報を追加
      result.$ = this.cheerio.load(result.body, { decodeEntities: false });
      result.$._root._documentInfo = {
        url: res.request.uri.href,
        encoding: enc
      };
      result.$.documentInfo = function () {
        return this._root._documentInfo;
      };

      // HTMLが取得できてもレスポンスステータスが200でない場合(ソフト404など)はエラーとして処理する
      if (res.statusCode !== 200) {
        return this.fail('server status', options, { statusCode: res.statusCode }, result, reject);
      }

      if (options.referer) {
        // 次のリクエスト時に今アクセスしたURLをRefererとする
        options.headers.Referer = result.$._root._documentInfo.url;
      }

      // promise処理時とcallback処理時で処理の返し方を切り替え
      if (options.callback instanceof Function) {
        options.callback(result.error, result.$, result.response, result.body);
      } else {
        resolve(result);
      }
    }).bind(this));
  },

  /**
   * リクエスト時に必要なオプション情報を作成
   *
   * @param method   リクエストメソッド
   * @param url      リクエスト先のURL
   * @param param    リクエストパラメータ
   * @param encode   取得先のHTMLのエンコーディング(default: 自動判定)
   * @param callback リクエスト完了時のコールバック関数(err, cheerio, response, body)
   * @return オプション情報オブジェクト
   */
  prepare: function (method, url, param, encode, callback) {
    // 省略されている引数に合わせて調整
    if (encode instanceof Function) {
      callback = encode;
      encode = undefined;
    } else if (param instanceof Function) {
      callback = param;
      param = undefined;
      encode = undefined;
    }

    var cli = this.core;

    // デフォルトはIEとして振る舞う
    if (! ('User-Agent' in cli.headers)) {
      cli.setBrowser('ie');
    }

    // リクエストヘッダ作成
    var parsed = urlParser.parse(url);
    var reqHeader = { Host: parsed.host };
    Object.keys(cli.headers).forEach(function (h) {
      reqHeader[h] = cli.headers[h];
    });

    var options = {
      param: {
        uri: url,
        method: method,
        encoding: null, // Bufferでコンテンツを取得する
        headers: reqHeader,
        timeout: cli.timeout,
        followRedirect: true,
        jar: jar
      },
      headers: cli.headers,
      gzip: cli.gzip,
      referer: cli.referer,
      encode: encode,
      callback: callback
    };
    options.param[(method === 'GET') ? 'qs' : 'form'] = param;

    return options;
  },

  /**
   * リクエスト処理スタート
   *
   * @param method   リクエストメソッド
   * @param url      リクエスト先のURL
   * @param param    リクエストパラメータ
   * @param encode   取得先のHTMLのエンコーディング(default: 自動判定)
   * @param callback リクエスト完了時のコールバック関数(err, cheerio, response, body)
   */
  run: function (method, url, param, encode, callback) {
    var options = this.prepare(method, url, param, encode, callback);
    if (! (options.callback instanceof Function)) {
      // callbackを指定しなかった場合はpromiseオブジェクトを返す
      return new RSVP.Promise((function (resolve, reject) {
        this.execute(options, resolve, reject);
      }).bind(this));
    }
    this.execute(options);
  }
};
