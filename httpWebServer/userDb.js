const Database = require('better-sqlite3')
const bcrypt = require('bcrypt')
const path = require('path')

const SALT_ROUNDS = 10
const DB_PATH = process.env.USER_DB_PATH || path.join(__dirname, 'users.sqlite')

let db = null

function init() {
    db = new Database(DB_PATH)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')

    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            email       TEXT UNIQUE NOT NULL,
            password    TEXT NOT NULL,
            tier        TEXT NOT NULL DEFAULT 'free',
            created_at  TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
        )
    `)

    db.exec(`
        CREATE TABLE IF NOT EXISTS user_subscriptions (
            user_id     INTEGER NOT NULL,
            device_id   TEXT NOT NULL,
            subscriptions TEXT NOT NULL DEFAULT '{}',
            updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
            PRIMARY KEY (user_id, device_id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `)

    return db
}

function register(email, password) {
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
    if (existing) {
        return { success: false, reason: 'Email already registered' }
    }

    const hash = bcrypt.hashSync(password, SALT_ROUNDS)
    const result = db.prepare('INSERT INTO users (email, password) VALUES (?, ?)').run(email, hash)
    return { success: true, userId: result.lastInsertRowid }
}

function authenticate(email, password) {
    const user = db.prepare('SELECT id, email, password, tier FROM users WHERE email = ?').get(email)
    if (!user) {
        return { success: false, reason: 'Invalid email or password' }
    }

    if (!bcrypt.compareSync(password, user.password)) {
        return { success: false, reason: 'Invalid email or password' }
    }

    return { success: true, userId: user.id, email: user.email, tier: user.tier }
}

function updateTier(email, tier) {
    const result = db.prepare("UPDATE users SET tier = ?, updated_at = datetime('now') WHERE email = ?").run(tier, email)
    return result.changes > 0
}

function saveDeviceSubscriptions(userId, deviceId, subscriptions) {
    const json = JSON.stringify(subscriptions)
    db.prepare(`INSERT INTO user_subscriptions (user_id, device_id, subscriptions, updated_at)
                VALUES (?, ?, ?, datetime('now'))
                ON CONFLICT(user_id, device_id) DO UPDATE SET subscriptions = excluded.subscriptions, updated_at = excluded.updated_at`
    ).run(userId, deviceId, json)
}

function getDeviceSubscriptions(userId, deviceId) {
    const row = db.prepare('SELECT subscriptions FROM user_subscriptions WHERE user_id = ? AND device_id = ?').get(userId, deviceId)
    if (!row) return null
    try { return JSON.parse(row.subscriptions) } catch (_) { return null }
}

function getUserById(userId) {
    return db.prepare('SELECT id, email, tier FROM users WHERE id = ?').get(userId) || null
}

function changePassword(userId, currentPassword, newPassword) {
    const user = db.prepare('SELECT id, password FROM users WHERE id = ?').get(userId)
    if (!user) {
        return { success: false, reason: 'User not found' }
    }
    if (!bcrypt.compareSync(currentPassword, user.password)) {
        return { success: false, reason: 'Current password is incorrect' }
    }
    const hash = bcrypt.hashSync(newPassword, SALT_ROUNDS)
    db.prepare("UPDATE users SET password = ?, updated_at = datetime('now') WHERE id = ?").run(hash, userId)
    return { success: true }
}

module.exports = { init, register, authenticate, updateTier, saveDeviceSubscriptions, getDeviceSubscriptions, getUserById, changePassword }
