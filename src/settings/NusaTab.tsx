import { Droplets, FileStack, ListTodo, Music, Sunrise, Sunset, Target, Plus, Timer } from "lucide-react";
import { SettingRow } from "./SettingRow";

interface NusaTabProps {
  nusaLyricsEnabled: boolean;
  toggleNusaLyrics: () => void;
  nusaWaterEnabled: boolean;
  toggleNusaWater: () => void;
  nusaShelfEnabled: boolean;
  toggleNusaShelf: () => void;
  nusaTodoEnabled: boolean;
  toggleNusaTodo: () => void;
  waterGoalMl: number;
  handleWaterGoalChange: (val: number) => void;
  waterIncrementMl: number;
  handleWaterIncrementChange: (val: number) => void;
  waterIntervalMin: number;
  handleWaterIntervalChange: (val: number) => void;
  waterAwakeStart: string;
  handleWaterAwakeStartChange: (val: string) => void;
  waterAwakeEnd: string;
  handleWaterAwakeEndChange: (val: string) => void;
  shelfMaxItems: number;
  handleShelfMaxChange: (val: number) => void;
}

export function NusaTab({
  nusaLyricsEnabled,
  toggleNusaLyrics,
  nusaWaterEnabled,
  toggleNusaWater,
  nusaShelfEnabled,
  toggleNusaShelf,
  nusaTodoEnabled,
  toggleNusaTodo,
  waterGoalMl,
  handleWaterGoalChange,
  waterIncrementMl,
  handleWaterIncrementChange,
  waterIntervalMin,
  handleWaterIntervalChange,
  waterAwakeStart,
  handleWaterAwakeStartChange,
  waterAwakeEnd,
  handleWaterAwakeEndChange,
  shelfMaxItems,
  handleShelfMaxChange,
}: NusaTabProps) {
  return (
    <>
      <div className="setting-group-label">Features</div>
      <div className="setting-group">
        <SettingRow icon={Music} label="Synced Lyrics" desc="Show lyrics synced to the current track in the notch (requires internet)">
          <label className="toggle-switch">
            <input type="checkbox" checked={nusaLyricsEnabled} onChange={toggleNusaLyrics} />
            <span className="slider"></span>
          </label>
        </SettingRow>

        <SettingRow icon={Droplets} label="Water Reminder" desc="Track daily water intake with a ring and reminders">
          <label className="toggle-switch">
            <input type="checkbox" checked={nusaWaterEnabled} onChange={toggleNusaWater} />
            <span className="slider"></span>
          </label>
        </SettingRow>

        <SettingRow icon={FileStack} label="File Shelf" desc="Pin frequently used files to a quick-access shelf in the notch">
          <label className="toggle-switch">
            <input type="checkbox" checked={nusaShelfEnabled} onChange={toggleNusaShelf} />
            <span className="slider"></span>
          </label>
        </SettingRow>

        <SettingRow icon={ListTodo} label="To-Do & Reminders" desc="Quick to-do list with due-time reminders">
          <label className="toggle-switch">
            <input type="checkbox" checked={nusaTodoEnabled} onChange={toggleNusaTodo} />
            <span className="slider"></span>
          </label>
        </SettingRow>
      </div>

      {nusaWaterEnabled && (
        <>
          <div className="setting-group-label">Water Reminder Settings</div>
          <div className="setting-group">
            <SettingRow icon={Target} label="Daily Goal" desc={`${(waterGoalMl / 1000).toFixed(1)} L per day`}>
              <input
                type="range"
                min="500"
                max="4000"
                step="100"
                value={waterGoalMl}
                onChange={(e) => handleWaterGoalChange(parseInt(e.target.value))}
                className="settings-slider"
              />
            </SettingRow>

            <SettingRow icon={Plus} label="Increment" desc={`Add ${waterIncrementMl} ml per drink`}>
              <input
                type="range"
                min="100"
                max="500"
                step="50"
                value={waterIncrementMl}
                onChange={(e) => handleWaterIncrementChange(parseInt(e.target.value))}
                className="settings-slider"
              />
            </SettingRow>

            <SettingRow icon={Timer} label="Reminder Interval" desc={`Remind every ${waterIntervalMin} minutes`}>
              <input
                type="range"
                min="15"
                max="180"
                step="15"
                value={waterIntervalMin}
                onChange={(e) => handleWaterIntervalChange(parseInt(e.target.value))}
                className="settings-slider"
              />
            </SettingRow>

            <SettingRow icon={Sunrise} label="Awake Start" desc="No reminders before this time">
              <input
                type="time"
                value={waterAwakeStart}
                onChange={(e) => handleWaterAwakeStartChange(e.target.value)}
                className="nusa-time-input"
              />
            </SettingRow>

            <SettingRow icon={Sunset} label="Awake End" desc="No reminders after this time" divider={false}>
              <input
                type="time"
                value={waterAwakeEnd}
                onChange={(e) => handleWaterAwakeEndChange(e.target.value)}
                className="nusa-time-input"
              />
            </SettingRow>
          </div>
        </>
      )}

      {nusaShelfEnabled && (
        <>
          <div className="setting-group-label">File Shelf Settings</div>
          <div className="setting-group">
            <SettingRow icon={FileStack} label="Max Items" desc={`Show up to ${shelfMaxItems} pinned files`} divider={false}>
              <input
                type="range"
                min="4"
                max="24"
                step="2"
                value={shelfMaxItems}
                onChange={(e) => handleShelfMaxChange(parseInt(e.target.value))}
                className="settings-slider"
              />
            </SettingRow>
          </div>
        </>
      )}

      <style>{`
        .nusa-time-input {
          background: color-mix(in srgb, var(--nectar-text, white) 10%, transparent);
          border: 1px solid color-mix(in srgb, var(--nectar-text, white) 12%, transparent);
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 12px;
          color: var(--nectar-text, white);
          outline: none;
        }
        .nusa-time-input:focus { border-color: #2d6bff; }
        .nusa-time-input::-webkit-calendar-picker-indicator { filter: invert(0.8); }
      `}</style>
    </>
  );
}
