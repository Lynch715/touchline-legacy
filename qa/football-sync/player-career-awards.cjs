const assert = require('node:assert/strict');
require('./shim.cjs');

function newTestWorld(club = 'Liverpool') {
  newWorld(4321, club);
  SAVE_PAUSED = true;
}

newTestWorld();
const messi = Object.values(WORLD.players).find(p => p.realData && p.name === 'Lionel Messi');
const star = STAR_REBIRTH.find(row => row[0] === 'Lionel Messi');
assert(messi);
assert.equal(rebirthStar(...star.slice(0, 5), true), null);
messi.retired = true;
const reborn = rebirthStar(...star.slice(0, 5), true);
assert(reborn.legend && reborn.age === 15 && WORLD.freeAgents.includes(reborn.id));
assert.equal(rebirthStar(...star.slice(0, 5), true), null);
console.log('PASS 现役拦截、退役后生成、传奇去重');

newTestWorld();
const raul = HISTORICAL_LEGEND_BY_NAME.get('Raúl González');
const namesake = makePlayer(50, 'ST', 21, -1);
Object.assign(namesake, { name: raul[0], nat: raul[2] });
WORLD.players[namesake.id] = namesake;
WORLD.freeAgents.push(namesake.id);
assert(availableHistoricalLegends().includes(raul));
assert(legendAvailable(raul[0]));
assert(spawnOneLegend(raul).legend);
assert.equal(legendAvailable(raul[0]), false);
console.log('PASS 随机同名球员不挡住劳尔的自然与点名刷新');

newTestWorld();
const cup = WORLD.nationalCups.NAS;
const country = cup.teams[0], international = P(cup.squads[country][0]);
recordCareerAppearance(international, WORLD.season, 'NAS', country, { mins: 90, goals: 0, assists: 0, rating: 7 }, false, false);
const nationalCopy = nationalMatchPlayers('NAS', [country])[international.id];
assert.equal(nationalCopy.careerMatches, undefined);
assert.deepEqual(nationalCopy.a, international.a);
assert.notEqual(nationalCopy.a, international.a);

const home = UC();
const nextFixture = club => WORLD.fixtures.find(f => f.comp === 'L' && !f.played && [f.home, f.away].includes(club.id));
function play(f) {
  WORLD.day = f.day;
  const match = runMatch(createMatch(f.home, f.away, { record: false, ...knockoutOpts(f) }));
  assert(applyResult(f, match));
  assert(!applyResult(f, match));
  return match;
}

const firstMatch = play(nextFixture(home));
const player = P(firstMatch.teams.find(t => t.cid === home.id).men.find(m => m.pos === 'ST' && m.mins > 60).id);
assert.equal(player.careerMatches[0].apps, 1);
assert.equal(player.careerMatches[0].starts, 1);
const host = WORLD.clubs.find(c => c.lg === home.lg && c.id !== home.id);
assert(loanPlayer(player.id, host.id, { fee: 15000 }));
player.injury = player.susp = 0;
player.condition = 100;
const slot = FORMATIONS[host.tactic.formation].findIndex(s => s[0] === 'ST');
assert(slot >= 0);
host.lineup = host.lineup.map(id => id === player.id ? null : id);
host.lineup[slot] = player.id;
play(nextFixture(host));
assert.deepEqual(player.careerMatches.map(r => r.team), [home.id, host.id]);
assert(returnLoan(player.id, 'expire'));
assert.deepEqual(player.careerEvents.map(e => e.type), ['loan', 'return']);
assert.equal(player.careerEvents[0].fee, 15000);
assert.equal(player.careerMatches.reduce((total, r) => total + r.apps, 0), player.careerApps);
const playerId = player.id;
const matches = structuredClone(player.careerMatches);
adoptWorld(JSON.parse(JSON.stringify(WORLD)));
assert.deepEqual(P(playerId).careerMatches, matches);
P(playerId).age = 60;
const originalPromotion = promotionSettlement;
promotionSettlement = () => ({ ok: true, moves: [] });
for (const f of [...WORLD.fixtures, ...nationalFixtures()]) f.played = true;
endSeason();
promotionSettlement = originalPromotion;
assert(!P(playerId));
assert.deepEqual(WORLD.retiredCareers[playerId].careerMatches, matches);
validateWorld(WORLD);
console.log('PASS 实赛、重复结算防护、外租履历、保存重读与退役归档');

newTestWorld('Wrexham');
const season = WORLD.season;
const first = WORLD.leagues[C(0).lg], lower = WORLD.leagues[UC().lg];
assert.notEqual(first.lg, lower.lg);
const champion = C(first.clubIds[0]), opponent = C(first.clubIds[1]);
const a = P(champion.squad[0]), b = P(opponent.squad[0]), c = P(UC().squad[0]);
function addMatches(p, comp, team, goals, matches = 12) {
  for (let i = 0; i < matches; i++) {
    recordCareerAppearance(p, season, comp, team, { mins: 90, goals, assists: 0, rating: 7 }, false, p.pos === 'GK');
  }
}
addMatches(a, 'L:' + first.lg, champion.id, 2);
addMatches(b, 'L:' + first.lg, opponent.id, 1);
addMatches(c, 'L:' + lower.lg, UC().id, 3);
addMatches(b, 'CL', opponent.id, 8);
addMatches(b, 'CWC', opponent.id, 1, 1);
for (const [pos, count] of [['GK', 1], ['DC', 4], ['MC', 3], ['ST', 3]]) {
  for (let i = 0; i < count; i++) {
    const club = C(first.clubIds[2 + i]), p = club.squad.map(P).find(p => p.pos === pos);
    assert(p);
    addMatches(p, 'L:' + first.lg, club.id, 1);
  }
}
assert(loanPlayer(a.id, opponent.id));
awardCompetitionPlayers(season, 'L:' + first.lg, champion.id, { league: true });
awardCompetitionPlayers(season, 'L:' + lower.lg, UC().id, { league: true });
awardCompetitionPlayers(season, 'CL', opponent.id);
awardCompetitionPlayers(season, 'CWC', opponent.id);
const result = (scope, title) => WORLD.awardResults.find(a => a.comp === scope && a.title === title);
assert.equal(result('L:' + first.lg, '金靴奖').winners[0].pid, a.id);
assert.equal(result('L:' + lower.lg, '金靴奖').winners[0].pid, c.id);
assert.equal(result('CL', '金靴奖').winners[0].pid, b.id);
assert.equal(result('CWC', '最佳球员').winners[0].pid, b.id);
assert.deepEqual(result('L:' + first.lg, '最佳阵容').winners.map(x => POS_GRP[P(x.pid).pos]),
  ['gk', 'df', 'df', 'df', 'df', 'mf', 'mf', 'mf', 'fw', 'fw', 'fw']);
assert(a.honors.some(h => h.team === champion.id && h.t.endsWith('冠军')));
assert(!b.honors.some(h => h.team === champion.id && h.t.endsWith('冠军')));
Object.assign(a, { apps: 15, goals: 24, ratingSum: 105 });
awardBallonDor({ season });
awardSeasonHonors({ season, topScorers: [{ pid: a.id, g: a.goals }] });
assert.equal(a.clubId, opponent.id);
assert.equal(result('WORLD', '金球奖').winners[0].team, champion.id);
assert.equal(result('WORLD', '全球金靴奖').winners[0].team, champion.id);
assert.equal(a.honors.find(h => h.t === '全球金靴奖').team, champion.id);
const count = WORLD.awardResults.length;
awardCompetitionPlayers(season, 'L:' + first.lg, champion.id, { league: true });
assert.equal(WORLD.awardResults.length, count);
WORLD.careerPartialCompetitions = ['EL'];
addMatches(b, 'EL', opponent.id, 7);
awardCompetitionPlayers(season, 'EL', opponent.id);
assert(!result('EL', '金靴奖'));

const lowerRow = { lg: lower.lg, tier: lower.tier, champion: UC().id, table: [{ id: UC().id, pts: 96, rank: 1 }] };
const winner = opponent.manager;
assert(grantManagerTitle(opponent, season, '欧冠冠军'));
opponent.manager = { ...winner, name: 'Replacement', cn: '接任主帅', honors: [] };
const newClub = C(first.clubIds[4]);
newClub.manager = winner;
awardCareerCoaches({ season, leagues: [lowerRow], cups: [], euro: { CL: opponent.id } });
assert.equal(result('WORLD', 'FIFA 年度最佳教练').winners[0].name, winner.cn);
assert(winner.honors.some(h => h.t === 'FIFA 年度最佳教练'));
assert(!opponent.manager.honors.some(h => h.t === 'FIFA 年度最佳教练'));
validateWorld(WORLD);
console.log('PASS 各联赛评奖、杯赛独立、11 人阵容、冠军归属、旧档部分赛季、教练换队与得奖');

newTestWorld('Wrexham');
const year = WORLD.season, topLeague = WORLD.leagues[C(0).lg], comp = 'L:' + topLeague.lg;
const topClub = C(topLeague.clubIds[0]);
const keeper = topClub.squad.map(P).find(p => p.pos === 'GK');
const striker = topClub.squad.map(P).find(p => p.pos === 'ST');
for (let i = 0; i < 12; i++) {
  recordCareerAppearance(keeper, year, comp, topClub.id, { pos: 'ST', mins: 90, goals: 1, assists: 0, rating: 9 }, false, false);
  recordCareerAppearance(striker, year, comp, topClub.id, { pos: 'GK', mins: 90, goals: 0, assists: 0, rating: 7 }, false, true);
}
WORLD.day = 15;
awardCompetitionPlayers(year, comp, topClub.id, { league: true });
const keeperAward = WORLD.awardResults.find(a => a.comp === comp && a.title === '最佳门将');
assert.equal(keeperAward.winners[0].pid, striker.id);
assert.equal(keeperAward.winners[0].stats.minutes, 1080);
assert.equal(WORLD.awardResults.find(a => a.comp === comp && a.title === '最佳阵容').winners.find(x => x.role === 'fw').pid, keeper.id);
assert(keeper.honors.every(h => h.t !== '最佳门将'));
recordCareerEvent(striker, { s: year, d: 154, type: 'transfer', from: topClub.id, to: UC().id, fee: 0 });
assert(careerTimeline(striker).indexOf('2027-01-02') < careerTimeline(striker).indexOf('2026-08-16'));

const lowClub = WORLD.clubs.find(c => c.lg >= 0 && c.tier === 3);
const lowScorer = lowClub.squad.map(P).find(p => p.pos === 'ST');
// 把联赛级别与两组审计用数据分开，避免前面的客串门将用例污染本项。
striker.careerMatches = [];
Object.assign(striker, { apps: 34, goals: 24, assists: 10, ratingSum: 7.6 * 34, motm: 8 });
Object.assign(lowScorer, { apps: 44, goals: 40, assists: 2, ratingSum: 7 * 44, motm: 4 });
assert(worldAwardPerformance(striker, year).score > worldAwardPerformance(lowScorer, year).score);
awardBallonDor({ season: year });
assert.equal(WORLD.awardResults.find(r => r.title === '金球奖').winners[0].pid, striker.id);
const old = structuredClone(WORLD);
old.players[striker.id].honors = old.players[striker.id].honors.filter(h => h.t !== '金球奖');
adoptWorld(old);
assert(P(striker.id).honors.some(h => h.t === '金球奖'));
for (const bad of [
  copy => { copy.players[keeper.id].careerMatches[0].mins = -5; },
  copy => { copy.players[keeper.id].careerMatches[0].starts = 70; },
  copy => { copy.players[keeper.id].honors.push(null); },
]) {
  const copy = structuredClone(WORLD);
  bad(copy);
  const previous = WORLD;
  assert.throws(() => adoptWorld(copy));
  assert.equal(WORLD, previous);
}

newTestWorld();
const nationalWinner = WORLD.nationalCups.NAS.teams[0];
assert.equal(WORLD.nationManagers[nationalWinner], undefined);
awardNationalCoach(WORLD.season, 'NAS', nationalWinner, 12);
const coachResult = WORLD.awardResults.find(a => a.comp === 'NAS' && a.title === '冠军教练');
const coachId = coachResult.winners[0].coachId;
assert.equal(WORLD.nationalCoachHonors[coachId].honors[0].day, 12);
const random = Math.random;
Math.random = () => 0;
try { genNationalVacancies(); } finally { Math.random = random; }
assert.equal(WORLD.nationManagers[nationalWinner], undefined);
assert.equal(WORLD.nationalCoachHonors[coachId].honors[0].t, '亚洲杯冠军');
validateWorld(WORLD);
console.log('PASS 实际位置与颁奖日期、跨级别加权、补记旧荣誉、坏档回滚、国家队教练归档');
clearTimeout(SAVE_TIMER);
