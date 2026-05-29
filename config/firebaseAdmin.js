// config/firebaseAdmin.js
require('dotenv').config();

let _admin = null;
let _db = null;
let _auth = null;

function setFirebaseInstances({ admin, db, auth }) {
  _admin = admin;
  _db = db;
  _auth = auth;
}

function getDb() {
  if (!_db) throw new Error('Firebase DB belum siap.');
  return _db;
}
function getAuth() {
  if (!_auth) throw new Error('Firebase Auth belum siap.');
  return _auth;
}
function getAdmin() {
  if (!_admin) throw new Error('Firebase Admin belum siap.');
  return _admin;
}

module.exports = {
  setFirebaseInstances,
  get db() { return getDb(); },
  get auth() { return getAuth(); },
  get admin() { return getAdmin(); }
};