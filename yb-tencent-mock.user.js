// ==UserScript==
// @name         腾讯元宝 - 非微信浏览
// @namespace    https://github.com/stern
// @version      1.0
// @description  自动添加 mock=1 参数以在非微信浏览器查看元宝分享页 (yb.tencent.com/wx/ct/*)
// @author       stern
// @match        https://yb.tencent.com/wx/ct/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  const url = new URL(window.location.href);

  // If mock param not already set, add it and redirect
  if (!url.searchParams.has('mock')) {
    url.searchParams.set('mock', '1');
    window.location.replace(url.toString());
  }
})();
