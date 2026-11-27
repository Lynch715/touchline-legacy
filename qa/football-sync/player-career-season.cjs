const assert = require('node:assert/strict');
const fs = require('node:fs');
const { gzipSync } = require('node:zlib');
require('./shim.cjs');

const seasons = Number(process.env.CAREER_TEST_SEASONS || 2);
assert(Number.isInteger(seasons) && seasons > 0);
if (process.env.CAREER_TEST_INPUT) {
  adoptWorld(JSON.parse(fs.readFileSync(process.env.CAREER_TEST_INPUT, 'utf8')));
} else {
  newWorld(17017, 'Shanghai Port');
  WORLD.userNation = WORLD.nationalCups.NAS.teams[0];
}
SAVE_PAUSED = true;

const trackedPlayers = () => Object.values(WORLD.players).concat(Object.values(WORLD.retiredCareers || {}));
const completed = [];
for (let pass = 0; pass < seasons; pass++) {
  const season = WORLD.season;
  const prior = new Map(trackedPlayers().filter(p => p.careerMatches?.length).map(p => [p.id, JSON.stringify(p.careerMatches)]));
  let clubMatches = 0, internationalMatches = 0, steps = 0;
  const original = { applyResult, applyNationalResult, endSeason };
  global.applyResult = (f, m) => {
    const result = original.applyResult(f, m);
    if (result && !f.national) clubMatches++;
    return result;
  };
  global.applyNationalResult = (f, m) => {
    const result = original.applyNationalResult(f, m);
    if (result) internationalMatches++;
    return result;
  };
  global.endSeason = () => {
    const promotion = promotionSettlement();
    assert(promotion.ok, promotion.reason);
    assert(WORLD.fixtures.every(f => f.played));
    assert(nationalFixtures().every(f => f.played));
    return original.endSeason();
  };

  while (WORLD.season === season) {
    const advanceResult = advance();
    assert.notEqual(advanceResult.t, 'over');
    if (advanceResult.t === 'match') {
      assert(startUserMatch(advanceResult.fx));
      pauseMatchPlayback();
      runMatch(CURMATCH);
      finishUserMatch();
    }
    clearTimeout(SAVE_TIMER);
    SAVE_PAUSED = true;
    assert(++steps <= SEASON_DAYS * 3, '赛历没有跨季');
    if (steps % 60 === 0) console.log('PROGRESS', { season, day: WORLD.day, clubMatches, internationalMatches });
  }
  Object.assign(global, original);

  const complete = WORLD.history.at(-1);
  assert.equal(complete.season, season);
  const awards = (WORLD.awardResults || []).filter(row => row.s === season);
  assert(awards.some(row => row.comp === 'WORLD' && row.title === 'FIFA 年度最佳教练'));
  const awardKeys = new Set(awards.map(row => row.comp + '|' + row.title));
  assert.equal(awardKeys.size, awards.length);
  for (const l of complete.leagues) {
    if (!competitionCareerComplete(season, 'L:' + l.lg)) continue;
    assert(awardKeys.has('L:' + l.lg + '|最佳球员'), '评奖缺少联赛 ' + l.lg);
    assert(awardKeys.has('L:' + l.lg + '|联赛最佳教练'), '缺少联赛教练奖 ' + l.lg);
  }

  const players = trackedPlayers();
  for (const [id, rows] of prior) {
    const p = P(id) || WORLD.retiredCareers?.[id];
    assert(p, '球员生涯记录丢失 ' + id);
    assert.equal(JSON.stringify(p.careerMatches.filter(r => r.s < season)), rows, '上一季明细被改写 ' + id);
  }
  const counts = { clubApps: 0, internationalApps: 0, careerRows: 0 };
  for (const p of players) {
    const rows = p.careerMatches || [];
    const clubApps = rows.filter(r => typeof r.team === 'number').reduce((total, r) => total + r.apps, 0);
    const nationalApps = rows.filter(r => typeof r.team === 'string').reduce((total, r) => total + r.apps, 0);
    if (!process.env.CAREER_TEST_INPUT || WORLD.careerTrackingFrom.d === 0 && !WORLD.careerPartialCompetitions?.length) {
      assert.equal(clubApps, p.careerApps || 0, '俱乐部累计出场不符 ' + p.id);
      assert.equal(nationalApps, p.intlStats?.apps || 0, '国家队累计出场不符 ' + p.id);
    }
    counts.clubApps += clubApps;
    counts.internationalApps += nationalApps;
    counts.careerRows += rows.length;
  }
  for (const award of awards) {
    for (const winner of award.winners) {
      if (winner.pid == null) continue;
      const p = P(winner.pid) || WORLD.retiredCareers?.[winner.pid];
      assert(p?.honors.some(h => h.s === season && h.t === (winner.medal || award.title) && h.team === winner.team), '得主个人履历缺奖 ' + winner.pid);
    }
  }

  validateWorld(WORLD);
  const raw = JSON.stringify(WORLD);
  const oldAwards = JSON.stringify(WORLD.awardResults);
  const reloadStart = performance.now();
  adoptWorld(JSON.parse(raw));
  SAVE_PAUSED = true;
  const reloadMs = Math.round(performance.now() - reloadStart);
  assert.equal(JSON.stringify(WORLD.awardResults), oldAwards);
  if (process.env.CAREER_TEST_OUTPUT) fs.writeFileSync(process.env.CAREER_TEST_OUTPUT, raw);
  completed.push({ season, clubMatches, internationalMatches, awards: awards.length, leagues: complete.leagues.length,
    ...counts, archived: Object.keys(WORLD.retiredCareers || {}).length, rawBytes: Buffer.byteLength(raw),
    gzipBytes: gzipSync(raw).length, reloadMs });
  console.log('PASS', JSON.stringify(completed.at(-1)));
}
console.log('COMPLETED', JSON.stringify(completed));
clearTimeout(SAVE_TIMER);
