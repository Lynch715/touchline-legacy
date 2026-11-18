// 赛事规模、真实球队名单、临场调位与助教的专项回归。
const assert = require('node:assert/strict');
const fs = require('node:fs');
const crypto = require('node:crypto');
const path = require('node:path');
require('./shim.cjs');
const root = path.resolve(__dirname, '../..');
const sources = require('../../assets/league-expansion-sources.json');
const manifest = require('../../assets/manifest.json');
const digest = data => crypto.createHash('sha256').update(data).digest('hex');

function checkCalendar() {
  const active = WORLD.leagues.filter(l => !l.inactive);
  const leagues = Map.groupBy(WORLD.fixtures.filter(f => f.comp === 'L'), f => f.lg);
  for (const lg of active) {
    assert.equal(lg.clubIds.length % 2, 0, lg.name);
    const games = leagues.get(lg.lg);
    for (const round of Map.groupBy(games, f => f.round).values()) {
      const clubs = round.flatMap(f => [f.home, f.away]);
      assert.equal(clubs.length, lg.clubIds.length, lg.name);
      assert.equal(new Set(clubs).size, clubs.length, lg.name);
    }
    if (NATIONS[lg.nation].code === 'ENG') {
      const count = lg.tier === 0 ? 20 : 24;
      assert.equal(lg.clubIds.length, count);
      assert.equal(lg.rounds, 2 * (count - 1));
      const byHome = Map.groupBy(games, f => f.home);
      for (const id of lg.clubIds) assert.deepEqual(new Set(byHome.get(id).map(f => f.away)), new Set(lg.clubIds.filter(c => c !== id)));
    }
  }
  return active.length;
}

function legacyFixture(file) {
  const raw = fs.readFileSync(file, 'utf8'), old = JSON.parse(raw);
  const original = old.clubs.map(c => c.en), season = old.season, user = old.userClub;
  const fixtures = digest(JSON.stringify(old.fixtures)), tables = digest(JSON.stringify(old.leagues));
  adoptWorld(old); SAVE_PAUSED = true; clearTimeout(SAVE_TIMER);
  assert.equal(digest(JSON.stringify(WORLD.fixtures)), fixtures);
  assert.equal(digest(JSON.stringify(WORLD.leagues)), tables);
  assert.deepEqual(WORLD.clubs.map(c => c.en), original);
  endSeason();
  assert.equal(WORLD.season, season + 1);
  assert.equal(WORLD.userClub, user);
  assert.deepEqual(WORLD.clubs.slice(0, original.length).map(c => c.en), original);
  assert(WORLD.expandedLeagues2026);
  const added = WORLD.clubs.slice(original.length);
  assert(added.length > 0);
  for (const c of added) {
    assert(c.squad.length >= 16 && c.manager, c.en);
    if(c.squad.some(id => P(id).age >= 23)) assert(c.squad.includes(c.captain), c.en);
    if (EXPANSION_ROSTERS[c.en]) assert(c.squad.some(id => P(id).squadSourceId));
    for (const id of c.squad) assert.equal(P(id).clubId, c.id);
  }
  const leagues = checkCalendar();
  validateWorld(WORLD);
  const count = WORLD.clubs.length;
  adoptWorld(JSON.parse(JSON.stringify(WORLD))); expandLegacyLeagues();
  assert.equal(WORLD.clubs.length, count);
  assert.equal(digest(fs.readFileSync(file)), digest(raw));
  console.log('PASS 跨季扩容、原俱乐部身份、旧赛程、重新读档', {added:added.length, leagues});
}

function fresh() {
  newWorld(4242, 'AFC Wimbledon');
  const leagues = checkCalendar(), used = new Set();
  const fixturesByDay = new Set();
  for (const f of WORLD.fixtures) {
    for (const id of [f.home,f.away]) {
      const k = f.day + '/' + id;
      assert(!fixturesByDay.has(k), k);
      fixturesByDay.add(k);
    }
  }
  assert.equal(sources.clubs.length, 31);
  for (const entry of sources.clubs) {
    const c = WORLD.clubs.find(c => c.en === entry.club);
    const players = c.squad.map(P);
    assert.equal(EXPANSION_ROSTERS[c.en].length, entry.players);
    assert(players.length >= 16);
    assert(players.every(p => p.realData && p.squadSourceId && p.clubId === c.id));
    for (const p of players) {
      assert(!used.has(p.squadSourceId));
      used.add(p.squadSourceId);
    }
    const uri = crestURI(c);
    const packed = manifest.files.find(f => f.path === uri);
    assert(packed, c.en);
    assert.equal(digest(fs.readFileSync(path.join(root,uri))), entry.sha256 || packed.sha256);
  }
  assert(used.has(257097) && used.has(474225), "同名后卫保留独立身份");
  validateWorld(WORLD);
  console.log('PASS 无轮空、主客场、新增球队真人/队徽及赛事无撞期', {leagues, players:used.size});

  const c = UC(), opp = WORLD.clubs.find(o => o.lg === c.lg && o !== c);
  c.tactic.formation = '4-2-3-1'; autoPickLineup(c);
  const game = () => createMatch(c.id, opp.id, {userSide:0, record:true, rules:{windows:3}});
  const M = game(), T = M.teams[0], left = T.men.find(m => m.pos === 'ML'), am = T.men.find(m => m.pos === 'AM');
  const bench = T.bench.find(id => P(id).pos === 'AM');
  assert(bench);
  const homeLineup = [...c.lineup], original = [left.slot, am.slot];
  M.t = 61; left.cond = 42; am.mins = 61; am.goals = 1;
  assert.equal(stageSwap(T.gk,am), false);
  assert(stageSwap(left,am));
  assert.equal(applyLiveLineup(M,0,[{out:left,in:bench},{out:am,in:bench}],plannedSlots),false);
  assert.deepEqual([M.subsMade[0],M.subWindows[0],left.off,am.slot],[0,0,false,original[1]]);
  assert(applyLiveLineup(M,0,[{out:left,in:bench}],plannedSlots));
  const incoming = T.men.find(m => m.id === bench);
  assert.deepEqual([incoming.pos,incoming.slot,am.pos,am.slot,left.off],['AM',original[1],'ML',original[0],true]);
  assert.deepEqual([M.subsMade[0],M.subWindows[0],am.mins,am.goals],[1,1,61,1]);
  for (const m of [am,incoming]) {
    const [,x,y] = FORMATIONS[T.form][m.slot];
    assert.deepEqual({x:m.bx,y:m.by},slotWorld(x,y,0));
  }
  assert.deepEqual(c.lineup,homeLineup);
  plannedSlots.clear(); M.subsMade[0] = subLimit(M); M.subWindows[0] = 3; M.t++;
  assert(stageSwap(am,incoming));assert(applyLiveLineup(M,0,[],plannedSlots));
  assert.deepEqual([am.pos,incoming.pos,M.subsMade[0],M.subWindows[0]],['AM','ML',subLimit(M),3]);
  plannedSlots.clear();
  console.log('PASS 换人和调位同时确认、整批回滚、无换人名额时调位');
  assert.equal(game().assistantMode,'injury');
  for (const mode of ['all','injury','manual']) {
    WORLD.settings.assistantMode = mode;
    const g = game(), team = g.teams[0], injured = team.men[3];
    assert.equal(g.assistantMode,mode); assert.notEqual(team.tac,c.tactic);
    injured.off = true; injured.injured = true; g.t = 10;
    aiSubs(g); assert.equal(g.subsMade[0],mode === 'manual' ? 0 : 1);
    const fatigue = game(), ft = fatigue.teams[0], mentality = c.tactic.mentality;
    ft.men[3].cond = 30;fatigue.t = 78;fatigue.score = [0,1];seedRng(7);
    for(let i=0;i<500;i++)aiSubs(fatigue);
    assert.equal(fatigue.subsMade[0],mode === 'all' ? 1 : 0);
    assert.equal(ft.tac.mentality,mode === 'all' ? Math.min(4,mentality+1) : mentality);
    assert.equal(c.tactic.mentality,mentality);
  }
  const g = game();g.autoUser = true;g.t = 78;g.score = [2,0];
  aiSubs(g);assert.equal(g.teams[0].assistantAdjustment,'回收阵型');
  console.log('PASS 默认与三档助教、伤病和体能换人、比分调整及跳过比赛');
}

if (process.argv[2]) legacyFixture(process.argv[2]); else fresh();
clearTimeout(SAVE_TIMER);
