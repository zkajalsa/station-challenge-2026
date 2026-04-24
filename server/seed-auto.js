/**
 * Auto-seed — runs on first boot when database is empty.
 * Creates admin account and World Cup 2026 matches.
 * Associates are imported via the admin panel (not pre-seeded in production).
 */

const { getDb } = require('./database');
const db = getDb();

// Admin account
db.prepare(`INSERT OR IGNORE INTO admins (login, pin_hash) VALUES (?, ?)`).run('admin', 'station2026');

// FIFA World Cup 2026 matches
const matches = [
  { code: 'GS-A1', teamA: 'USA', teamB: 'TBD-A2', group: 'Group A', date: '2026-06-11 18:00', venue: 'MetLife Stadium, New Jersey' },
  { code: 'GS-A2', teamA: 'TBD-A3', teamB: 'TBD-A4', group: 'Group A', date: '2026-06-11 21:00', venue: 'SoFi Stadium, Los Angeles' },
  { code: 'GS-A3', teamA: 'USA', teamB: 'TBD-A3', group: 'Group A', date: '2026-06-16 18:00', venue: 'MetLife Stadium, New Jersey' },
  { code: 'GS-A4', teamA: 'TBD-A2', teamB: 'TBD-A4', group: 'Group A', date: '2026-06-16 21:00', venue: 'AT&T Stadium, Dallas' },
  { code: 'GS-A5', teamA: 'TBD-A4', teamB: 'USA', group: 'Group A', date: '2026-06-21 18:00', venue: 'MetLife Stadium, New Jersey' },
  { code: 'GS-A6', teamA: 'TBD-A2', teamB: 'TBD-A3', group: 'Group A', date: '2026-06-21 18:00', venue: 'Hard Rock Stadium, Miami' },
  { code: 'GS-B1', teamA: 'Mexico', teamB: 'TBD-B2', group: 'Group B', date: '2026-06-12 18:00', venue: 'Estadio Azteca, Mexico City' },
  { code: 'GS-B2', teamA: 'TBD-B3', teamB: 'TBD-B4', group: 'Group B', date: '2026-06-12 21:00', venue: 'Lumen Field, Seattle' },
  { code: 'GS-B3', teamA: 'Mexico', teamB: 'TBD-B3', group: 'Group B', date: '2026-06-17 18:00', venue: 'Estadio Azteca, Mexico City' },
  { code: 'GS-B4', teamA: 'TBD-B2', teamB: 'TBD-B4', group: 'Group B', date: '2026-06-17 21:00', venue: 'BMO Field, Toronto' },
  { code: 'GS-C1', teamA: 'Canada', teamB: 'TBD-C2', group: 'Group C', date: '2026-06-13 18:00', venue: 'BMO Field, Toronto' },
  { code: 'GS-C2', teamA: 'TBD-C3', teamB: 'TBD-C4', group: 'Group C', date: '2026-06-13 21:00', venue: 'Gillette Stadium, Boston' },
  { code: 'GS-D1', teamA: 'Brazil', teamB: 'TBD-D2', group: 'Group D', date: '2026-06-14 18:00', venue: 'SoFi Stadium, Los Angeles' },
  { code: 'GS-D2', teamA: 'TBD-D3', teamB: 'TBD-D4', group: 'Group D', date: '2026-06-14 21:00', venue: 'NRG Stadium, Houston' },
  { code: 'GS-E1', teamA: 'Argentina', teamB: 'TBD-E2', group: 'Group E', date: '2026-06-15 18:00', venue: 'Hard Rock Stadium, Miami' },
  { code: 'GS-E2', teamA: 'TBD-E3', teamB: 'TBD-E4', group: 'Group E', date: '2026-06-15 21:00', venue: 'Lincoln Financial Field, Philadelphia' },
  { code: 'GS-F1', teamA: 'France', teamB: 'TBD-F2', group: 'Group F', date: '2026-06-12 15:00', venue: 'Mercedes-Benz Stadium, Atlanta' },
  { code: 'GS-F2', teamA: 'TBD-F3', teamB: 'TBD-F4', group: 'Group F', date: '2026-06-12 18:00', venue: "Levi's Stadium, San Francisco" },
  { code: 'GS-G1', teamA: 'England', teamB: 'TBD-G2', group: 'Group G', date: '2026-06-13 15:00', venue: 'AT&T Stadium, Dallas' },
  { code: 'GS-G2', teamA: 'TBD-G3', teamB: 'TBD-G4', group: 'Group G', date: '2026-06-13 18:00', venue: 'BC Place, Vancouver' },
  { code: 'GS-H1', teamA: 'Germany', teamB: 'TBD-H2', group: 'Group H', date: '2026-06-14 15:00', venue: 'MetLife Stadium, New Jersey' },
  { code: 'GS-H2', teamA: 'TBD-H3', teamB: 'TBD-H4', group: 'Group H', date: '2026-06-14 18:00', venue: 'Arrowhead Stadium, Kansas City' },
  { code: 'R32-1', teamA: 'TBD', teamB: 'TBD', group: 'Round of 32', date: '2026-06-28 18:00', venue: 'TBD' },
  { code: 'R32-2', teamA: 'TBD', teamB: 'TBD', group: 'Round of 32', date: '2026-06-28 21:00', venue: 'TBD' },
  { code: 'R16-1', teamA: 'TBD', teamB: 'TBD', group: 'Round of 16', date: '2026-07-04 18:00', venue: 'TBD' },
  { code: 'R16-2', teamA: 'TBD', teamB: 'TBD', group: 'Round of 16', date: '2026-07-04 21:00', venue: 'TBD' },
  { code: 'QF-1', teamA: 'TBD', teamB: 'TBD', group: 'Quarter Final', date: '2026-07-09 18:00', venue: 'TBD' },
  { code: 'QF-2', teamA: 'TBD', teamB: 'TBD', group: 'Quarter Final', date: '2026-07-09 21:00', venue: 'TBD' },
  { code: 'SF-1', teamA: 'TBD', teamB: 'TBD', group: 'Semi Final', date: '2026-07-14 18:00', venue: 'TBD' },
  { code: 'SF-2', teamA: 'TBD', teamB: 'TBD', group: 'Semi Final', date: '2026-07-15 18:00', venue: 'TBD' },
  { code: 'FINAL', teamA: 'TBD', teamB: 'TBD', group: 'Final', date: '2026-07-19 18:00', venue: 'MetLife Stadium, New Jersey' },
];

const insertMatch = db.prepare(`
  INSERT OR IGNORE INTO matches (match_code, team_a, team_b, group_stage, match_date, venue)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const seedMatches = db.transaction(() => {
  let count = 0;
  for (const m of matches) {
    const result = insertMatch.run(m.code, m.teamA, m.teamB, m.group, m.date, m.venue);
    if (result.changes > 0) count++;
  }
  return count;
});

const matchCount = seedMatches();
console.log(`✅ Auto-seed complete: ${matchCount} matches, admin account ready`);
