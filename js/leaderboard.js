/**
 * Local storage leaderboard.
 * Stores top scores with pilot callsign, score, and date.
 */

const STORAGE_KEY = 'airborne_challenge_leaderboard';
const MAX_ENTRIES = 20;

export function getEntries() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export function addEntry(callsign, score, time) {
    const entries = getEntries();
    entries.push({
        callsign: callsign.trim() || 'ANON',
        score,
        time: Math.round(time || 0),
        date: new Date().toISOString().slice(0, 10),
    });
    entries.sort((a, b) => b.score - a.score);
    if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    return entries;
}

export function getRank(score) {
    const entries = getEntries();
    let rank = 1;
    for (const e of entries) {
        if (e.score > score) rank++;
        else break;
    }
    return rank;
}
