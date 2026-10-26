//! Nusa feature merge: water reminder, file shelf, to-do + reminder, lyrics sync.
//!
//! Persistence lives in a `data.json` next to `settings.json` (per-user data, not
//! config). Reminders are driven by a background scheduler that emits events the
//! notch listens to. Lyrics come from the LRCLIB public API with an in-memory
//! per-track cache; failures degrade silently.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter, Manager};

// ── now helper ──

fn now_ms() -> i64 {
    crate::utils::get_now_ms()
}

// ── data.json store ──

#[derive(Default, Serialize, Deserialize, Clone)]
#[serde(default)]
pub struct ShelfItem {
    pub id: String,
    pub path: String,
    pub name: String,
    pub added_at: i64,
}

#[derive(Default, Serialize, Deserialize, Clone)]
#[serde(default)]
pub struct TodoItem {
    pub id: String,
    pub text: String,
    /// Epoch ms; 0 means no due time.
    pub due_at: i64,
    pub done: bool,
    pub notified: bool,
}

#[derive(Default, Serialize, Deserialize, Clone)]
#[serde(default)]
pub struct FeatureData {
    /// "YYYY-MM-DD" → ml consumed.
    pub water_log: HashMap<String, u32>,
    pub shelf: Vec<ShelfItem>,
    pub todos: Vec<TodoItem>,
}

static DATA_CACHE: OnceLock<Mutex<FeatureData>> = OnceLock::new();

fn data_cache() -> &'static Mutex<FeatureData> {
    DATA_CACHE.get_or_init(|| Mutex::new(FeatureData::default()))
}

fn data_path(app: &AppHandle) -> Option<std::path::PathBuf> {
    app.path().app_config_dir().ok().map(|p| p.join("data.json"))
}

/// Load data.json into the cache once at startup. A corrupt or missing file
/// yields an empty store and is never fatal.
pub fn init_data_store(app: &AppHandle) {
    if let Some(path) = data_path(app) {
        if let Ok(content) = std::fs::read_to_string(&path) {
            if let Ok(data) = serde_json::from_str::<FeatureData>(&content) {
                if let Ok(mut cache) = data_cache().lock() {
                    *cache = data;
                }
            }
        }
    }
    prune_water_log();
}

fn save_data(app: &AppHandle) {
    let snapshot = match data_cache().lock() {
        Ok(guard) => guard.clone(),
        Err(_) => return,
    };
    if let Some(path) = data_path(app) {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Ok(content) = serde_json::to_string_pretty(&snapshot) {
            let _ = std::fs::write(path, content);
        }
    }
}

fn prune_water_log() {
    // Keep the last 30 days of entries.
    if let Ok(mut cache) = data_cache().lock() {
        if cache.water_log.len() <= 30 {
            return;
        }
        let mut keys: Vec<String> = cache.water_log.keys().cloned().collect();
        keys.sort(); // ISO dates sort chronologically
        let cutoff = keys.len() - 30;
        for k in keys.into_iter().take(cutoff) {
            cache.water_log.remove(&k);
        }
    }
}

/// Local date key "YYYY-MM-DD" from a UTC epoch-ms input, using the machine's
/// local timezone via chrono.
fn today_key() -> String {
    use chrono::Local;
    Local::now().format("%Y-%m-%d").to_string()
}

// ── water commands ──

#[derive(Serialize, Clone)]
pub struct WaterState {
    pub today_ml: u32,
    pub goal_ml: u32,
    pub increment_ml: u32,
    /// Oldest-first last 7 days: [{ date, ml }].
    pub week: Vec<WaterDay>,
    pub streak_days: u32,
}

#[derive(Serialize, Clone)]
pub struct WaterDay {
    pub date: String,
    pub ml: u32,
}

fn setting_u32(app: &AppHandle, key: &str, default: u32) -> u32 {
    crate::utils::get_setting_str(app, key)
        .and_then(|s| s.parse::<u32>().ok())
        .unwrap_or(default)
}

#[tauri::command]
pub fn water_state(app: AppHandle) -> WaterState {
    let goal = setting_u32(&app, "nectar-water-goal-ml", 1500);
    let increment = setting_u32(&app, "nectar-water-increment-ml", 250);
    let today = today_key();
    let cache = data_cache().lock().ok();
    let today_ml = cache.as_ref().and_then(|c| c.water_log.get(&today).copied()).unwrap_or(0);

    // Build last-7-day view (oldest first).
    let mut week: Vec<WaterDay> = Vec::new();
    let mut streak: u32 = 0;
    if let Some(cache) = cache.as_ref() {
        for i in (0..7).rev() {
            let date = offset_date_key(-i);
            let ml = cache.water_log.get(&date).copied().unwrap_or(0);
            week.push(WaterDay { date, ml });
        }
        // Streak: consecutive days (ending today or yesterday) meeting goal.
        let mut j = 0i64;
        loop {
            let date = offset_date_key(-j);
            let ml = cache.water_log.get(&date).copied().unwrap_or(0);
            if ml >= goal {
                streak += 1;
            } else if j == 0 {
                // Today not yet met: streak may still count from yesterday.
            } else {
                break;
            }
            j += 1;
            if j > 365 {
                break;
            }
            // Stop if we walked past a day that had no entry at all and it wasn't today.
            if ml == 0 && j > 1 {
                break;
            }
        }
    }

    WaterState { today_ml, goal_ml: goal, increment_ml: increment, week, streak_days: streak }
}

/// "YYYY-MM-DD" for `offset` days from today (negative = past).
fn offset_date_key(offset_days: i64) -> String {
    use chrono::{Duration, Local};
    let dt = Local::now().checked_add_signed(Duration::days(offset_days));
    match dt {
        Some(d) => d.format("%Y-%m-%d").to_string(),
        None => today_key(),
    }
}

#[tauri::command]
pub fn water_drink(app: AppHandle, ml: Option<u32>) -> WaterState {
    let increment = ml.unwrap_or_else(|| setting_u32(&app, "nectar-water-increment-ml", 250));
    let today = today_key();
    if let Ok(mut cache) = data_cache().lock() {
        *cache.water_log.entry(today).or_insert(0) += increment;
    }
    save_data(&app);
    water_state(app)
}

#[tauri::command]
pub fn water_undo(app: AppHandle) -> WaterState {
    let decrement = setting_u32(&app, "nectar-water-increment-ml", 250);
    let today = today_key();
    if let Ok(mut cache) = data_cache().lock() {
        if let Some(entry) = cache.water_log.get_mut(&today) {
            *entry = entry.saturating_sub(decrement);
        }
    }
    save_data(&app);
    water_state(app)
}

#[tauri::command]
pub fn water_reset_today(app: AppHandle) -> WaterState {
    let today = today_key();
    if let Ok(mut cache) = data_cache().lock() {
        cache.water_log.remove(&today);
    }
    save_data(&app);
    water_state(app)
}

// ── shelf commands ──

#[tauri::command]
pub fn shelf_list(app: AppHandle) -> Vec<ShelfItem> {
    let _ = &app;
    data_cache()
        .lock()
        .map(|c| c.shelf.clone())
        .unwrap_or_default()
}

#[tauri::command]
pub fn shelf_add(app: AppHandle, path: String) -> Result<Vec<ShelfItem>, String> {
    let max = setting_u32(&app, "nectar-shelf-max-items", 12) as usize;
    let name = std::path::Path::new(&path)
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());
    // Dedup by path.
    if let Ok(mut cache) = data_cache().lock() {
        if cache.shelf.iter().any(|i| i.path == path) {
            return Ok(cache.shelf.clone());
        }
        cache.shelf.push(ShelfItem {
            id: new_id(),
            path,
            name,
            added_at: now_ms(),
        });
        while cache.shelf.len() > max {
            cache.shelf.remove(0);
        }
    }
    save_data(&app);
    Ok(shelf_list(app))
}

#[tauri::command]
pub fn shelf_remove(app: AppHandle, id: String) -> Vec<ShelfItem> {
    if let Ok(mut cache) = data_cache().lock() {
        cache.shelf.retain(|i| i.id != id);
    }
    save_data(&app);
    shelf_list(app)
}

#[tauri::command]
pub fn shelf_reveal(app: AppHandle, path: String) -> Result<(), String> {
    let _ = &app;
    if !std::path::Path::new(&path).exists() {
        return Err("File no longer exists".into());
    }
    std::process::Command::new("explorer")
        .arg(format!("/select,{}", path))
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ── todo commands ──

#[tauri::command]
pub fn todo_list(app: AppHandle) -> Vec<TodoItem> {
    let _ = &app;
    data_cache()
        .lock()
        .map(|c| c.todos.clone())
        .unwrap_or_default()
}

#[tauri::command]
pub fn todo_add(app: AppHandle, text: String, due_at: Option<i64>) -> Vec<TodoItem> {
    let text = text.trim().to_string();
    if text.is_empty() {
        return todo_list(app);
    }
    if let Ok(mut cache) = data_cache().lock() {
        cache.todos.push(TodoItem {
            id: new_id(),
            text,
            due_at: due_at.unwrap_or(0),
            done: false,
            notified: false,
        });
    }
    save_data(&app);
    todo_list(app)
}

#[tauri::command]
pub fn todo_toggle(app: AppHandle, id: String) -> Vec<TodoItem> {
    if let Ok(mut cache) = data_cache().lock() {
        if let Some(t) = cache.todos.iter_mut().find(|t| t.id == id) {
            t.done = !t.done;
        }
    }
    save_data(&app);
    todo_list(app)
}

#[tauri::command]
pub fn todo_remove(app: AppHandle, id: String) -> Vec<TodoItem> {
    if let Ok(mut cache) = data_cache().lock() {
        cache.todos.retain(|t| t.id != id);
    }
    save_data(&app);
    todo_list(app)
}

fn new_id() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let t = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
    format!("{}{}", t.as_millis(), t.subsec_nanos())
}

// ── lyrics: LRC parser ──

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq)]
pub struct LyricLine {
    pub time_ms: i64,
    pub text: String,
}

/// Parse LRC text into timestamped lines. Supports multiple timestamps per
/// line and both `[mm:ss.xx]` and `[mm:ss.xxx]` and `[mm:ss]` forms. Lines
/// without a timestamp are skipped. Result is sorted by time.
pub fn parse_lrc(lrc: &str) -> Vec<LyricLine> {
    let mut out: Vec<LyricLine> = Vec::new();
    for raw in lrc.lines() {
        let line = raw.trim();
        if line.is_empty() {
            continue;
        }
        // Collect leading [tag]s until the text begins.
        let mut rest = line;
        let mut times: Vec<i64> = Vec::new();
        while let Some(stripped) = rest.strip_prefix('[') {
            match stripped.find(']') {
                Some(end) => {
                    let tag = &stripped[..end];
                    rest = stripped[end + 1..].trim_start();
                    if let Some(ms) = parse_time_tag(tag) {
                        times.push(ms);
                    }
                    // else: metadata tag like ti:/ar:, skip.
                }
                None => break,
            }
        }
        let text = rest.trim();
        for t in times {
            out.push(LyricLine { time_ms: t, text: text.to_string() });
        }
    }
    out.sort_by_key(|l| l.time_ms);
    out
}

fn parse_time_tag(tag: &str) -> Option<i64> {
    // Forms: mm:ss, mm:ss.xx, mm:ss.xxx
    let parts: Vec<&str> = tag.split(':').collect();
    if parts.len() != 2 {
        return None;
    }
    let minutes: i64 = parts[0].trim().parse().ok()?;
    let sec_part = parts[1].trim();
    let (sec_str, frac_str) = match sec_part.find('.') {
        Some(dot) => (&sec_part[..dot], &sec_part[dot + 1..]),
        None => (sec_part, ""),
    };
    let seconds: i64 = sec_str.parse().ok()?;
    let frac_ms: i64 = if frac_str.is_empty() {
        0
    } else {
        // Normalize fraction to milliseconds.
        let frac = frac_str.parse::<i64>().ok()?;
        match frac_str.len() {
            0 => 0,
            1 => frac * 100,
            2 => frac * 10,
            _ => frac, // 3+ digits already ms (truncate beyond)
        }
    };
    Some(minutes * 60_000 + seconds * 1000 + frac_ms)
}

// ── lyrics: LRCLIB client ──

#[derive(Serialize, Clone)]
pub struct LyricsResult {
    pub synced: bool,
    pub lines: Vec<LyricLine>,
}

struct CacheEntry {
    result: LyricsResult,
    at: i64,
}

static LYRICS_CACHE: OnceLock<Mutex<HashMap<String, CacheEntry>>> = OnceLock::new();

fn lyrics_cache() -> &'static Mutex<HashMap<String, CacheEntry>> {
    LYRICS_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

/// Fetch lyrics for a track. Uses `/api/get` with track name/artist/duration,
/// falling back to `/api/search` when duration is unknown. Returns
/// `synced: false` with plain lines (or empty) on any failure — never errors.
#[tauri::command]
pub async fn lyrics_get(
    title: String,
    artist: String,
    duration_ms: Option<i64>,
) -> LyricsResult {
    let cache_key = format!("{}|{}|{}", title.to_lowercase(), artist.to_lowercase(), duration_ms.unwrap_or(0));
    // Serve from cache when fresh (< 10 min).
    if let Ok(cache) = lyrics_cache().lock() {
        if let Some(entry) = cache.get(&cache_key) {
            if now_ms() - entry.at < 600_000 {
                return entry.result.clone();
            }
        }
    }

    let result = fetch_lrclib(&title, &artist, duration_ms).await;

    if let Ok(mut cache) = lyrics_cache().lock() {
        cache.insert(cache_key, CacheEntry { result: result.clone(), at: now_ms() });
    }
    result
}

async fn fetch_lrclib(title: &str, artist: &str, duration_ms: Option<i64>) -> LyricsResult {
    let client = match reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(6))
        .user_agent("Nectar/1.4 (lyrics)")
        .build()
    {
        Ok(c) => c,
        Err(_) => return LyricsResult { synced: false, lines: Vec::new() },
    };

    // Try the precise /api/get when we have a duration.
    if let Some(dur) = duration_ms {
        if dur > 0 {
            let secs = (dur / 1000) as u64;
            let url = format!(
                "https://lrclib.net/api/get?track_name={}&artist_name={}&album_name=&duration={}",
                encode(title),
                encode(artist),
                secs
            );
            if let Ok(resp) = client.get(&url).send().await {
                if resp.status().is_success() {
                    if let Ok(text) = resp.text().await {
                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) {
                            if let Some(res) = from_lrclib_json(&json) {
                                return res;
                            }
                        }
                    }
                }
            }
        }
    }

    // Fallback: search by track + artist, pick closest duration match.
    let url = format!(
        "https://lrclib.net/api/search?track_name={}&artist_name={}",
        encode(title),
        encode(artist)
    );
    if let Ok(resp) = client.get(&url).send().await {
        if resp.status().is_success() {
            if let Ok(text) = resp.text().await {
                if let Ok(arr) = serde_json::from_str::<serde_json::Value>(&text) {
                    if let Some(list) = arr.as_array() {
                        let mut best: Option<&serde_json::Value> = None;
                        let mut best_delta = i64::MAX;
                        let target = duration_ms.unwrap_or(0);
                        for item in list {
                            let synced = item.get("syncedLyrics").and_then(|v| v.as_str()).unwrap_or("");
                            if synced.is_empty() {
                                continue;
                            }
                            let dur = item.get("duration").and_then(|v| v.as_i64()).unwrap_or(0) * 1000;
                            let delta = if target > 0 { (dur - target).abs() } else { 0 };
                            if delta < best_delta {
                                best_delta = delta;
                                best = Some(item);
                            }
                        }
                        if let Some(item) = best {
                            if let Some(res) = from_lrclib_json(item) {
                                return res;
                            }
                        }
                    }
                }
            }
        }
    }

    LyricsResult { synced: false, lines: Vec::new() }
}

fn from_lrclib_json(json: &serde_json::Value) -> Option<LyricsResult> {
    if let Some(synced) = json.get("syncedLyrics").and_then(|v| v.as_str()) {
        if !synced.is_empty() {
            let lines = parse_lrc(synced);
            if !lines.is_empty() {
                return Some(LyricsResult { synced: true, lines });
            }
        }
    }
    if let Some(plain) = json.get("plainLyrics").and_then(|v| v.as_str()) {
        if !plain.is_empty() {
            let lines: Vec<LyricLine> = plain
                .lines()
                .filter(|l| !l.trim().is_empty())
                .map(|l| LyricLine { time_ms: -1, text: l.trim().to_string() })
                .collect();
            if !lines.is_empty() {
                return Some(LyricsResult { synced: false, lines });
            }
        }
    }
    None
}

fn encode(s: &str) -> String {
    let mut out = String::with_capacity(s.len());
    for c in s.chars() {
        match c {
            'A'..='Z' | 'a'..='z' | '0'..='9' | '-' | '_' | '.' | '~' => out.push(c),
            ' ' => out.push_str("%20"),
            _ => {
                for b in c.encode_utf8(&mut [0u8; 4]).as_bytes() {
                    out.push_str(&format!("%{:02X}", b));
                }
            }
        }
    }
    out
}

// ── reminder scheduler ──

/// Events emitted to the frontend:
/// - `nusa-reminder` with `{ kind: "water" }` or `{ kind: "todo", text, id }`.
///
/// Runs only while the app runs. Missed windows are skipped (no catch-up).
pub fn start_reminder_scheduler(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let mut last_water_fired_ms: i64 = 0;
        let mut snoozed_until_ms: i64 = 0;
        tokio::time::sleep(std::time::Duration::from_secs(15)).await;
        loop {
            tick_water(&app, &mut last_water_fired_ms, &mut snoozed_until_ms);
            tick_todos(&app);
            tokio::time::sleep(std::time::Duration::from_secs(30)).await;
        }
    });
}

fn setting_bool(app: &AppHandle, key: &str, default: bool) -> bool {
    crate::utils::get_setting_str(app, key)
        .map(|v| v == "true")
        .unwrap_or(default)
}

/// Parse "HH:MM" into minutes-since-midnight; default when absent/invalid.
fn parse_hhmm(s: Option<&str>, default: (i64, i64)) -> i64 {
    match s.and_then(|s| {
        let mut it = s.split(':');
        let h: i64 = it.next()?.trim().parse().ok()?;
        let m: i64 = it.next()?.trim().parse().ok()?;
        Some(h * 60 + m)
    }) {
        Some(v) => v,
        None => default.0 * 60 + default.1,
    }
}

fn tick_water(app: &AppHandle, last_fired: &mut i64, snoozed_until: &mut i64) {
    if !setting_bool(app, "nectar-water-enabled", true) {
        return;
    }
    let now = now_ms();
    if now < *snoozed_until {
        return;
    }

    // Awake window in local minutes-since-midnight.
    let (now_hour, now_min) = local_hhmm();
    let now_minutes = now_hour * 60 + now_min;
    let start = parse_hhmm(crate::utils::get_setting_str(app, "nectar-water-awake-start").as_deref(), (9, 0));
    let end = parse_hhmm(crate::utils::get_setting_str(app, "nectar-water-awake-end").as_deref(), (21, 0));
    if now_minutes < start || now_minutes > end {
        return;
    }

    let interval_min = setting_u32(app, "nectar-water-interval-min", 60) as i64;
    if *last_fired != 0 && now - *last_fired < interval_min * 60_000 {
        return;
    }

    // Only remind when today's total is below goal.
    let goal = setting_u32(app, "nectar-water-goal-ml", 1500);
    let today = today_key();
    let today_ml = data_cache()
        .lock()
        .ok()
        .and_then(|c| c.water_log.get(&today).copied())
        .unwrap_or(0);
    if today_ml >= goal {
        return;
    }

    *last_fired = now;
    let _ = app.emit("nusa-reminder", serde_json::json!({ "kind": "water" }));
}

fn local_hhmm() -> (i64, i64) {
    use chrono::{Local, Timelike};
    let now = Local::now();
    (now.hour() as i64, now.minute() as i64)
}

fn tick_todos(app: &AppHandle) {
    if !setting_bool(app, "nectar-todo-enabled", true) {
        return;
    }
    let now = now_ms();
    let mut fired: Vec<(String, String)> = Vec::new();
    if let Ok(mut cache) = data_cache().lock() {
        for t in cache.todos.iter_mut() {
            if !t.done && !t.notified && t.due_at > 0 && now >= t.due_at {
                t.notified = true;
                fired.push((t.id.clone(), t.text.clone()));
            }
        }
    }
    if !fired.is_empty() {
        save_data(app);
        for (id, text) in fired {
            let _ = app.emit(
                "nusa-reminder",
                serde_json::json!({ "kind": "todo", "id": id, "text": text }),
            );
        }
    }
}

// ── tests ──

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_lrc_basic() {
        let lrc = "[00:12.50]first line\n[00:17.30]second line\n";
        let lines = parse_lrc(lrc);
        assert_eq!(lines.len(), 2);
        assert_eq!(lines[0].time_ms, 12_500);
        assert_eq!(lines[0].text, "first line");
        assert_eq!(lines[1].time_ms, 17_300);
    }

    #[test]
    fn parse_lrc_multi_timestamp_and_sorts() {
        let lrc = "[00:30.00][01:10.00]chorus\n[00:05.00]intro\n";
        let lines = parse_lrc(lrc);
        assert_eq!(lines.len(), 3);
        assert_eq!(lines[0].time_ms, 5_000);
        assert_eq!(lines[1].time_ms, 30_000);
        assert_eq!(lines[2].time_ms, 70_000);
        assert_eq!(lines[1].text, "chorus");
        assert_eq!(lines[2].text, "chorus");
    }

    #[test]
    fn parse_lrc_metadata_and_plain_skipped() {
        let lrc = "[ti:Song Title]\n[ar:Artist]\nplain line without time\n[00:01.00]timed\n";
        let lines = parse_lrc(lrc);
        assert_eq!(lines.len(), 1);
        assert_eq!(lines[0].text, "timed");
        assert_eq!(lines[0].time_ms, 1_000);
    }

    #[test]
    fn parse_time_tag_forms() {
        assert_eq!(parse_time_tag("01:02"), Some(62_000));
        assert_eq!(parse_time_tag("01:02.3"), Some(62_300));
        assert_eq!(parse_time_tag("01:02.34"), Some(62_340));
        assert_eq!(parse_time_tag("01:02.345"), Some(62_345));
        assert_eq!(parse_time_tag("bad"), None);
    }

    #[test]
    fn encode_url_safe() {
        assert_eq!(encode("a b"), "a%20b");
        assert_eq!(encode("Hello-World_1.0~x"), "Hello-World_1.0~x");
        assert_eq!(encode("café"), "caf%C3%A9");
    }
}
