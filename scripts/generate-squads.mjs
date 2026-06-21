#!/usr/bin/env node
// scripts/generate-squads.mjs
// Descarga squads de jfjelstul/worldcup (1930-2022) y genera JSONs para DraftXI
// Jugadores famosos usan ratings curados; el resto usa generación algorítmica
// Uso: node scripts/generate-squads.mjs [--force] [--year 1970] [--team BRA]

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')
const DATA_DIR = path.join(ROOT, 'public', 'data', 'tournaments', 'world-cup')

const CSV_BASE = 'https://raw.githubusercontent.com/jfjelstul/worldcup/master/data-csv'

const ARGS = process.argv.slice(2)
const FORCE = ARGS.includes('--force')
const YEAR_FILTER  = ARGS.includes('--year') ? parseInt(ARGS[ARGS.indexOf('--year') + 1]) : null
const TEAM_FILTER  = ARGS.includes('--team') ? ARGS[ARGS.indexOf('--team') + 1].toUpperCase() : null

// Años del Mundial Masculino (los del CSV que nos interesan)
const MENS_WC_YEARS = new Set([1930,1934,1938,1950,1954,1958,1962,1966,1970,1974,1978,1982,1986,1990,1994,1998,2002,2006,2010,2014,2018,2022])

// ============================================================
// MAPEO PAÍSES — claves en ISO alpha-3 (como usa jfjelstul)
// ============================================================
const TEAM_MAP = {
  BRA: { name: 'Brasil',             conf: 'CONMEBOL' },
  ARG: { name: 'Argentina',           conf: 'CONMEBOL' },
  URY: { name: 'Uruguay',             conf: 'CONMEBOL' },
  COL: { name: 'Colombia',            conf: 'CONMEBOL' },
  CHL: { name: 'Chile',               conf: 'CONMEBOL' },
  PRY: { name: 'Paraguay',            conf: 'CONMEBOL' },
  PER: { name: 'Perú',                conf: 'CONMEBOL' },
  ECU: { name: 'Ecuador',             conf: 'CONMEBOL' },
  BOL: { name: 'Bolivia',             conf: 'CONMEBOL' },
  VEN: { name: 'Venezuela',           conf: 'CONMEBOL' },
  DEU: { name: 'Alemania',            conf: 'UEFA' },
  DDR: { name: 'Alemania Oriental',   conf: 'UEFA' },
  FRA: { name: 'Francia',             conf: 'UEFA' },
  ENG: { name: 'Inglaterra',          conf: 'UEFA' },
  ESP: { name: 'España',              conf: 'UEFA' },
  ITA: { name: 'Italia',              conf: 'UEFA' },
  NLD: { name: 'Países Bajos',        conf: 'UEFA' },
  PRT: { name: 'Portugal',            conf: 'UEFA' },
  BEL: { name: 'Bélgica',             conf: 'UEFA' },
  HRV: { name: 'Croacia',             conf: 'UEFA' },
  SCO: { name: 'Escocia',             conf: 'UEFA' },
  SWE: { name: 'Suecia',              conf: 'UEFA' },
  DNK: { name: 'Dinamarca',           conf: 'UEFA' },
  CZE: { name: 'Rep. Checa',          conf: 'UEFA' },
  CSK: { name: 'Checoslovaquia',      conf: 'UEFA' },
  POL: { name: 'Polonia',             conf: 'UEFA' },
  RUS: { name: 'Rusia',               conf: 'UEFA' },
  SUN: { name: 'Unión Soviética',     conf: 'UEFA' },
  CHE: { name: 'Suiza',               conf: 'UEFA' },
  AUT: { name: 'Austria',             conf: 'UEFA' },
  HUN: { name: 'Hungría',             conf: 'UEFA' },
  ROU: { name: 'Rumanía',             conf: 'UEFA' },
  BGR: { name: 'Bulgaria',            conf: 'UEFA' },
  YUG: { name: 'Yugoslavia',          conf: 'UEFA' },
  SRB: { name: 'Serbia',              conf: 'UEFA' },
  SCG: { name: 'Serbia y Montenegro', conf: 'UEFA' },
  UKR: { name: 'Ucrania',             conf: 'UEFA' },
  WAL: { name: 'Gales',               conf: 'UEFA' },
  NOR: { name: 'Noruega',             conf: 'UEFA' },
  TUR: { name: 'Turquía',             conf: 'UEFA' },
  GRC: { name: 'Grecia',              conf: 'UEFA' },
  NIR: { name: 'Irlanda del Norte',   conf: 'UEFA' },
  IRL: { name: 'Irlanda',             conf: 'UEFA' },
  SVK: { name: 'Eslovaquia',          conf: 'UEFA' },
  SVN: { name: 'Eslovenia',           conf: 'UEFA' },
  ISL: { name: 'Islandia',            conf: 'UEFA' },
  MEX: { name: 'México',              conf: 'CONCACAF' },
  USA: { name: 'Estados Unidos',      conf: 'CONCACAF' },
  CRI: { name: 'Costa Rica',          conf: 'CONCACAF' },
  HND: { name: 'Honduras',            conf: 'CONCACAF' },
  SLV: { name: 'El Salvador',         conf: 'CONCACAF' },
  JAM: { name: 'Jamaica',             conf: 'CONCACAF' },
  TTO: { name: 'Trinidad y Tobago',   conf: 'CONCACAF' },
  CAN: { name: 'Canadá',              conf: 'CONCACAF' },
  PAN: { name: 'Panamá',              conf: 'CONCACAF' },
  CUB: { name: 'Cuba',                conf: 'CONCACAF' },
  HTI: { name: 'Haití',               conf: 'CONCACAF' },
  NGA: { name: 'Nigeria',             conf: 'CAF' },
  GHA: { name: 'Ghana',               conf: 'CAF' },
  CMR: { name: 'Camerún',             conf: 'CAF' },
  SEN: { name: 'Senegal',             conf: 'CAF' },
  CIV: { name: 'Costa de Marfil',     conf: 'CAF' },
  MAR: { name: 'Marruecos',           conf: 'CAF' },
  DZA: { name: 'Argelia',             conf: 'CAF' },
  EGY: { name: 'Egipto',              conf: 'CAF' },
  COD: { name: 'Zaire',               conf: 'CAF' },
  TUN: { name: 'Túnez',               conf: 'CAF' },
  ZAF: { name: 'Sudáfrica',           conf: 'CAF' },
  AGO: { name: 'Angola',              conf: 'CAF' },
  TGO: { name: 'Togo',                conf: 'CAF' },
  JPN: { name: 'Japón',               conf: 'AFC' },
  KOR: { name: 'Corea del Sur',       conf: 'AFC' },
  PRK: { name: 'Corea del Norte',     conf: 'AFC' },
  SAU: { name: 'Arabia Saudita',      conf: 'AFC' },
  IRN: { name: 'Irán',                conf: 'AFC' },
  AUS: { name: 'Australia',           conf: 'AFC' },
  CHN: { name: 'China',               conf: 'AFC' },
  IRQ: { name: 'Irak',                conf: 'AFC' },
  ARE: { name: 'Emiratos Árabes',     conf: 'AFC' },
  QAT: { name: 'Qatar',               conf: 'AFC' },
  KWT: { name: 'Kuwait',              conf: 'AFC' },
  IDN: { name: 'Indonesia',           conf: 'AFC' },
  ISR: { name: 'Israel',              conf: 'AFC' },
  NZL: { name: 'Nueva Zelanda',       conf: 'OFC' },
  BIH: { name: 'Bosnia y Herzegovina',conf: 'UEFA' },
}

// ============================================================
// TORNEOS CONOCIDOS
// ============================================================
const TOURNAMENT_META = {
  1930: { host: 'Uruguay',       winner: 'Uruguay' },
  1934: { host: 'Italia',        winner: 'Italia' },
  1938: { host: 'Francia',       winner: 'Italia' },
  1950: { host: 'Brasil',        winner: 'Uruguay' },
  1954: { host: 'Suiza',         winner: 'Alemania Occidental' },
  1958: { host: 'Suecia',        winner: 'Brasil' },
  1962: { host: 'Chile',         winner: 'Brasil' },
  1966: { host: 'Inglaterra',    winner: 'Inglaterra' },
  1970: { host: 'México',        winner: 'Brasil' },
  1974: { host: 'Alemania',      winner: 'Alemania Occidental' },
  1978: { host: 'Argentina',     winner: 'Argentina' },
  1982: { host: 'España',        winner: 'Italia' },
  1986: { host: 'México',        winner: 'Argentina' },
  1990: { host: 'Italia',        winner: 'Alemania Occidental' },
  1994: { host: 'Estados Unidos',winner: 'Brasil' },
  1998: { host: 'Francia',       winner: 'Francia' },
  2002: { host: 'Corea/Japón',   winner: 'Brasil' },
  2006: { host: 'Alemania',      winner: 'Italia' },
  2010: { host: 'Sudáfrica',     winner: 'España' },
  2014: { host: 'Brasil',        winner: 'Alemania' },
  2018: { host: 'Rusia',         winner: 'Francia' },
  2022: { host: 'Qatar',         winner: 'Argentina' },
}

// ============================================================
// RATINGS CURADOS — clave: norm(family_name):team_code_lower:year
// Fallback: norm(full_player_name):team_code_lower:year
// ============================================================
const OVERRIDES = {
  // ── BRASIL ──────────────────────────────────────────────
  'pele:bra:1958':        { r: 97, pos: 'DC',  alt: [{ position: 'MCO', compatibility: 'natural' }] },
  'pele:bra:1962':        { r: 95, pos: 'DC',  alt: [{ position: 'MCO', compatibility: 'natural' }] },
  'pele:bra:1966':        { r: 88, pos: 'DC' },
  'pele:bra:1970':        { r: 99, pos: 'DC',  alt: [{ position: 'MCO', compatibility: 'natural' }, { position: 'EI', compatibility: 'puede' }] },
  'garrincha:bra:1958':   { r: 97, pos: 'ED',  alt: [{ position: 'EI', compatibility: 'puede' }] },
  'garrincha:bra:1962':   { r: 96, pos: 'ED',  alt: [{ position: 'EI', compatibility: 'puede' }] },
  'garrincha:bra:1966':   { r: 84, pos: 'ED' },
  'didi:bra:1954':        { r: 87, pos: 'MC',  alt: [{ position: 'MCD', compatibility: 'puede' }] },
  'didi:bra:1958':        { r: 93, pos: 'MC',  alt: [{ position: 'MCD', compatibility: 'puede' }] },
  'didi:bra:1962':        { r: 90, pos: 'MC' },
  'vava:bra:1958':        { r: 88, pos: 'DC' },
  'vava:bra:1962':        { r: 86, pos: 'DC' },
  'rivelino:bra:1970':    { r: 94, pos: 'MCO', alt: [{ position: 'EI', compatibility: 'natural' }, { position: 'MC', compatibility: 'puede' }] },
  'rivelino:bra:1974':    { r: 91, pos: 'MCO', alt: [{ position: 'EI', compatibility: 'puede' }] },
  'rivelino:bra:1978':    { r: 84, pos: 'MCO' },
  'jairzinho:bra:1970':   { r: 94, pos: 'ED',  alt: [{ position: 'DC', compatibility: 'puede' }] },
  'gerson:bra:1970':      { r: 91, pos: 'MC',  alt: [{ position: 'MCO', compatibility: 'puede' }] },
  'clodoaldo:bra:1970':   { r: 85, pos: 'MCD', alt: [{ position: 'MC', compatibility: 'puede' }] },
  'tostao:bra:1970':      { r: 90, pos: 'DC',  alt: [{ position: 'MCO', compatibility: 'puede' }] },
  'carlos alberto:bra:1970':{ r: 90, pos: 'LD' },
  'zico:bra:1978':        { r: 87, pos: 'MCO', alt: [{ position: 'MC', compatibility: 'puede' }] },
  'zico:bra:1982':        { r: 97, pos: 'MCO', alt: [{ position: 'MC', compatibility: 'puede' }, { position: 'EI', compatibility: 'puede' }] },
  'zico:bra:1986':        { r: 91, pos: 'MCO', alt: [{ position: 'MC', compatibility: 'puede' }] },
  'socrates:bra:1982':    { r: 93, pos: 'MC',  alt: [{ position: 'MCO', compatibility: 'puede' }] },
  'socrates:bra:1986':    { r: 89, pos: 'MC',  alt: [{ position: 'MCO', compatibility: 'puede' }] },
  'falcao:bra:1982':      { r: 94, pos: 'MC',  alt: [{ position: 'MCD', compatibility: 'puede' }] },
  'cerezo:bra:1982':      { r: 87, pos: 'MCD', alt: [{ position: 'MC', compatibility: 'puede' }] },
  'romario:bra:1990':     { r: 89, pos: 'DC' },
  'romario:bra:1994':     { r: 97, pos: 'DC' },
  'bebeto:bra:1994':      { r: 93, pos: 'DC',  alt: [{ position: 'EI', compatibility: 'puede' }] },
  'bebeto:bra:1998':      { r: 85, pos: 'DC' },
  'ronaldo:bra:1994':     { r: 84, pos: 'DC',  alt: [{ position: 'ED', compatibility: 'puede' }] },
  'ronaldo:bra:1998':     { r: 95, pos: 'DC' },
  'ronaldo:bra:2002':     { r: 98, pos: 'DC' },
  'ronaldo:bra:2006':     { r: 89, pos: 'DC' },
  'rivaldo:bra:1998':     { r: 94, pos: 'MCO', alt: [{ position: 'EI', compatibility: 'puede' }] },
  'rivaldo:bra:2002':     { r: 93, pos: 'MCO', alt: [{ position: 'EI', compatibility: 'puede' }] },
  'roberto carlos:bra:1998': { r: 94, pos: 'LI' },
  'roberto carlos:bra:2002': { r: 95, pos: 'LI' },
  'roberto carlos:bra:2006': { r: 89, pos: 'LI' },
  'cafu:bra:1994':        { r: 87, pos: 'LD' },
  'cafu:bra:1998':        { r: 92, pos: 'LD' },
  'cafu:bra:2002':        { r: 94, pos: 'LD' },
  'cafu:bra:2006':        { r: 86, pos: 'LD' },
  'ronaldinho:bra:2002':  { r: 91, pos: 'MCO', alt: [{ position: 'EI', compatibility: 'puede' }, { position: 'MC', compatibility: 'puede' }] },
  'ronaldinho:bra:2006':  { r: 97, pos: 'EI',  alt: [{ position: 'MCO', compatibility: 'natural' }, { position: 'ED', compatibility: 'puede' }] },
  'kaka:bra:2006':        { r: 94, pos: 'MCO', alt: [{ position: 'MC', compatibility: 'puede' }] },
  'kaka:bra:2010':        { r: 87, pos: 'MCO' },
  'neymar:bra:2014':      { r: 93, pos: 'EI',  alt: [{ position: 'MCO', compatibility: 'puede' }, { position: 'ED', compatibility: 'puede' }] },
  'neymar:bra:2018':      { r: 91, pos: 'EI',  alt: [{ position: 'MCO', compatibility: 'puede' }] },
  'neymar:bra:2022':      { r: 90, pos: 'EI',  alt: [{ position: 'MCO', compatibility: 'puede' }] },
  'thiago silva:bra:2014':{ r: 94, pos: 'DFC' },
  'thiago silva:bra:2018':{ r: 89, pos: 'DFC' },
  'thiago silva:bra:2022':{ r: 87, pos: 'DFC' },

  // ── ARGENTINA ───────────────────────────────────────────
  'maradona:arg:1982':    { r: 91, pos: 'MCO', alt: [{ position: 'EI', compatibility: 'puede' }] },
  'maradona:arg:1986':    { r: 99, pos: 'MCO', alt: [{ position: 'DC', compatibility: 'puede' }, { position: 'EI', compatibility: 'puede' }] },
  'maradona:arg:1990':    { r: 95, pos: 'MCO' },
  'maradona:arg:1994':    { r: 86, pos: 'MCO' },
  'kempes:arg:1974':      { r: 84, pos: 'DC',  alt: [{ position: 'EI', compatibility: 'puede' }] },
  'kempes:arg:1978':      { r: 96, pos: 'DC',  alt: [{ position: 'EI', compatibility: 'puede' }] },
  'passarella:arg:1978':  { r: 91, pos: 'DFC', alt: [{ position: 'MCD', compatibility: 'puede' }] },
  'passarella:arg:1982':  { r: 88, pos: 'DFC' },
  'ardiles:arg:1978':     { r: 91, pos: 'MC',  alt: [{ position: 'MCO', compatibility: 'puede' }] },
  'ardiles:arg:1982':     { r: 87, pos: 'MC' },
  'batistuta:arg:1994':   { r: 92, pos: 'DC' },
  'batistuta:arg:1998':   { r: 95, pos: 'DC' },
  'batistuta:arg:2002':   { r: 87, pos: 'DC' },
  'ortega:arg:1994':      { r: 84, pos: 'MCO' },
  'ortega:arg:1998':      { r: 88, pos: 'MCO', alt: [{ position: 'EI', compatibility: 'puede' }] },
  'riquelme:arg:2002':    { r: 87, pos: 'MCO' },
  'riquelme:arg:2006':    { r: 93, pos: 'MCO' },
  'zanetti:arg:1998':     { r: 90, pos: 'LD',  alt: [{ position: 'MCD', compatibility: 'puede' }] },
  'zanetti:arg:2002':     { r: 89, pos: 'LD' },
  'zanetti:arg:2006':     { r: 87, pos: 'LD' },
  'zanetti:arg:2010':     { r: 84, pos: 'LD' },
  'messi:arg:2006':       { r: 87, pos: 'EI',  alt: [{ position: 'MCO', compatibility: 'puede' }] },
  'messi:arg:2010':       { r: 89, pos: 'EI',  alt: [{ position: 'MCO', compatibility: 'puede' }] },
  'messi:arg:2014':       { r: 95, pos: 'EI',  alt: [{ position: 'MCO', compatibility: 'puede' }, { position: 'DC', compatibility: 'puede' }] },
  'messi:arg:2018':       { r: 91, pos: 'EI',  alt: [{ position: 'MCO', compatibility: 'puede' }] },
  'messi:arg:2022':       { r: 99, pos: 'EI',  alt: [{ position: 'MCO', compatibility: 'natural' }, { position: 'DC', compatibility: 'puede' }] },
  'di maria:arg:2014':    { r: 90, pos: 'EI',  alt: [{ position: 'ED', compatibility: 'puede' }] },
  'di maria:arg:2018':    { r: 84, pos: 'EI',  alt: [{ position: 'ED', compatibility: 'puede' }] },
  'di maria:arg:2022':    { r: 90, pos: 'EI',  alt: [{ position: 'ED', compatibility: 'puede' }] },
  'aguero:arg:2010':      { r: 82, pos: 'DC',  alt: [{ position: 'EI', compatibility: 'puede' }] },
  'aguero:arg:2014':      { r: 88, pos: 'DC',  alt: [{ position: 'EI', compatibility: 'puede' }] },
  'aguero:arg:2018':      { r: 87, pos: 'DC' },
  'de paul:arg:2022':     { r: 87, pos: 'MC',  alt: [{ position: 'MCD', compatibility: 'puede' }] },
  'alvarez:arg:2022':     { r: 88, pos: 'DC',  alt: [{ position: 'EI', compatibility: 'puede' }] },

  // ── ALEMANIA ────────────────────────────────────────────
  'beckenbauer:deu:1966': { r: 90, pos: 'MCD', alt: [{ position: 'DFC', compatibility: 'puede' }] },
  'beckenbauer:deu:1970': { r: 94, pos: 'DFC', alt: [{ position: 'MCD', compatibility: 'natural' }, { position: 'MC', compatibility: 'puede' }] },
  'beckenbauer:deu:1974': { r: 97, pos: 'DFC', alt: [{ position: 'MCD', compatibility: 'natural' }] },
  'muller:deu:1970':      { r: 96, pos: 'DC' },
  'muller:deu:1974':      { r: 95, pos: 'DC' },
  'seeler:deu:1958':      { r: 87, pos: 'DC' },
  'seeler:deu:1962':      { r: 88, pos: 'DC' },
  'seeler:deu:1966':      { r: 89, pos: 'DC' },
  'seeler:deu:1970':      { r: 87, pos: 'DC' },
  'breitner:deu:1974':    { r: 89, pos: 'LI',  alt: [{ position: 'MC', compatibility: 'puede' }] },
  'overath:deu:1966':     { r: 87, pos: 'MC' },
  'overath:deu:1970':     { r: 89, pos: 'MC' },
  'overath:deu:1974':     { r: 88, pos: 'MC' },
  'rummenigge:deu:1978':  { r: 87, pos: 'DC',  alt: [{ position: 'EI', compatibility: 'puede' }] },
  'rummenigge:deu:1982':  { r: 95, pos: 'DC',  alt: [{ position: 'EI', compatibility: 'puede' }] },
  'rummenigge:deu:1986':  { r: 87, pos: 'DC' },
  'matthaus:deu:1982':    { r: 86, pos: 'MC' },
  'matthaus:deu:1986':    { r: 92, pos: 'MC',  alt: [{ position: 'MCD', compatibility: 'puede' }] },
  'matthaus:deu:1990':    { r: 96, pos: 'MC',  alt: [{ position: 'MCD', compatibility: 'puede' }] },
  'matthaus:deu:1994':    { r: 91, pos: 'MCD' },
  'matthaus:deu:1998':    { r: 84, pos: 'MCD' },
  'klinsmann:deu:1990':   { r: 90, pos: 'DC',  alt: [{ position: 'EI', compatibility: 'puede' }] },
  'klinsmann:deu:1994':   { r: 91, pos: 'DC' },
  'klinsmann:deu:1998':   { r: 86, pos: 'DC' },
  'klose:deu:2002':       { r: 87, pos: 'DC' },
  'klose:deu:2006':       { r: 91, pos: 'DC' },
  'klose:deu:2010':       { r: 91, pos: 'DC' },
  'klose:deu:2014':       { r: 88, pos: 'DC' },
  'neuer:deu:2010':       { r: 88, pos: 'POR' },
  'neuer:deu:2014':       { r: 96, pos: 'POR' },
  'neuer:deu:2018':       { r: 91, pos: 'POR' },
  'neuer:deu:2022':       { r: 87, pos: 'POR' },
  'lahm:deu:2006':        { r: 88, pos: 'LD',  alt: [{ position: 'LI', compatibility: 'puede' }, { position: 'MCD', compatibility: 'puede' }] },
  'lahm:deu:2010':        { r: 92, pos: 'LD',  alt: [{ position: 'LI', compatibility: 'puede' }] },
  'lahm:deu:2014':        { r: 94, pos: 'MCD', alt: [{ position: 'LD', compatibility: 'natural' }] },
  'schweinsteiger:deu:2006':{ r: 86, pos: 'MC' },
  'schweinsteiger:deu:2010':{ r: 91, pos: 'MC', alt: [{ position: 'MCD', compatibility: 'puede' }] },
  'schweinsteiger:deu:2014':{ r: 93, pos: 'MC', alt: [{ position: 'MCD', compatibility: 'puede' }] },
  'ozil:deu:2010':        { r: 90, pos: 'MCO', alt: [{ position: 'MC', compatibility: 'puede' }] },
  'ozil:deu:2014':        { r: 91, pos: 'MCO', alt: [{ position: 'MC', compatibility: 'puede' }] },
  'ozil:deu:2018':        { r: 82, pos: 'MCO' },
  'kroos:deu:2014':       { r: 93, pos: 'MC',  alt: [{ position: 'MCD', compatibility: 'puede' }] },
  'kroos:deu:2018':       { r: 89, pos: 'MC' },
  'kroos:deu:2022':       { r: 91, pos: 'MC' },
  'thomas muller:deu:2010':{ r: 89, pos: 'EI', alt: [{ position: 'DC', compatibility: 'puede' }] },
  'thomas muller:deu:2014':{ r: 94, pos: 'EI', alt: [{ position: 'DC', compatibility: 'puede' }] },
  'thomas muller:deu:2018':{ r: 86, pos: 'EI', alt: [{ position: 'MCO', compatibility: 'puede' }] },
  'hummels:deu:2014':     { r: 92, pos: 'DFC' },
  'hummels:deu:2018':     { r: 87, pos: 'DFC' },
  'hummels:deu:2022':     { r: 87, pos: 'DFC' },
  'boateng:deu:2014':     { r: 90, pos: 'DFC' },
  'boateng:deu:2018':     { r: 85, pos: 'DFC' },
  'gotze:deu:2014':       { r: 88, pos: 'MCO', alt: [{ position: 'EI', compatibility: 'puede' }] },

  // ── FRANCIA ─────────────────────────────────────────────
  'platini:fra:1978':     { r: 85, pos: 'MCO' },
  'platini:fra:1982':     { r: 92, pos: 'MCO', alt: [{ position: 'MC', compatibility: 'puede' }] },
  'platini:fra:1986':     { r: 95, pos: 'MCO', alt: [{ position: 'DC', compatibility: 'puede' }] },
  'zidane:fra:1998':      { r: 97, pos: 'MC',  alt: [{ position: 'MCO', compatibility: 'natural' }, { position: 'MCD', compatibility: 'puede' }] },
  'zidane:fra:2002':      { r: 86, pos: 'MC' },
  'zidane:fra:2006':      { r: 95, pos: 'MC',  alt: [{ position: 'MCO', compatibility: 'natural' }] },
  'henry:fra:1998':       { r: 87, pos: 'ED',  alt: [{ position: 'DC', compatibility: 'puede' }] },
  'henry:fra:2002':       { r: 91, pos: 'ED',  alt: [{ position: 'DC', compatibility: 'puede' }] },
  'henry:fra:2006':       { r: 94, pos: 'ED',  alt: [{ position: 'DC', compatibility: 'puede' }] },
  'henry:fra:2010':       { r: 82, pos: 'ED' },
  'deschamps:fra:1994':   { r: 84, pos: 'MCD' },
  'deschamps:fra:1998':   { r: 87, pos: 'MCD' },
  'vieira:fra:1998':      { r: 90, pos: 'MCD', alt: [{ position: 'MC', compatibility: 'puede' }] },
  'vieira:fra:2002':      { r: 92, pos: 'MCD', alt: [{ position: 'MC', compatibility: 'puede' }] },
  'vieira:fra:2006':      { r: 89, pos: 'MCD' },
  'thuram:fra:1998':      { r: 88, pos: 'LD',  alt: [{ position: 'DFC', compatibility: 'puede' }] },
  'thuram:fra:2006':      { r: 85, pos: 'DFC' },
  'ribery:fra:2006':      { r: 88, pos: 'EI',  alt: [{ position: 'ED', compatibility: 'puede' }] },
  'ribery:fra:2010':      { r: 90, pos: 'EI' },
  'ribery:fra:2014':      { r: 85, pos: 'EI' },
  'pogba:fra:2018':       { r: 92, pos: 'MC',  alt: [{ position: 'MCD', compatibility: 'puede' }] },
  'kante:fra:2018':       { r: 93, pos: 'MCD', alt: [{ position: 'MC', compatibility: 'puede' }] },
  'mbappe:fra:2018':      { r: 94, pos: 'ED',  alt: [{ position: 'EI', compatibility: 'puede' }, { position: 'DC', compatibility: 'puede' }] },
  'mbappe:fra:2022':      { r: 98, pos: 'ED',  alt: [{ position: 'DC', compatibility: 'puede' }, { position: 'EI', compatibility: 'puede' }] },
  'giroud:fra:2018':      { r: 85, pos: 'DC' },
  'giroud:fra:2022':      { r: 87, pos: 'DC' },
  'griezmann:fra:2014':   { r: 83, pos: 'EI',  alt: [{ position: 'MCO', compatibility: 'puede' }] },
  'griezmann:fra:2018':   { r: 91, pos: 'EI',  alt: [{ position: 'MCO', compatibility: 'puede' }, { position: 'DC', compatibility: 'puede' }] },
  'griezmann:fra:2022':   { r: 88, pos: 'MCO', alt: [{ position: 'EI', compatibility: 'puede' }] },

  // ── ITALIA ──────────────────────────────────────────────
  'riva:ita:1970':        { r: 91, pos: 'EI',  alt: [{ position: 'DC', compatibility: 'puede' }] },
  'rivera:ita:1966':      { r: 87, pos: 'MCO' },
  'rivera:ita:1970':      { r: 91, pos: 'MCO', alt: [{ position: 'MC', compatibility: 'puede' }] },
  'facchetti:ita:1966':   { r: 88, pos: 'LI' },
  'facchetti:ita:1970':   { r: 91, pos: 'LI' },
  'rossi:ita:1978':       { r: 83, pos: 'DC' },
  'rossi:ita:1982':       { r: 96, pos: 'DC' },
  'zoff:ita:1974':        { r: 89, pos: 'POR' },
  'zoff:ita:1978':        { r: 92, pos: 'POR' },
  'zoff:ita:1982':        { r: 94, pos: 'POR' },
  'gentile:ita:1982':     { r: 87, pos: 'LD' },
  'cabrini:ita:1982':     { r: 86, pos: 'LI' },
  'tardelli:ita:1982':    { r: 89, pos: 'MC',  alt: [{ position: 'MCD', compatibility: 'puede' }] },
  'antognoni:ita:1982':   { r: 88, pos: 'MCO', alt: [{ position: 'MC', compatibility: 'puede' }] },
  'baresi:ita:1982':      { r: 87, pos: 'DFC', alt: [{ position: 'MCD', compatibility: 'puede' }] },
  'baresi:ita:1986':      { r: 91, pos: 'DFC' },
  'baresi:ita:1990':      { r: 95, pos: 'DFC', alt: [{ position: 'MCD', compatibility: 'puede' }] },
  'baresi:ita:1994':      { r: 91, pos: 'DFC' },
  'maldini:ita:1990':     { r: 91, pos: 'LI',  alt: [{ position: 'DFC', compatibility: 'puede' }] },
  'maldini:ita:1994':     { r: 94, pos: 'LI',  alt: [{ position: 'DFC', compatibility: 'puede' }] },
  'maldini:ita:1998':     { r: 92, pos: 'LI' },
  'maldini:ita:2002':     { r: 88, pos: 'DFC', alt: [{ position: 'LI', compatibility: 'natural' }] },
  'maldini:ita:2006':     { r: 85, pos: 'DFC' },
  'baggio:ita:1990':      { r: 90, pos: 'MCO', alt: [{ position: 'DC', compatibility: 'puede' }] },
  'baggio:ita:1994':      { r: 96, pos: 'MCO', alt: [{ position: 'DC', compatibility: 'puede' }] },
  'baggio:ita:1998':      { r: 90, pos: 'MCO', alt: [{ position: 'DC', compatibility: 'puede' }] },
  'cannavaro:ita:1998':   { r: 87, pos: 'DFC' },
  'cannavaro:ita:2002':   { r: 88, pos: 'DFC' },
  'cannavaro:ita:2006':   { r: 96, pos: 'DFC' },
  'pirlo:ita:2002':       { r: 84, pos: 'MCD', alt: [{ position: 'MC', compatibility: 'puede' }] },
  'pirlo:ita:2006':       { r: 91, pos: 'MCD', alt: [{ position: 'MC', compatibility: 'puede' }] },
  'pirlo:ita:2010':       { r: 90, pos: 'MCD' },
  'pirlo:ita:2014':       { r: 88, pos: 'MCD' },
  'buffon:ita:1998':      { r: 84, pos: 'POR' },
  'buffon:ita:2002':      { r: 87, pos: 'POR' },
  'buffon:ita:2006':      { r: 95, pos: 'POR' },
  'buffon:ita:2010':      { r: 93, pos: 'POR' },
  'buffon:ita:2014':      { r: 90, pos: 'POR' },
  'totti:ita:2006':       { r: 89, pos: 'MCO', alt: [{ position: 'DC', compatibility: 'puede' }] },

  // ── PAÍSES BAJOS ────────────────────────────────────────
  'cruyff:nld:1974':      { r: 97, pos: 'DC',  alt: [{ position: 'MCO', compatibility: 'natural' }, { position: 'EI', compatibility: 'puede' }, { position: 'ED', compatibility: 'puede' }] },
  'neeskens:nld:1974':    { r: 89, pos: 'MCD', alt: [{ position: 'MC', compatibility: 'puede' }] },
  'rep:nld:1974':         { r: 86, pos: 'DC',  alt: [{ position: 'ED', compatibility: 'puede' }] },
  'van hanegem:nld:1974': { r: 89, pos: 'MC',  alt: [{ position: 'MCO', compatibility: 'puede' }] },
  'gullit:nld:1990':      { r: 95, pos: 'EI',  alt: [{ position: 'MCO', compatibility: 'natural' }, { position: 'DC', compatibility: 'puede' }] },
  'van basten:nld:1990':  { r: 96, pos: 'DC' },
  'rijkaard:nld:1990':    { r: 92, pos: 'MCD', alt: [{ position: 'MC', compatibility: 'puede' }] },
  'bergkamp:nld:1994':    { r: 90, pos: 'DC',  alt: [{ position: 'MCO', compatibility: 'puede' }] },
  'bergkamp:nld:1998':    { r: 93, pos: 'DC',  alt: [{ position: 'MCO', compatibility: 'puede' }] },
  'robben:nld:2006':      { r: 87, pos: 'ED',  alt: [{ position: 'EI', compatibility: 'puede' }] },
  'robben:nld:2010':      { r: 94, pos: 'ED',  alt: [{ position: 'EI', compatibility: 'puede' }] },
  'robben:nld:2014':      { r: 95, pos: 'ED',  alt: [{ position: 'EI', compatibility: 'puede' }] },
  'sneijder:nld:2010':    { r: 94, pos: 'MCO', alt: [{ position: 'MC', compatibility: 'puede' }] },
  'sneijder:nld:2014':    { r: 88, pos: 'MCO' },
  'van persie:nld:2010':  { r: 90, pos: 'DC',  alt: [{ position: 'EI', compatibility: 'puede' }] },
  'van persie:nld:2014':  { r: 93, pos: 'DC' },

  // ── ESPAÑA ──────────────────────────────────────────────
  'di stefano:esp:1954':  { r: 95, pos: 'DC',  alt: [{ position: 'MCO', compatibility: 'natural' }] },
  'casillas:esp:2006':    { r: 88, pos: 'POR' },
  'casillas:esp:2010':    { r: 93, pos: 'POR' },
  'casillas:esp:2014':    { r: 83, pos: 'POR' },
  'xavi:esp:2006':        { r: 89, pos: 'MC' },
  'xavi:esp:2010':        { r: 96, pos: 'MC' },
  'xavi:esp:2014':        { r: 89, pos: 'MC' },
  'iniesta:esp:2006':     { r: 88, pos: 'MC',  alt: [{ position: 'MCO', compatibility: 'puede' }] },
  'iniesta:esp:2010':     { r: 95, pos: 'MCO', alt: [{ position: 'MC', compatibility: 'puede' }] },
  'iniesta:esp:2014':     { r: 90, pos: 'MCO', alt: [{ position: 'MC', compatibility: 'puede' }] },
  'iniesta:esp:2018':     { r: 85, pos: 'MC',  alt: [{ position: 'MCO', compatibility: 'puede' }] },
  'villa:esp:2006':       { r: 89, pos: 'DC',  alt: [{ position: 'EI', compatibility: 'puede' }] },
  'villa:esp:2010':       { r: 94, pos: 'DC',  alt: [{ position: 'EI', compatibility: 'puede' }] },
  'torres:esp:2006':      { r: 89, pos: 'DC' },
  'torres:esp:2010':      { r: 86, pos: 'DC' },
  'torres:esp:2014':      { r: 79, pos: 'DC' },
  'ramos:esp:2006':       { r: 85, pos: 'DFC', alt: [{ position: 'LD', compatibility: 'natural' }] },
  'ramos:esp:2010':       { r: 90, pos: 'DFC', alt: [{ position: 'LD', compatibility: 'natural' }] },
  'ramos:esp:2014':       { r: 91, pos: 'DFC' },
  'ramos:esp:2018':       { r: 89, pos: 'DFC' },
  'pique:esp:2010':       { r: 90, pos: 'DFC' },
  'pique:esp:2014':       { r: 87, pos: 'DFC' },
  'busquets:esp:2010':    { r: 90, pos: 'MCD' },
  'busquets:esp:2014':    { r: 91, pos: 'MCD' },
  'busquets:esp:2018':    { r: 88, pos: 'MCD' },
  'silva:esp:2010':       { r: 93, pos: 'MCO', alt: [{ position: 'EI', compatibility: 'puede' }] },
  'silva:esp:2014':       { r: 89, pos: 'MCO' },
  'alba:esp:2014':        { r: 88, pos: 'LI' },
  'fabregas:esp:2010':    { r: 88, pos: 'MC',  alt: [{ position: 'MCO', compatibility: 'puede' }] },
  'fabregas:esp:2014':    { r: 85, pos: 'MC' },

  // ── INGLATERRA ──────────────────────────────────────────
  'banks:eng:1966':       { r: 93, pos: 'POR' },
  'banks:eng:1970':       { r: 91, pos: 'POR' },
  'moore:eng:1966':       { r: 95, pos: 'DFC' },
  'moore:eng:1970':       { r: 91, pos: 'DFC' },
  'charlton:eng:1962':    { r: 88, pos: 'MC' },
  'charlton:eng:1966':    { r: 94, pos: 'MC',  alt: [{ position: 'MCO', compatibility: 'puede' }] },
  'charlton:eng:1970':    { r: 90, pos: 'MC' },
  'hurst:eng:1966':       { r: 91, pos: 'DC' },
  'ball:eng:1966':        { r: 88, pos: 'MC' },
  'lineker:eng:1986':     { r: 92, pos: 'DC' },
  'lineker:eng:1990':     { r: 91, pos: 'DC' },
  'beckham:eng:1998':     { r: 88, pos: 'MC',  alt: [{ position: 'ED', compatibility: 'puede' }] },
  'beckham:eng:2002':     { r: 91, pos: 'MC',  alt: [{ position: 'ED', compatibility: 'puede' }] },
  'beckham:eng:2006':     { r: 86, pos: 'MC' },
  'gerrard:eng:2006':     { r: 91, pos: 'MC',  alt: [{ position: 'MCD', compatibility: 'puede' }, { position: 'MCO', compatibility: 'puede' }] },
  'gerrard:eng:2010':     { r: 89, pos: 'MC' },
  'gerrard:eng:2014':     { r: 83, pos: 'MC' },
  'rooney:eng:2006':      { r: 89, pos: 'DC',  alt: [{ position: 'MCO', compatibility: 'puede' }] },
  'rooney:eng:2010':      { r: 85, pos: 'DC',  alt: [{ position: 'MCO', compatibility: 'puede' }] },
  'rooney:eng:2014':      { r: 84, pos: 'DC' },
  'kane:eng:2018':        { r: 94, pos: 'DC' },
  'kane:eng:2022':        { r: 90, pos: 'DC' },
  'sterling:eng:2018':    { r: 86, pos: 'EI',  alt: [{ position: 'ED', compatibility: 'puede' }] },

  // ── PORTUGAL ────────────────────────────────────────────
  'eusebio:prt:1966':     { r: 97, pos: 'DC',  alt: [{ position: 'ED', compatibility: 'puede' }, { position: 'MCO', compatibility: 'puede' }] },
  'figo:prt:1998':        { r: 88, pos: 'ED',  alt: [{ position: 'EI', compatibility: 'puede' }] },
  'figo:prt:2002':        { r: 92, pos: 'ED',  alt: [{ position: 'EI', compatibility: 'puede' }] },
  'figo:prt:2006':        { r: 90, pos: 'ED',  alt: [{ position: 'EI', compatibility: 'puede' }] },
  'deco:prt:2002':        { r: 88, pos: 'MCO', alt: [{ position: 'MC', compatibility: 'puede' }] },
  'deco:prt:2006':        { r: 92, pos: 'MCO', alt: [{ position: 'MC', compatibility: 'puede' }] },
  'carvalho:prt:2006':    { r: 90, pos: 'DFC' },
  'pepe:prt:2010':        { r: 87, pos: 'DFC' },
  'pepe:prt:2014':        { r: 89, pos: 'DFC' },
  'pepe:prt:2018':        { r: 87, pos: 'DFC' },
  'ronaldo:prt:2006':     { r: 90, pos: 'EI',  alt: [{ position: 'MCO', compatibility: 'puede' }, { position: 'ED', compatibility: 'puede' }] },
  'ronaldo:prt:2010':     { r: 93, pos: 'EI',  alt: [{ position: 'MCO', compatibility: 'puede' }, { position: 'DC', compatibility: 'puede' }] },
  'ronaldo:prt:2014':     { r: 93, pos: 'EI',  alt: [{ position: 'DC', compatibility: 'puede' }, { position: 'MCO', compatibility: 'puede' }] },
  'ronaldo:prt:2018':     { r: 94, pos: 'EI',  alt: [{ position: 'DC', compatibility: 'puede' }] },
  'ronaldo:prt:2022':     { r: 88, pos: 'DC',  alt: [{ position: 'EI', compatibility: 'puede' }] },

  // ── BÉLGICA ─────────────────────────────────────────────
  'hazard:bel:2014':      { r: 93, pos: 'EI',  alt: [{ position: 'MCO', compatibility: 'puede' }] },
  'hazard:bel:2018':      { r: 95, pos: 'EI',  alt: [{ position: 'MCO', compatibility: 'puede' }] },
  'hazard:bel:2022':      { r: 87, pos: 'EI' },
  'de bruyne:bel:2014':   { r: 87, pos: 'MCO', alt: [{ position: 'MC', compatibility: 'puede' }] },
  'de bruyne:bel:2018':   { r: 95, pos: 'MC',  alt: [{ position: 'MCO', compatibility: 'puede' }] },
  'de bruyne:bel:2022':   { r: 92, pos: 'MC',  alt: [{ position: 'MCO', compatibility: 'puede' }] },
  'lukaku:bel:2014':      { r: 83, pos: 'DC' },
  'lukaku:bel:2018':      { r: 90, pos: 'DC' },
  'lukaku:bel:2022':      { r: 87, pos: 'DC' },

  // ── CROACIA ─────────────────────────────────────────────
  'suker:hrv:1998':       { r: 92, pos: 'DC',  alt: [{ position: 'EI', compatibility: 'puede' }] },
  'boban:hrv:1998':       { r: 89, pos: 'MC',  alt: [{ position: 'MCD', compatibility: 'puede' }] },
  'modric:hrv:2014':      { r: 89, pos: 'MC',  alt: [{ position: 'MCD', compatibility: 'puede' }] },
  'modric:hrv:2018':      { r: 98, pos: 'MC',  alt: [{ position: 'MCD', compatibility: 'puede' }, { position: 'MCO', compatibility: 'puede' }] },
  'modric:hrv:2022':      { r: 93, pos: 'MC' },
  'rakitic:hrv:2018':     { r: 91, pos: 'MC',  alt: [{ position: 'MCD', compatibility: 'puede' }] },
  'perisic:hrv:2018':     { r: 89, pos: 'EI',  alt: [{ position: 'LI', compatibility: 'puede' }] },
  'brozovic:hrv:2018':    { r: 89, pos: 'MCD', alt: [{ position: 'MC', compatibility: 'puede' }] },

  // ── URUGUAY ─────────────────────────────────────────────
  'schiaffino:ury:1950':  { r: 95, pos: 'MC',  alt: [{ position: 'MCO', compatibility: 'puede' }, { position: 'DC', compatibility: 'puede' }] },
  'schiaffino:ury:1954':  { r: 93, pos: 'MC',  alt: [{ position: 'MCO', compatibility: 'puede' }] },
  'ghiggia:ury:1950':     { r: 93, pos: 'ED',  alt: [{ position: 'DC', compatibility: 'puede' }] },
  'cubilla:ury:1970':     { r: 87, pos: 'ED' },
  'forlan:ury:2002':      { r: 84, pos: 'DC' },
  'forlan:ury:2010':      { r: 92, pos: 'DC',  alt: [{ position: 'MCO', compatibility: 'puede' }] },
  'suarez:ury:2010':      { r: 91, pos: 'DC',  alt: [{ position: 'EI', compatibility: 'puede' }] },
  'suarez:ury:2014':      { r: 93, pos: 'DC',  alt: [{ position: 'EI', compatibility: 'puede' }] },
  'suarez:ury:2018':      { r: 87, pos: 'DC' },
  'cavani:ury:2014':      { r: 88, pos: 'DC' },
  'cavani:ury:2018':      { r: 88, pos: 'DC' },
  'cavani:ury:2022':      { r: 84, pos: 'DC' },

  // ── HUNGRÍA ─────────────────────────────────────────────
  'puskas:hun:1954':      { r: 98, pos: 'DC',  alt: [{ position: 'EI', compatibility: 'puede' }, { position: 'MCO', compatibility: 'puede' }] },
  'kocsis:hun:1954':      { r: 95, pos: 'DC' },
  'hidegkuti:hun:1954':   { r: 94, pos: 'MCO', alt: [{ position: 'DC', compatibility: 'puede' }] },
  'bozsik:hun:1954':      { r: 91, pos: 'MC' },

  // ── POLONIA ─────────────────────────────────────────────
  'lato:pol:1974':        { r: 90, pos: 'ED',  alt: [{ position: 'DC', compatibility: 'puede' }] },
  'deyna:pol:1974':       { r: 92, pos: 'MC',  alt: [{ position: 'MCO', compatibility: 'puede' }] },
  'szarmach:pol:1974':    { r: 86, pos: 'DC' },
  'lewandowski:pol:2018': { r: 88, pos: 'DC' },
  'lewandowski:pol:2022': { r: 89, pos: 'DC' },

  // ── CHECOSLOVAQUIA ──────────────────────────────────────
  'masopust:csk:1962':    { r: 92, pos: 'MCO', alt: [{ position: 'MC', compatibility: 'puede' }] },
  'nedved:cze:2006':      { r: 92, pos: 'MCO', alt: [{ position: 'EI', compatibility: 'puede' }] },
  'nedved:cze:2002':      { r: 90, pos: 'MCO' },

  // ── RUMANÍA ─────────────────────────────────────────────
  'hagi:rou:1990':        { r: 91, pos: 'MCO', alt: [{ position: 'MC', compatibility: 'puede' }] },
  'hagi:rou:1994':        { r: 94, pos: 'MCO', alt: [{ position: 'EI', compatibility: 'puede' }] },
  'hagi:rou:1998':        { r: 88, pos: 'MCO' },

  // ── DINAMARCA ───────────────────────────────────────────
  'schmeichel:dnk:1998':  { r: 91, pos: 'POR' },
  'laudrup:dnk:1986':     { r: 91, pos: 'MCO', alt: [{ position: 'ED', compatibility: 'puede' }, { position: 'DC', compatibility: 'puede' }] },
  'laudrup:dnk:1998':     { r: 91, pos: 'MCO', alt: [{ position: 'ED', compatibility: 'puede' }] },

  // ── SUECIA ──────────────────────────────────────────────
  'nordahl:swe:1950':     { r: 91, pos: 'DC' },
  'liedholm:swe:1958':    { r: 90, pos: 'MC',  alt: [{ position: 'MCO', compatibility: 'puede' }] },
  'hamrin:swe:1958':      { r: 89, pos: 'ED' },
  'ibrahimovic:swe:2006': { r: 88, pos: 'DC',  alt: [{ position: 'EI', compatibility: 'puede' }] },
  'ibrahimovic:swe:2010': { r: 91, pos: 'DC',  alt: [{ position: 'EI', compatibility: 'puede' }] },
  'ibrahimovic:swe:2014': { r: 89, pos: 'DC',  alt: [{ position: 'EI', compatibility: 'puede' }] },
  'zlatan:swe:2006':      { r: 88, pos: 'DC',  alt: [{ position: 'EI', compatibility: 'puede' }] },
  'zlatan:swe:2010':      { r: 91, pos: 'DC',  alt: [{ position: 'EI', compatibility: 'puede' }] },
  'zlatan:swe:2014':      { r: 89, pos: 'DC',  alt: [{ position: 'EI', compatibility: 'puede' }] },

  // ── AUSTRIA ─────────────────────────────────────────────
  'ocwirk:aut:1954':      { r: 91, pos: 'MCD', alt: [{ position: 'MC', compatibility: 'puede' }] },

  // ── UNIÓN SOVIÉTICA ─────────────────────────────────────
  'yashin:sun:1958':      { r: 95, pos: 'POR' },
  'yashin:sun:1962':      { r: 97, pos: 'POR' },
  'yashin:sun:1966':      { r: 93, pos: 'POR' },
  'yashin:sun:1970':      { r: 89, pos: 'POR' },

  // ── COLOMBIA ────────────────────────────────────────────
  'valderrama:col:1990':  { r: 91, pos: 'MC',  alt: [{ position: 'MCO', compatibility: 'puede' }] },
  'valderrama:col:1994':  { r: 90, pos: 'MC',  alt: [{ position: 'MCO', compatibility: 'puede' }] },
  'valderrama:col:1998':  { r: 86, pos: 'MC' },
  'asprilla:col:1994':    { r: 88, pos: 'DC',  alt: [{ position: 'EI', compatibility: 'puede' }] },
  'asprilla:col:1998':    { r: 87, pos: 'DC' },
  'james:col:2014':       { r: 90, pos: 'MCO', alt: [{ position: 'EI', compatibility: 'puede' }] },
  'james:col:2018':       { r: 86, pos: 'MCO' },

  // ── CHILE ───────────────────────────────────────────────
  'vidal:chl:2010':       { r: 86, pos: 'MC',  alt: [{ position: 'MCD', compatibility: 'puede' }] },
  'vidal:chl:2014':       { r: 91, pos: 'MC',  alt: [{ position: 'MCD', compatibility: 'puede' }] },
  'vidal:chl:2018':       { r: 88, pos: 'MC' },
  'sanchez:chl:2010':     { r: 87, pos: 'EI',  alt: [{ position: 'DC', compatibility: 'puede' }] },
  'sanchez:chl:2014':     { r: 91, pos: 'EI',  alt: [{ position: 'DC', compatibility: 'puede' }] },

  // ── YUGOSLAVIA ──────────────────────────────────────────
  'savicevic:yug:1990':   { r: 88, pos: 'EI',  alt: [{ position: 'MCO', compatibility: 'puede' }] },
  'prosinecki:yug:1990':  { r: 87, pos: 'MCO', alt: [{ position: 'MC', compatibility: 'puede' }] },

  // ── CAMERÚN ─────────────────────────────────────────────
  'milla:cmr:1982':       { r: 84, pos: 'DC' },
  'milla:cmr:1990':       { r: 89, pos: 'DC' },
  'eto o:cmr:2002':       { r: 86, pos: 'DC',  alt: [{ position: 'EI', compatibility: 'puede' }] },
  "eto'o:cmr:2002":       { r: 86, pos: 'DC',  alt: [{ position: 'EI', compatibility: 'puede' }] },
  'etoo:cmr:2002':        { r: 86, pos: 'DC',  alt: [{ position: 'EI', compatibility: 'puede' }] },
  'eto o:cmr:2010':       { r: 91, pos: 'DC',  alt: [{ position: 'EI', compatibility: 'puede' }] },
  "eto'o:cmr:2010":       { r: 91, pos: 'DC',  alt: [{ position: 'EI', compatibility: 'puede' }] },
  'etoo:cmr:2010':        { r: 91, pos: 'DC',  alt: [{ position: 'EI', compatibility: 'puede' }] },
  'eto o:cmr:2014':       { r: 88, pos: 'DC' },
  'etoo:cmr:2014':        { r: 88, pos: 'DC' },

  // ── NIGERIA ─────────────────────────────────────────────
  'okocha:nga:1994':      { r: 87, pos: 'MC',  alt: [{ position: 'MCO', compatibility: 'puede' }] },
  'okocha:nga:1998':      { r: 91, pos: 'MC',  alt: [{ position: 'MCO', compatibility: 'puede' }] },
  'okocha:nga:2002':      { r: 87, pos: 'MC' },

  // ── GHANA ───────────────────────────────────────────────
  'essien:gha:2006':      { r: 88, pos: 'MCD', alt: [{ position: 'MC', compatibility: 'puede' }] },
  'essien:gha:2010':      { r: 89, pos: 'MCD' },
  'gyan:gha:2010':        { r: 89, pos: 'DC',  alt: [{ position: 'EI', compatibility: 'puede' }] },

  // ── COSTA DE MARFIL ─────────────────────────────────────
  'drogba:civ:2006':      { r: 88, pos: 'DC' },
  'drogba:civ:2010':      { r: 92, pos: 'DC' },
  'drogba:civ:2014':      { r: 88, pos: 'DC' },

  // ── SENEGAL ─────────────────────────────────────────────
  'diouf:sen:2002':       { r: 87, pos: 'ED',  alt: [{ position: 'DC', compatibility: 'puede' }] },
  'mane:sen:2022':        { r: 91, pos: 'EI',  alt: [{ position: 'ED', compatibility: 'puede' }, { position: 'DC', compatibility: 'puede' }] },

  // ── MARRUECOS ───────────────────────────────────────────
  'hakimi:mar:2022':      { r: 90, pos: 'LD',  alt: [{ position: 'ED', compatibility: 'puede' }] },
  'ziyech:mar:2022':      { r: 87, pos: 'EI',  alt: [{ position: 'MCO', compatibility: 'puede' }] },
  'bono:mar:2022':        { r: 88, pos: 'POR' },

  // ── EGIPTO ──────────────────────────────────────────────
  'salah:egy:2018':       { r: 93, pos: 'EI',  alt: [{ position: 'ED', compatibility: 'puede' }] },

  // ── COREA DEL SUR ───────────────────────────────────────
  'park:kor:2002':        { r: 83, pos: 'MC',  alt: [{ position: 'EI', compatibility: 'puede' }] },
  'park:kor:2006':        { r: 87, pos: 'MC',  alt: [{ position: 'EI', compatibility: 'puede' }] },
  'park:kor:2010':        { r: 87, pos: 'MC' },

  // ── JAPÓN ───────────────────────────────────────────────
  'nakata:jpn:1998':      { r: 85, pos: 'MC',  alt: [{ position: 'MCO', compatibility: 'puede' }] },
  'nakata:jpn:2002':      { r: 88, pos: 'MC',  alt: [{ position: 'MCO', compatibility: 'puede' }] },
  'nakamura:jpn:2006':    { r: 85, pos: 'MCO' },
  'honda:jpn:2010':       { r: 84, pos: 'MCO', alt: [{ position: 'DC', compatibility: 'puede' }] },
  'honda:jpn:2014':       { r: 86, pos: 'MCO' },

  // ── TURQUÍA ─────────────────────────────────────────────
  'sukur:tur:2002':       { r: 88, pos: 'DC' },

  // ── COSTA RICA ──────────────────────────────────────────
  'navas:cri:2014':       { r: 93, pos: 'POR' },
  'navas:cri:2018':       { r: 89, pos: 'POR' },
  'navas:cri:2022':       { r: 86, pos: 'POR' },

  // ── MÉXICO ──────────────────────────────────────────────
  'blanco:mex:1998':      { r: 86, pos: 'MCO', alt: [{ position: 'DC', compatibility: 'puede' }] },
  'blanco:mex:2002':      { r: 84, pos: 'MCO' },
  'hernandez:mex:2010':   { r: 87, pos: 'DC',  alt: [{ position: 'EI', compatibility: 'puede' }] },
  'hernandez:mex:2014':   { r: 88, pos: 'DC',  alt: [{ position: 'EI', compatibility: 'puede' }] },
  'hernandez:mex:2018':   { r: 84, pos: 'DC' },
  'guardado:mex:2014':    { r: 84, pos: 'MC',  alt: [{ position: 'MCD', compatibility: 'puede' }] },
  'guardado:mex:2018':    { r: 83, pos: 'MC' },

  // ── CANADÁ ──────────────────────────────────────────────
  'davies:can:2022':      { r: 88, pos: 'LI',  alt: [{ position: 'EI', compatibility: 'puede' }] },
}

// ============================================================
// FUNCIONES
// ============================================================
function norm(s) {
  if (!s || s === 'not applicable') return ''
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function seedHash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 4294967296
}

// Asignación de posición específica dentro del grupo
const DF_DIST  = ['DFC','DFC','DFC','LD','LI','DFC','DFC','LD','LI','DFC']
const MF_DIST  = ['MCD','MC','MC','MCO','MC','MCD','MC','MCO','MC','MCD']
const FW_DIST  = ['DC','EI','ED','DC','EI','ED','DC']

function assignPosition(posCode, idx) {
  if (posCode === 'GK') return 'POR'
  if (posCode === 'DF') return DF_DIST[Math.min(idx, DF_DIST.length - 1)]
  if (posCode === 'MF') return MF_DIST[Math.min(idx, MF_DIST.length - 1)]
  if (posCode === 'FW') return FW_DIST[Math.min(idx, FW_DIST.length - 1)]
  return 'MC'
}

function generateStats(position, rating, seedStr) {
  const s  = seedHash(seedStr + 'a')
  const s2 = seedHash(seedStr + 'b')
  const s3 = seedHash(seedStr + 'c')
  const s4 = seedHash(seedStr + 'd')
  const s5 = seedHash(seedStr + 'e')
  const s6 = seedHash(seedStr + 'f')
  const hi = rating + 3
  const lo = rating - 5
  const v  = (x) => Math.min(99, Math.max(50, Math.round(x)))

  if (position === 'POR') return {
    reflejos:    v(hi + (s -0.5)*8),  manejo:       v(hi + (s2-0.5)*8),
    salidas:     v(lo + (s3-0.5)*10), penales:      v(lo + (s4-0.5)*10),
    distribucion:v(lo + (s5-0.5)*10),
  }
  if (['DFC','LD','LI'].includes(position)) return {
    defAerea:      v(hi + (s -0.5)*8), intercepciones:v(hi + (s2-0.5)*8),
    velocidad:     v(lo + (s3-0.5)*12),pases:         v(lo + (s4-0.5)*10),
    duelos:        v(hi + (s5-0.5)*8),
  }
  if (position === 'MCD') return {
    recuperacion:   v(hi + (s -0.5)*8), pases:         v(hi + (s2-0.5)*8),
    posicionamiento:v(hi + (s3-0.5)*8), duelos:        v(hi + (s4-0.5)*8),
    resistencia:    v(lo + (s5-0.5)*10),
  }
  if (position === 'MC') return {
    pases:      v(hi + (s -0.5)*8), vision:      v(hi + (s2-0.5)*8),
    llegada:    v(lo + (s3-0.5)*10),recuperacion:v(lo + (s4-0.5)*10),
    tecnica:    v(hi + (s5-0.5)*8),
  }
  if (['MCO','MD','MI'].includes(position)) return {
    vision:      v(hi + (s -0.5)*8), paseFiltrado:v(hi + (s2-0.5)*8),
    llegada:     v(hi + (s3-0.5)*8), regate:      v(lo + (s4-0.5)*10),
    disparo:     v(lo + (s5-0.5)*12),
  }
  if (['EI','ED'].includes(position)) return {
    velocidad: v(hi + (s -0.5)*8), regate:    v(hi + (s2-0.5)*8),
    centro:    v(lo + (s3-0.5)*10),disparo:   v(lo + (s4-0.5)*10),
    desmarque: v(hi + (s5-0.5)*8),
  }
  // DC
  return {
    definicion:v(hi + (s -0.5)*8), fisico:   v(hi + (s2-0.5)*8),
    velocidad: v(lo + (s3-0.5)*12),cabezazo: v(lo + (s4-0.5)*10),
    pressing:  v(lo + (s5-0.5)*10),desmarque:v(hi + (s6-0.5)*8),
  }
}

function lookupOverride(playerName, familyName, givenName, teamCode, year) {
  const tc = teamCode.toLowerCase()
  const candidates = [
    norm(familyName) ? `${norm(familyName)}:${tc}:${year}` : null,
    norm(playerName) ? `${norm(playerName)}:${tc}:${year}` : null,
    (norm(givenName) && norm(familyName)) ? `${norm(givenName)} ${norm(familyName)}:${tc}:${year}` : null,
  ].filter(Boolean)

  for (const k of candidates) {
    if (OVERRIDES[k]) return { key: k, ...OVERRIDES[k] }
  }
  return null
}

function slugify(s) {
  return norm(s).replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-')
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/)
  const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim())
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const cols = line.split(',')
    const row = {}
    headers.forEach((h, i) => { row[h] = (cols[i] || '').replace(/"/g, '').trim() })
    return row
  })
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true })

  console.log('Descargando squads.csv...')
  const squadsText = await (await fetch(`${CSV_BASE}/squads.csv`)).text()
  const squadsRaw  = parseCSV(squadsText)
  console.log(`  → ${squadsRaw.length} filas`)

  console.log('Descargando goals.csv...')
  const goalsText = await (await fetch(`${CSV_BASE}/goals.csv`)).text()
  const goalsRaw  = parseCSV(goalsText)
  console.log(`  → ${goalsRaw.length} filas`)

  // Índice de goles por player_id (excluye goles en contra)
  const goalsByPlayer = {}
  for (const g of goalsRaw) {
    if (g.own_goal === '1') continue
    if (!g.player_id) continue
    // Solo torneos masculinos
    const y = parseInt((g.tournament_id || '').replace('WC-', ''))
    if (!MENS_WC_YEARS.has(y)) continue
    goalsByPlayer[g.player_id] = (goalsByPlayer[g.player_id] || 0) + 1
  }

  // Agrupar squads por torneo + equipo
  const grouped = {}
  for (const row of squadsRaw) {
    const tid      = row.tournament_id || ''
    const teamCode = row.team_code || ''
    if (!tid || !teamCode) continue
    const year = parseInt(tid.replace('WC-', ''))
    if (!MENS_WC_YEARS.has(year)) continue
    if (YEAR_FILTER && year !== YEAR_FILTER) continue
    if (TEAM_FILTER && teamCode !== TEAM_FILTER) continue
    const key = `${year}:${teamCode}`
    if (!grouped[key]) grouped[key] = { year, teamCode, teamName: row.team_name, players: [] }
    grouped[key].players.push(row)
  }

  console.log(`\nGenerando ${Object.keys(grouped).length} archivos...\n`)

  const existingFiles = new Set(fs.readdirSync(DATA_DIR))
  const matchedOvKeys = new Set()
  let generated = 0, skipped = 0, overrideHits = 0, algoCount = 0

  const generatedSquads = {}  // year → [slugs]

  for (const [key, { year, teamCode, teamName, players }] of Object.entries(grouped)) {
    const teamSlugVal = slugify(teamName)
    const filename = `${year}-${teamSlugVal}.json`

    if (!FORCE && existingFiles.has(filename)) {
      skipped++
      if (!generatedSquads[year]) generatedSquads[year] = []
      if (!generatedSquads[year].includes(teamSlugVal)) generatedSquads[year].push(teamSlugVal)
      continue
    }

    const teamInfo = TEAM_MAP[teamCode] || {
      name: teamName,
      conf: 'UEFA',
    }

    // Separar por posición y asignar posición específica
    const groups = { GK: [], DF: [], MF: [], FW: [] }
    for (const p of players) {
      const pc = p.position_code || 'MF'
      if (!groups[pc]) groups[pc] = []
      groups[pc].push(p)
    }

    const outputPlayers = []
    const usedIds = new Map()  // id → count, para evitar duplicados

    for (const [posCode, group] of Object.entries(groups)) {
      group.forEach((p, idx) => {
        const familyName = p.family_name || ''
        const givenName  = p.given_name === 'not applicable' ? '' : (p.given_name || '')
        const playerName = givenName ? `${givenName} ${familyName}` : familyName
        const playerId   = p.player_id || ''
        const goals      = goalsByPlayer[playerId] || 0

        const ov = lookupOverride(playerName, familyName, givenName, teamCode, year)
        const seedStr = `${year}:${teamCode}:${familyName}`
        const seed    = seedHash(seedStr)

        let rating, position, altPositions

        if (ov) {
          overrideHits++
          matchedOvKeys.add(ov.key)
          rating = ov.r
          position = ov.pos
          altPositions = ov.alt || []
        } else {
          algoCount++
          const baseByGroup = { GK: 73, DF: 72, MF: 73, FW: 74 }
          const base = baseByGroup[posCode] || 73
          const variance = Math.round((seed - 0.5) * 10)
          const goalBonus = posCode === 'FW' ? Math.min(goals, 5) * 1.5
                          : posCode === 'MF' ? Math.min(goals, 3) * 0.8
                          : 0
          rating = Math.min(80, Math.max(65, Math.round(base + variance + goalBonus)))
          position = assignPosition(posCode, idx)
          altPositions = []

          // Alt positions automáticas
          if (posCode === 'DF') {
            if (position === 'DFC' && seed > 0.75) altPositions = [{ position: 'LD', compatibility: 'puede' }]
            else if (position === 'LD' && seed > 0.8) altPositions = [{ position: 'DFC', compatibility: 'puede' }]
            else if (position === 'LI' && seed > 0.8) altPositions = [{ position: 'DFC', compatibility: 'puede' }]
          } else if (posCode === 'MF') {
            if (position === 'MC' && seed > 0.7) altPositions = [{ position: 'MCO', compatibility: 'puede' }]
            else if (position === 'MCO' && seed > 0.7) altPositions = [{ position: 'MC', compatibility: 'puede' }]
            else if (position === 'MCD' && seed > 0.75) altPositions = [{ position: 'MC', compatibility: 'puede' }]
          } else if (posCode === 'FW') {
            if (position === 'DC' && seed > 0.7) altPositions = [{ position: 'EI', compatibility: 'puede' }]
            else if (position === 'EI' && seed > 0.75) altPositions = [{ position: 'DC', compatibility: 'puede' }]
            else if (position === 'ED' && seed > 0.75) altPositions = [{ position: 'DC', compatibility: 'puede' }]
          }
        }

        const stats = generateStats(position, rating, seedStr)
        const baseId = slugify(`${teamCode.toLowerCase()}${String(year).slice(2)}-${familyName}`) || `p${playerId}`
        const idCount = usedIds.get(baseId) || 0
        usedIds.set(baseId, idCount + 1)
        const finalId = idCount === 0 ? baseId : `${baseId}${idCount + 1}`

        const playerObj = {
          id: finalId,
          name: playerName || familyName,
          position,
          altPositions,
          stats,
          rating,
          country: teamInfo.name,
          tournamentYear: year,
          tournamentId: `wc-${year}`,
        }
        if (goals > 0) playerObj.goals = goals
        outputPlayers.push(playerObj)
      })
    }

    // Ordenar POR → DEF → MID → FWD, luego rating desc
    const POS_GROUP = { POR:0,LD:1,DFC:1,LI:1,MCD:2,MC:2,MCO:2,MD:2,MI:2,EI:3,ED:3,DC:3 }
    outputPlayers.sort((a,b) => {
      const gA = POS_GROUP[a.position] ?? 4, gB = POS_GROUP[b.position] ?? 4
      return gA !== gB ? gA - gB : b.rating - a.rating
    })

    const squadJson = {
      country: teamInfo.name,
      countryCode: teamCode,
      confederation: teamInfo.conf,
      year,
      tournamentId: `wc-${year}`,
      players: outputPlayers,
    }

    fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(squadJson, null, 2), 'utf8')
    generated++

    if (!generatedSquads[year]) generatedSquads[year] = []
    generatedSquads[year].push(teamSlugVal)

    process.stdout.write(`  ✓ ${filename} (${outputPlayers.length} jugadores)\n`)
  }

  // Actualizar index.json
  const indexPath = path.join(DATA_DIR, 'index.json')
  const index = JSON.parse(fs.readFileSync(indexPath, 'utf8'))
  for (const [yr, squads] of Object.entries(generatedSquads)) {
    const year = parseInt(yr)
    const meta = TOURNAMENT_META[year] || { host: '?', winner: '?' }
    const existing = index.tournaments.find(t => t.year === year)
    if (existing) {
      for (const s of squads) if (!existing.squads.includes(s)) existing.squads.push(s)
    } else {
      index.tournaments.push({ id:`wc-${year}`, type:'world-cup', year, host:meta.host, winner:meta.winner, squads })
    }
  }
  index.tournaments.sort((a,b) => a.year - b.year)
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf8')

  console.log('\n─────────────────────────────')
  console.log(`Generados:   ${generated}`)
  console.log(`Omitidos:    ${skipped} (existen — usar --force para regenerar)`)
  console.log(`Overrides:   ${overrideHits} jugadores con rating curado`)
  console.log(`Algorítmico: ${algoCount} jugadores`)
  console.log('─────────────────────────────')

  const unused = Object.keys(OVERRIDES).filter(k => !matchedOvKeys.has(k))
  if (unused.length) {
    console.log(`\n⚠ ${unused.length} overrides sin match (posible error de clave):`)
    unused.slice(0, 15).forEach(k => console.log(`   ${k}`))
    if (unused.length > 15) console.log(`   ... y ${unused.length - 15} más`)
  }
}

main().catch(err => { console.error(err); process.exit(1) })
