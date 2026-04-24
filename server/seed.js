/**
 * Seed script — populates the database with:
 * - Sample associates (200 across 3 shifts)
 * - FIFA World Cup 2026 Group Stage matches
 * - Default admin account
 *
 * Run: npm run seed
 */

const { getDb } = require('./database');

const db = getDb();

console.log('🌱 Seeding database...\n');

// ─── Admin Account ───
db.prepare(`INSERT OR IGNORE INTO admins (login, pin_hash) VALUES (?, ?)`).run('admin', 'station2026');
console.log('✅ Admin account created (login: admin, pin: station2026)');

// ─── Sample Associates ───
// In production, replace this with your actual roster import
const shifts = [
  { name: 'night', count: 90 },
  { name: 'early', count: 60 },
  { name: 'late', count: 50 }
];

const insertAssociate = db.prepare(`
  INSERT OR IGNORE INTO associates (login, badge_id, full_name, shift)
  VALUES (?, ?, ?, ?)
`);

const seedAssociates = db.transaction(() => {
  let total = 0;
  for (const shift of shifts) {
    for (let i = 1; i <= shift.count; i++) {
      const padded = String(total + i).padStart(3, '0');
      insertAssociate.run(
        `associate${padded}`,
        `BADGE${padded}`,
        `Associate ${padded}`,
        shift.name
      );
      total++;
    }
  }
  return total;
});

const associateCount = seedAssociates();
console.log(`✅ ${associateCount} sample associates created (90 night, 60 early, 50 late)`);

// ─── FIFA World Cup 2026 — Group Stage Matches ───
// The 2026 World Cup is hosted by USA, Canada, and Mexico
// 48 teams, 12 groups of 4
const matches = [
  // Group A
  { code: 'GS-A1', teamA: 'USA', teamB: 'TBD-A2', group: 'Group A', date: '2026-06-11 18:00', venue: 'MetLife Stadium, New Jersey' },
  { code: 'GS-A2', teamA: 'TBD-A3', teamB: 'TBD-A4', group: 'Group A', date: '2026-06-11 21:00', venue: 'SoFi Stadium, Los Angeles' },
  { code: 'GS-A3', teamA: 'USA', teamB: 'TBD-A3', group: 'Group A', date: '2026-06-16 18:00', venue: 'MetLife Stadium, New Jersey' },
  { code: 'GS-A4', teamA: 'TBD-A2', teamB: 'TBD-A4', group: 'Group A', date: '2026-06-16 21:00', venue: 'AT&T Stadium, Dallas' },
  { code: 'GS-A5', teamA: 'TBD-A4', teamB: 'USA', group: 'Group A', date: '2026-06-21 18:00', venue: 'MetLife Stadium, New Jersey' },
  { code: 'GS-A6', teamA: 'TBD-A2', teamB: 'TBD-A3', group: 'Group A', date: '2026-06-21 18:00', venue: 'Hard Rock Stadium, Miami' },

  // Group B
  { code: 'GS-B1', teamA: 'Mexico', teamB: 'TBD-B2', group: 'Group B', date: '2026-06-12 18:00', venue: 'Estadio Azteca, Mexico City' },
  { code: 'GS-B2', teamA: 'TBD-B3', teamB: 'TBD-B4', group: 'Group B', date: '2026-06-12 21:00', venue: 'Lumen Field, Seattle' },
  { code: 'GS-B3', teamA: 'Mexico', teamB: 'TBD-B3', group: 'Group B', date: '2026-06-17 18:00', venue: 'Estadio Azteca, Mexico City' },
  { code: 'GS-B4', teamA: 'TBD-B2', teamB: 'TBD-B4', group: 'Group B', date: '2026-06-17 21:00', venue: 'BMO Field, Toronto' },

  // Group C
  { code: 'GS-C1', teamA: 'Canada', teamB: 'TBD-C2', group: 'Group C', date: '2026-06-13 18:00', venue: 'BMO Field, Toronto' },
  { code: 'GS-C2', teamA: 'TBD-C3', teamB: 'TBD-C4', group: 'Group C', date: '2026-06-13 21:00', venue: 'Gillette Stadium, Boston' },

  // Group D
  { code: 'GS-D1', teamA: 'Brazil', teamB: 'TBD-D2', group: 'Group D', date: '2026-06-14 18:00', venue: 'SoFi Stadium, Los Angeles' },
  { code: 'GS-D2', teamA: 'TBD-D3', teamB: 'TBD-D4', group: 'Group D', date: '2026-06-14 21:00', venue: 'NRG Stadium, Houston' },

  // Group E
  { code: 'GS-E1', teamA: 'Argentina', teamB: 'TBD-E2', group: 'Group E', date: '2026-06-15 18:00', venue: 'Hard Rock Stadium, Miami' },
  { code: 'GS-E2', teamA: 'TBD-E3', teamB: 'TBD-E4', group: 'Group E', date: '2026-06-15 21:00', venue: 'Lincoln Financial Field, Philadelphia' },

  // Group F
  { code: 'GS-F1', teamA: 'France', teamB: 'TBD-F2', group: 'Group F', date: '2026-06-12 15:00', venue: 'Mercedes-Benz Stadium, Atlanta' },
  { code: 'GS-F2', teamA: 'TBD-F3', teamB: 'TBD-F4', group: 'Group F', date: '2026-06-12 18:00', venue: 'Levi\'s Stadium, San Francisco' },

  // Group G
  { code: 'GS-G1', teamA: 'England', teamB: 'TBD-G2', group: 'Group G', date: '2026-06-13 15:00', venue: 'AT&T Stadium, Dallas' },
  { code: 'GS-G2', teamA: 'TBD-G3', teamB: 'TBD-G4', group: 'Group G', date: '2026-06-13 18:00', venue: 'BC Place, Vancouver' },

  // Group H
  { code: 'GS-H1', teamA: 'Germany', teamB: 'TBD-H2', group: 'Group H', date: '2026-06-14 15:00', venue: 'MetLife Stadium, New Jersey' },
  { code: 'GS-H2', teamA: 'TBD-H3', teamB: 'TBD-H4', group: 'Group H', date: '2026-06-14 18:00', venue: 'Arrowhead Stadium, Kansas City' },

  // Knockout stage placeholders
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
console.log(`✅ ${matchCount} World Cup 2026 matches seeded`);

console.log('\n🎉 Database seeded successfully!');
console.log('\n📋 Quick reference:');
console.log('   Admin login: admin');
console.log('   Admin PIN:   station2026');
console.log('   Sample associate login: associate001 through associate200');
console.log('   Sample badge IDs: BADGE001 through BADGE200');
console.log('   Shifts: night (90), early (60), late (50)');
