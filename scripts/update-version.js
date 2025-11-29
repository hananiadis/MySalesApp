#!/usr/bin/env node
// scripts/update-version.js
// Automatically updates version number based on week/year and increments build number

const fs = require('fs');
const path = require('path');

const BASE_VERSION = '0.4';
const BUILD_COUNTER_FILE = path.join(__dirname, '.build-counter.json');
const APP_JSON_PATH = path.join(__dirname, '..', 'app.json');
const BUILD_GRADLE_PATH = path.join(__dirname, '..', 'android', 'app', 'build.gradle');

/**
 * Get ISO week number (1-53) for a given date
 */
function getWeekNumber(date) {
  const target = new Date(date.valueOf());
  const dayNumber = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNumber + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target) / 604800000);
}

/**
 * Get Monday of current week
 */
function getMondayOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
}

/**
 * Load build counter from file
 */
function loadBuildCounter() {
  try {
    if (fs.existsSync(BUILD_COUNTER_FILE)) {
      const data = JSON.parse(fs.readFileSync(BUILD_COUNTER_FILE, 'utf8'));
      return data;
    }
  } catch (error) {
    console.warn('Could not load build counter:', error.message);
  }
  return { weekStart: null, buildNumber: 0, totalBuildNumber: 0 };
}

/**
 * Save build counter to file
 */
function saveBuildCounter(counter) {
  try {
    fs.writeFileSync(BUILD_COUNTER_FILE, JSON.stringify(counter, null, 2));
  } catch (error) {
    console.error('Could not save build counter:', error.message);
  }
}

/**
 * Get next build number for current week
 */
function getNextBuildNumber() {
  const now = new Date();
  const monday = getMondayOfWeek(now);
  const mondayStr = monday.toISOString().split('T')[0];
  
  const counter = loadBuildCounter();
  
  // Always increment total build number
  counter.totalBuildNumber = (counter.totalBuildNumber || 0) + 1;
  
  // Check if it's a new week
  if (counter.weekStart !== mondayStr) {
    // Reset weekly counter for new week
    counter.weekStart = mondayStr;
    counter.buildNumber = 1;
  } else {
    // Increment weekly build number
    counter.buildNumber = (counter.buildNumber || 0) + 1;
  }
  
  saveBuildCounter(counter);
  return { weekly: counter.buildNumber, total: counter.totalBuildNumber };
}

/**
 * Generate version string
 * Format: BASE_VERSION.WEEK.YEAR.BUILD
 * Example: 0.4.47.2025.14 (week 47, year 2025, 14th build this week)
 */
function generateVersion() {
  const now = new Date();
  const week = getWeekNumber(now);
  const year = now.getFullYear();
  const buildNumbers = getNextBuildNumber();
  
  const versionName = `${BASE_VERSION}.${week}.${year}.${buildNumbers.weekly}`;
  
  // versionCode should be unique and always incrementing
  // Use total build number to ensure it never goes backwards
  // Format: YYYYWW + total build number (allows continuous incrementing)
  const baseCode = parseInt(`${year}${week.toString().padStart(2, '0')}`);
  const versionCode = baseCode * 10000 + buildNumbers.total;
  
  return { versionName, versionCode, weeklyBuild: buildNumbers.weekly, totalBuild: buildNumbers.total };
}

/**
 * Update app.json
 */
function updateAppJson(versionName) {
  try {
    const appJson = JSON.parse(fs.readFileSync(APP_JSON_PATH, 'utf8'));
    appJson.expo.version = versionName;
    fs.writeFileSync(APP_JSON_PATH, JSON.stringify(appJson, null, 2) + '\n');
    console.log(`✅ Updated app.json: version = ${versionName}`);
  } catch (error) {
    console.error('❌ Failed to update app.json:', error.message);
  }
}

/**
 * Update android/app/build.gradle
 */
function updateBuildGradle(versionName, versionCode) {
  try {
    let content = fs.readFileSync(BUILD_GRADLE_PATH, 'utf8');
    
    // Update versionCode
    content = content.replace(
      /versionCode\s+\d+/,
      `versionCode ${versionCode}`
    );
    
    // Update versionName
    content = content.replace(
      /versionName\s+"[^"]+"/,
      `versionName "${versionName}"`
    );
    
    fs.writeFileSync(BUILD_GRADLE_PATH, content);
    console.log(`✅ Updated build.gradle: versionCode = ${versionCode}, versionName = ${versionName}`);
  } catch (error) {
    console.error('❌ Failed to update build.gradle:', error.message);
  }
}

/**
 * Main function
 */
function main() {
  console.log('🔄 Updating version...\n');
  
  const { versionName, versionCode, weeklyBuild, totalBuild } = generateVersion();
  
  console.log(`📦 New version: ${versionName}`);
  console.log(`🔢 Version code: ${versionCode}`);
  console.log(`📊 Weekly build: ${weeklyBuild}`);
  console.log(`📈 Total builds: ${totalBuild}\n`);
  
  updateAppJson(versionName);
  updateBuildGradle(versionName, versionCode);
  
  console.log('\n✨ Version update complete!');
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { generateVersion, getWeekNumber };
