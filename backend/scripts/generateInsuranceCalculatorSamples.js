#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data', 'insurance');
const TYPES = {
  car: 'car-calculator-samples',
  apartment: 'apartment-calculator-samples',
  life: 'life-calculator-samples',
  health: 'health-calculator-samples',
};
const CREATED_AT = '2026-07-08T00:00:00.000Z';
const BASED_ON = 'Simulated from official Israeli insurance calculator logic';

const COMPANIES = [
  { name: 'Harel', price: 1.04, service: 88, deductible: 0.95 },
  { name: 'Migdal', price: 0.99, service: 84, deductible: 1.0 },
  { name: 'Clal', price: 0.96, service: 81, deductible: 1.08 },
  { name: 'Phoenix', price: 1.08, service: 90, deductible: 0.9 },
  { name: 'Menora Mivtachim', price: 1.02, service: 83, deductible: 1.0 },
  { name: 'Ayalon', price: 0.93, service: 76, deductible: 1.15 },
  { name: 'Direct Insurance', price: 0.9, service: 74, deductible: 1.18 },
  { name: 'Shlomo Insurance', price: 0.88, service: 70, deductible: 1.22 },
  { name: 'Libra', price: 0.91, service: 78, deductible: 1.12 },
  { name: 'WeSure', price: 0.94, service: 79, deductible: 1.1 },
];

const PROFILES = [
  { gender: 'male', age: 18 },
  { gender: 'female', age: 18 },
  { gender: 'male', age: 30 },
  { gender: 'female', age: 30 },
  { gender: 'male', age: 40 },
  { gender: 'female', age: 40 },
  { gender: 'male', age: 55 },
  { gender: 'female', age: 55 },
  { gender: 'male', age: 70 },
  { gender: 'female', age: 70 },
];

const COMPANY_ROTATION = [
  ['Harel', 'Migdal', 'Clal', 'Phoenix', 'Direct Insurance'],
  ['Menora Mivtachim', 'Ayalon', 'Libra', 'WeSure', 'Shlomo Insurance'],
  ['Phoenix', 'Harel', 'Direct Insurance', 'Clal', 'Libra'],
  ['Migdal', 'Menora Mivtachim', 'WeSure', 'Ayalon', 'Shlomo Insurance'],
  ['Harel', 'Phoenix', 'Migdal', 'Clal', 'Ayalon'],
  ['Menora Mivtachim', 'Libra', 'Direct Insurance', 'WeSure', 'Shlomo Insurance'],
  ['Ayalon', 'Harel', 'Phoenix', 'Libra', 'Direct Insurance'],
  ['Clal', 'Migdal', 'Menora Mivtachim', 'WeSure', 'Shlomo Insurance'],
  ['Harel', 'Phoenix', 'Migdal', 'Clal', 'Ayalon'],
  ['Menora Mivtachim', 'Libra', 'Direct Insurance', 'WeSure', 'Shlomo Insurance'],
];

function companyByName(name) {
  return COMPANIES.find(c => c.name === name);
}

function roundTo(value, step = 1) {
  return Math.round(value / step) * step;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function yearly(monthly) {
  return monthly * 12;
}

function scoreFrom({ service, monthly, deductible, baseline, coverageBoost = 0 }) {
  const priceValue = clamp(92 - ((monthly - baseline) / baseline) * 42, 45, 96);
  const deductiblePenalty = deductible ? clamp(deductible / 450, 0, 11) : 0;
  return Math.round(clamp(service * 0.48 + priceValue * 0.38 + coverageBoost - deductiblePenalty, 1, 100));
}

function recordId(type, profile, index) {
  return `${type}-${profile.gender}-${profile.age}-${String(index + 1).padStart(2, '0')}`;
}

function carBase(profile, coverageType) {
  const ageFactor = profile.age < 30 ? 1.65
    : profile.age < 40 ? 1.12
      : profile.age < 50 ? 1
        : profile.age < 60 ? 1.15
          : 1.28;
  const genderFactor = profile.age === 18 && profile.gender === 'male' ? 1.08 : 1;
  const coverageBase = {
    'mandatory_only': 145,
    'third_party_mandatory': 290,
    'comprehensive_mandatory': 590,
  }[coverageType];
  return coverageBase * ageFactor * genderFactor;
}

function buildCarOffer(profile, companyName, index, profileIndex) {
  const company = companyByName(companyName);
  const variants = [
    {
      coverageType: 'mandatory_only',
      vehicleYear: 2017,
      vehicleType: 'compact_used',
      assetValue: 42000,
      addOns: [],
      deductibleBase: null,
      coverageBoost: -2,
    },
    {
      coverageType: 'third_party_mandatory',
      vehicleYear: 2019,
      vehicleType: 'family_sedan',
      assetValue: 76000,
      addOns: ['third_party_liability'],
      deductibleBase: 1200,
      coverageBoost: 2,
    },
    {
      coverageType: 'comprehensive_mandatory',
      vehicleYear: 2022,
      vehicleType: 'family_sedan',
      assetValue: 128000,
      addOns: ['roadside_assistance', 'replacement_car'],
      deductibleBase: 1600,
      coverageBoost: 8,
    },
    {
      coverageType: 'comprehensive_mandatory',
      vehicleYear: 2024,
      vehicleType: 'electric_suv',
      assetValue: 190000,
      addOns: ['roadside_assistance', 'replacement_car', 'windshield_cover'],
      deductibleBase: 1800,
      coverageBoost: 11,
    },
    {
      coverageType: 'third_party_mandatory',
      vehicleYear: 2021,
      vehicleType: 'small_crossover',
      assetValue: 99000,
      addOns: ['third_party_liability', 'windshield_cover'],
      deductibleBase: 1100,
      coverageBoost: 4,
    },
  ];
  const v = variants[index];
  const vehicleFactor = v.vehicleType === 'electric_suv' ? 1.24 : v.vehicleYear >= 2022 ? 1.12 : 1;
  const monthly = roundTo(clamp(carBase(profile, v.coverageType) * vehicleFactor * company.price, 80, 1200));
  const deductible = v.deductibleBase == null ? null : roundTo(v.deductibleBase * company.deductible, 50);

  return {
    id: recordId('car', profile, index),
    insuranceType: 'car',
    companyName,
    userProfile: { ...profile, smoker: null },
    parameters: {
      coverageType: v.coverageType,
      coverageAmount: null,
      assetValue: v.assetValue,
      vehicleYear: v.vehicleYear,
      vehicleType: v.vehicleType,
      apartmentSizeSqm: null,
      apartmentFloor: null,
      city: ['Tel Aviv', 'Haifa', 'Jerusalem'][profileIndex % 3],
      addOns: v.addOns,
    },
    monthlyPremiumNis: monthly,
    yearlyPremiumNis: yearly(monthly),
    deductibleNis: deductible,
    coverageSummary: `${v.coverageType.replace(/_/g, ' ')} for a ${v.vehicleYear} ${v.vehicleType.replace(/_/g, ' ')}`,
    score: scoreFrom({ service: company.service, monthly, deductible, baseline: carBase(profile, v.coverageType), coverageBoost: v.coverageBoost }),
    dataSourceType: 'synthetic_calculator_sample',
    basedOn: BASED_ON,
    isRealQuote: false,
    createdAt: CREATED_AT,
  };
}

function apartmentBase(coverageType, size, value, addOns) {
  const coverageBase = {
    structure_only: 72,
    contents_only: 56,
    structure_contents: 125,
  }[coverageType];
  const sizeFactor = 1 + Math.max(0, size - 80) * 0.006;
  const valueFactor = 1 + Math.max(0, value - 1200000) / 1200000 * 0.18;
  const addonFactor = 1 + addOns.length * 0.08;
  return coverageBase * sizeFactor * valueFactor * addonFactor;
}

function buildApartmentOffer(profile, companyName, index, profileIndex) {
  const company = companyByName(companyName);
  const variants = [
    ['structure_only', 75, 1100000, 2, 'Haifa', ['water_damage']],
    ['contents_only', 90, 1350000, 5, 'Beer Sheva', ['third_party_liability']],
    ['structure_contents', 100, 1650000, 7, 'Jerusalem', ['water_damage', 'third_party_liability']],
    ['structure_contents', 125, 2300000, 12, 'Tel Aviv', ['earthquake', 'water_damage', 'third_party_liability']],
    ['structure_only', 110, 1850000, 3, 'Rishon LeZion', ['earthquake', 'water_damage']],
  ];
  const [coverageType, size, value, floor, city, addOns] = variants[index];
  const monthly = roundTo(clamp(apartmentBase(coverageType, size, value, addOns) * company.price, 40, 320));
  const deductible = roundTo((coverageType === 'contents_only' ? 600 : 950) * company.deductible, 50);

  return {
    id: recordId('apartment', profile, index),
    insuranceType: 'apartment',
    companyName,
    userProfile: { ...profile, smoker: null },
    parameters: {
      coverageType,
      coverageAmount: null,
      assetValue: value,
      vehicleYear: null,
      vehicleType: null,
      apartmentSizeSqm: size,
      apartmentFloor: floor,
      city: profileIndex % 2 === 0 ? city : ['Givatayim', 'Netanya', 'Petah Tikva', city][index % 4],
      addOns,
    },
    monthlyPremiumNis: monthly,
    yearlyPremiumNis: yearly(monthly),
    deductibleNis: deductible,
    coverageSummary: `${coverageType.replace(/_/g, ' ')} for ${size} sqm apartment, asset value ${value} NIS`,
    score: scoreFrom({ service: company.service, monthly, deductible, baseline: apartmentBase(coverageType, size, value, addOns), coverageBoost: addOns.length * 2 }),
    dataSourceType: 'synthetic_calculator_sample',
    basedOn: BASED_ON,
    isRealQuote: false,
    createdAt: CREATED_AT,
  };
}

function lifeBase(profile, smoker, coverageAmount) {
  const ageBase = profile.age < 30 ? 34
    : profile.age < 40 ? 62
      : profile.age < 50 ? 105
        : profile.age < 60 ? 230
          : 660;
  const genderFactor = profile.gender === 'male' ? 1.08 : 0.94;
  const smokerFactor = smoker ? (profile.age === 70 ? 1.55 : 1.7) : 1;
  const coverageFactor = coverageAmount / 500000;
  return ageBase * genderFactor * smokerFactor * coverageFactor;
}

function buildLifeOffer(profile, companyName, index) {
  const company = companyByName(companyName);
  const variants = [
    [false, 500000, 'term_life_500k', []],
    [true, 500000, 'term_life_500k_smoker', ['smoker_loading']],
    [false, 750000, 'term_life_750k', ['accelerated_claims']],
    [true, 750000, 'term_life_750k_smoker', ['smoker_loading', 'accelerated_claims']],
    [false, 1000000, 'term_life_1m', ['accelerated_claims', 'premium_waiver']],
  ];
  const [smoker, coverageAmount, coverageType, addOns] = variants[index];
  const baseline = lifeBase(profile, smoker, coverageAmount);
  const monthly = roundTo(clamp(baseline * company.price, 20, 1800));

  return {
    id: recordId('life', profile, index),
    insuranceType: 'life',
    companyName,
    userProfile: { ...profile, smoker },
    parameters: {
      coverageType,
      coverageAmount,
      assetValue: null,
      vehicleYear: null,
      vehicleType: null,
      apartmentSizeSqm: null,
      apartmentFloor: null,
      city: null,
      addOns,
    },
    monthlyPremiumNis: monthly,
    yearlyPremiumNis: yearly(monthly),
    deductibleNis: null,
    coverageSummary: `${coverageAmount} NIS term life coverage${smoker ? ' for smoker profile' : ''}`,
    score: scoreFrom({ service: company.service, monthly, deductible: null, baseline, coverageBoost: coverageAmount >= 1000000 ? 6 : 2 }),
    dataSourceType: 'synthetic_calculator_sample',
    basedOn: BASED_ON,
    isRealQuote: false,
    createdAt: CREATED_AT,
  };
}

function healthBase(profile, coverageType) {
  const ageBase = profile.age < 30 ? 82
    : profile.age < 40 ? 130
      : profile.age < 50 ? 190
        : profile.age < 60 ? 330
          : 610;
  const coverageFactor = {
    basic: 0.75,
    standard_private_surgery: 1,
    premium_private_surgery_consultations: 1.45,
    premium_surgery_drugs_transplants: 1.75,
    family_extended_consultations: 1.22,
  }[coverageType];
  return ageBase * coverageFactor;
}

function buildHealthOffer(profile, companyName, index) {
  const company = companyByName(companyName);
  const variants = [
    ['basic', 150000, []],
    ['standard_private_surgery', 300000, ['private_surgery']],
    ['premium_private_surgery_consultations', 500000, ['private_surgery', 'specialist_consultations']],
    ['premium_surgery_drugs_transplants', 750000, ['private_surgery', 'drugs_outside_basket', 'transplants']],
    ['family_extended_consultations', 400000, ['specialist_consultations', 'ambulatory_services']],
  ];
  const [coverageType, coverageAmount, addOns] = variants[index];
  const baseline = healthBase(profile, coverageType);
  const monthly = roundTo(clamp(baseline * company.price, 40, 1200));
  const deductible = roundTo((coverageType === 'basic' ? 250 : 450) * company.deductible, 50);

  return {
    id: recordId('health', profile, index),
    insuranceType: 'health',
    companyName,
    userProfile: { ...profile, smoker: null },
    parameters: {
      coverageType,
      coverageAmount,
      assetValue: null,
      vehicleYear: null,
      vehicleType: null,
      apartmentSizeSqm: null,
      apartmentFloor: null,
      city: null,
      addOns,
    },
    monthlyPremiumNis: monthly,
    yearlyPremiumNis: yearly(monthly),
    deductibleNis: deductible,
    coverageSummary: `${coverageType.replace(/_/g, ' ')} health package with ${coverageAmount} NIS indicative coverage`,
    score: scoreFrom({ service: company.service, monthly, deductible, baseline, coverageBoost: addOns.length * 3 }),
    dataSourceType: 'synthetic_calculator_sample',
    basedOn: BASED_ON,
    isRealQuote: false,
    createdAt: CREATED_AT,
  };
}

function buildRecords() {
  const builders = {
    car: buildCarOffer,
    apartment: buildApartmentOffer,
    life: buildLifeOffer,
    health: buildHealthOffer,
  };
  const records = [];
  Object.entries(builders).forEach(([type, builder]) => {
    PROFILES.forEach((profile, profileIndex) => {
      COMPANY_ROTATION[profileIndex].forEach((companyName, index) => {
        records.push(builder(profile, companyName, index, profileIndex));
      });
    });
  });
  return records;
}

function csvEscape(value) {
  if (value == null) return '';
  const s = Array.isArray(value) ? value.join(';') : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(records) {
  const headers = [
    'id',
    'insuranceType',
    'companyName',
    'gender',
    'age',
    'smoker',
    'coverageType',
    'coverageAmount',
    'assetValue',
    'vehicleYear',
    'vehicleType',
    'apartmentSizeSqm',
    'apartmentFloor',
    'city',
    'addOns',
    'monthlyPremiumNis',
    'yearlyPremiumNis',
    'deductibleNis',
    'coverageSummary',
    'score',
    'dataSourceType',
    'basedOn',
    'isRealQuote',
    'createdAt',
  ];
  const rows = records.map(r => [
    r.id,
    r.insuranceType,
    r.companyName,
    r.userProfile.gender,
    r.userProfile.age,
    r.userProfile.smoker,
    r.parameters.coverageType,
    r.parameters.coverageAmount,
    r.parameters.assetValue,
    r.parameters.vehicleYear,
    r.parameters.vehicleType,
    r.parameters.apartmentSizeSqm,
    r.parameters.apartmentFloor,
    r.parameters.city,
    r.parameters.addOns,
    r.monthlyPremiumNis,
    r.yearlyPremiumNis,
    r.deductibleNis,
    r.coverageSummary,
    r.score,
    r.dataSourceType,
    r.basedOn,
    r.isRealQuote,
    r.createdAt,
  ]);
  return [headers, ...rows].map(row => row.map(csvEscape).join(',')).join('\n');
}

function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const records = buildRecords();

  for (const [type, dirName] of Object.entries(TYPES)) {
    const typeDir = path.join(DATA_DIR, dirName);
    fs.mkdirSync(typeDir, { recursive: true });
    const typeRecords = records.filter(record => record.insuranceType === type);
    const jsonFile = path.join(typeDir, `synthetic-${type}-offers.json`);
    const csvFile = path.join(typeDir, `synthetic-${type}-offers.csv`);
    fs.writeFileSync(jsonFile, `${JSON.stringify(typeRecords, null, 2)}\n`);
    fs.writeFileSync(csvFile, `${writeCsv(typeRecords)}\n`);
  }

  console.log(`Generated ${records.length} synthetic insurance calculator samples`);
  console.log(DATA_DIR);
}

if (require.main === module) {
  main();
}

module.exports = { buildRecords };
