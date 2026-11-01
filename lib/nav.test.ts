import assert from "node:assert/strict";
import test from "node:test";
import { activeNavNames, pathMatches } from "./nav.ts";

const only = (pathname: string, name: string) => {
  assert.deepEqual(activeNavNames(pathname), [name], pathname);
};

test("home matches only /", () => {
  assert.equal(pathMatches("/", "/"), true);
  assert.equal(pathMatches("/memo", "/"), false);
  assert.equal(pathMatches("/me", "/"), false);
  only("/", "首页");
});

test("a path matches its href or a child, not a longer sibling", () => {
  assert.equal(pathMatches("/me", "/me"), true);
  assert.equal(pathMatches("/me/story", "/me"), true);
  assert.equal(pathMatches("/memo", "/me"), false);
  assert.equal(pathMatches("/memo/", "/me"), false);
  assert.equal(pathMatches("/message", "/me"), false);
  assert.equal(pathMatches("/memo", "/memo"), true);
  assert.equal(pathMatches("/memo/2026", "/memo"), true);
  assert.equal(pathMatches("/memory", "/memo"), false);
  assert.equal(pathMatches("/apo-game", "/apo-game"), true);
  assert.equal(pathMatches("/apo-game/intro", "/apo-game"), true);
  assert.equal(pathMatches("/apo-game01", "/apo-game"), false);
  assert.equal(pathMatches("/marathon", "/marathon/"), true);
  assert.equal(pathMatches("/marathon/", "/marathon/"), true);
  assert.equal(pathMatches("/marathon/october", "/marathon/"), true);
  assert.equal(pathMatches("/marathon/october.html", "/marathon/"), true);
});

test("each section highlights exactly one item", () => {
  only("/articles", "文章");
  only("/articles/5-108-3", "文章");
  only("/posts/b1-1-非典型不上班的中年男人的一天", "文章");
  only("/category/跑步", "文章");
  only("/tag/Apple Watch", "文章");
  only("/memo", "备忘录");
  only("/articles/memo-2026-10-21", "备忘录");
  only("/me", "关于我");
  only("/apo-game", "游戏");
  only("/pencil-garden", "游戏");
  only("/pencil-garden/intro", "游戏");
  only("/dayou", "游戏");
  only("/moving", "游戏");
  only("/moving/game", "游戏");
  only("/marathon/", "运动健康");
  only("/marathon/october", "运动健康");
  only("/search", "搜索");
  only("/search/extra", "搜索");
});

test("longer siblings and unrelated urls highlight nothing", () => {
  assert.deepEqual(activeNavNames("/memory"), []);
  assert.deepEqual(activeNavNames("/message"), []);
  assert.deepEqual(activeNavNames("/rss.xml"), []);
  assert.deepEqual(activeNavNames("/apo-game01"), []);
  assert.deepEqual(activeNavNames("/sitemap.xml"), []);
});
