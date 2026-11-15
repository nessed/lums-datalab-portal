// Drafting aid for site/editorial/titles.json (round 2, unattended run, 2026-11-15).
//
//   node scripts/draft-titles.mjs            writes editorial/titles.json if it does not exist
//   node scripts/draft-titles.mjs --force    overwrites it (loses every hand edit made in the file)
//   node scripts/draft-titles.mjs --stdout   prints the draft instead of writing it
//
// It composes a short plain title and a one-sentence summary for every series of
// the release from the series' own dims and printed names, and takes the important
// series (headline cards, roots, everything the editorial files name, the budget
// summary and receipts lines) from the HAND table below, written by hand. It was
// run once; its output was then reviewed and hand-fixed in the JSON file. THE FILE
// IS THE SOURCE OF TRUTH, not this script: never re-run it with --force without
// carrying the hand fixes over. It never reads or writes a number: titles and
// summaries carry no digits (scripts/checks/titles.mjs fails the build otherwise).
//
// Rules (also in the file's $comment):
//   - a title is the words a reader would use, unique across the release, no digits;
//     siblings are told apart in words (urban, rural, women, earlier base, new definition);
//   - a title never claims more than the series is: budget function lines say which
//     part of spending they are (current, development, PSDP, which account);
//   - a summary is one sentence, no digits, at most 130 characters, and says what the
//     figure is; the full printed definition stays in About.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const siteDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cfg = JSON.parse(fs.readFileSync(path.join(siteDir, "release.config.json"), "utf8"));
const relDir = path.resolve(siteDir, "..", "releases", cfg.version);
const series = JSON.parse(fs.readFileSync(path.join(relDir, "series.json"), "utf8"));
const out = path.join(siteDir, "editorial", "titles.json");

const TITLE_MAX = 72;
const SUMMARY_MAX = 130;

/* ------------------------------------------------------------------ */
/* Hand-written entries: id -> [title, summary]                        */
/* ------------------------------------------------------------------ */
const HAND = {
  // Prices: headline and root series.
  "cpi.national.yoy.general": ["Inflation", "How much consumer prices rose compared with the same month a year earlier, across Pakistan."],
  "cpi.urban.yoy.general": ["Inflation, urban", "How much consumer prices in towns and cities rose compared with the same month a year earlier."],
  "cpi.rural.yoy.general": ["Inflation, rural", "How much consumer prices in rural areas rose compared with the same month a year earlier."],
  "cpi.yoy.general.b2007_08": ["Inflation, earlier base", "Yearly rise in consumer prices on the index used before the rebasing; that table prints no area, so it is kept apart."],
  "cpi.national.mom.general": ["Monthly price change", "How much consumer prices changed compared with the previous month, across Pakistan."],
  "cpi.urban.mom.general": ["Monthly price change, urban", "How much consumer prices in towns and cities changed compared with the previous month."],
  "cpi.rural.mom.general": ["Monthly price change, rural", "How much consumer prices in rural areas changed compared with the previous month."],
  "cpi.mom.general.b2007_08": ["Monthly price change, earlier base", "Change in consumer prices over the previous month on the index used before the rebasing; no area is printed."],
  "cpi.national.general.b2015_16": ["Consumer price index", "The level of consumer prices across Pakistan, as an index where the average of the base year is one hundred."],
  "cpi.urban.general.b2015_16": ["Consumer price index, urban", "The level of consumer prices in towns and cities, as an index where the average of the base year is one hundred."],
  "cpi.rural.general.b2015_16": ["Consumer price index, rural", "The level of consumer prices in rural areas, as an index where the average of the base year is one hundred."],
  "cpi.general.b2007_08": ["Consumer price index, earlier base", "Consumer price level on the index used before the rebasing; that table prints no area, so it is kept apart."],
  "cpi.national.yoy.group.food": ["Food inflation", "How much prices of food and non-alcoholic drinks rose compared with the same month a year earlier, across Pakistan."],

  // Jobs: headline series.
  "lfs.unemployment_rate.total.total": ["Unemployment rate", "Share of the labour force, aged ten and over, who are out of work and looking for work, across Pakistan."],
  "lfs.unemployment_rate.female.total": ["Unemployment rate, women", "Share of women in the labour force, aged ten and over, who are out of work and looking for work, across Pakistan."],
  "lfs.unemployment_rate.male.total": ["Unemployment rate, men", "Share of men in the labour force, aged ten and over, who are out of work and looking for work, across Pakistan."],
  "lfs.labour_force.total.total": ["Labour force", "Number of people aged ten and over who are working or looking for work, across Pakistan."],
  "lfs.employed.total.total": ["Employed people", "Number of people aged ten and over who are in work, across Pakistan."],
  "lfs.unemployed.total.total": ["Unemployed people", "Number of people aged ten and over who are out of work and looking for work, across Pakistan."],
  "lfs.lfpr_refined.total.total": ["Participation rate", "Share of people aged ten and over who are working or looking for work, across Pakistan."],
  "lfs.lfpr_crude.total.total": ["Crude participation rate", "The labour force as a share of the whole population, all ages counted, across Pakistan."],
  "lfs.employment_share.industry.all.total.total": ["Share of workers, all industries", "All employed people, the total that the shares of each industry are taken from, across Pakistan."],

  // Spending: the Summary of Expenditure.
  "fed.exp.total": ["Total federal spending", "Everything the federal government budgets to spend in a year, current and development, as the budget statement prints it."],
  "fed.exp.current.total": ["Federal current spending", "Federal spending other than development, on revenue and capital account together."],
  "fed.exp.current.revenue_account": ["Federal current spending, revenue account", "The revenue-account part of federal current spending; the budget splits it by function, such as defence and health."],
  "fed.exp.current.capital_account": ["Federal current spending, capital account", "The capital-account part of federal current spending, such as repayments of foreign loans and credits."],
  "fed.exp.current.capital_account.foreign_loans_repayment": ["Foreign loan repayments", "Federal repayments of foreign loans, a line of current spending on capital account in the summary table."],
  "fed.exp.current.capital_account.short_term_foreign_credits_repayment": ["Short-term foreign credit repayments", "Federal repayments of short-term foreign credits, a line of current spending on capital account in the summary table."],
  "fed.exp.current.capital_account.transfers": ["Capital-account transfers", "Transfers recorded under federal current spending on capital account in the summary table."],
  "fed.exp.development.total": ["Federal development spending", "Federal spending on development, on revenue and capital account together, as the summary table prints it."],
  "fed.exp.development.revenue_account": ["Development spending, revenue account", "The revenue-account part of federal development spending."],
  "fed.exp.development.capital_account": ["Development spending, capital account", "The capital-account part of federal development spending."],
  "fed.exp.development.revenue_account.psdp": ["PSDP spending, revenue account", "The Public Sector Development Programme part of development spending on revenue account, printed in older editions."],
  "fed.exp.development.revenue_account.other": ["Other development spending, revenue account", "Development spending on revenue account outside the Public Sector Development Programme, printed in older editions."],
  "fed.exp.development.capital_account.psdp": ["PSDP spending, capital account", "The Public Sector Development Programme part of development spending on capital account, printed in older editions."],
  "fed.exp.development.capital_account.other": ["Other development spending, capital account", "Development spending on capital account outside the Public Sector Development Programme, printed in older editions."],
  "fed.exp.development.psdp_total": ["Total PSDP", "The Public Sector Development Programme total as older budget statements print it, revenue and capital account together."],
  "fed.exp.operational_shortfall": ["PSDP operational shortfall", "An estimated shortfall in the development programme that some budget statements print as a line of total spending."],
  "fed.exp.account.revenue": ["Federal spending on revenue account", "Federal spending on revenue account, current and development together, as the summary table breaks it up."],
  "fed.exp.account.capital": ["Federal spending on capital account", "Federal spending on capital account, current and development together, as the summary table breaks it up."],
  "fed.exp.current.function.education_affairs_and_services.share_of_total": [
    "Education share of federal spending (current)",
    "Federal current spending on education, revenue account only, as a share of total federal spending in the same budget column.",
  ],
  "fed.exp.current.function.health.share_of_total": [
    "Health share of federal spending (current)",
    "Federal current spending on health, revenue account only, as a share of total federal spending in the same budget column.",
  ],

  // Revenue: the Summary of Receipts.
  "fed.rev.total_resources": ["Total federal resources", "Net federal resources plus the financing lines the edition prints, such as the provinces' cash surplus and bank borrowing."],
  "fed.rev.net_federal_resources": ["Net federal resources", "What federal receipts come to after the provinces' share of federal taxes is taken out."],
  "fed.rev.gross_federal_resources": ["Gross federal resources", "All federal receipts before the provinces' share of federal taxes is taken out."],
  "fed.rev.provincial_share": ["Provinces' share of federal taxes", "The part of federal tax collection that goes to the provinces, taken out of gross federal resources."],
  "fed.rev.internal_and_external": ["Internal and external receipts", "Federal receipts from inside the country and from abroad, before the public account and the provinces' share."],
  "fed.rev.internal": ["Internal receipts", "Federal receipts from inside the country: revenue plus capital receipts."],
  "fed.rev.revenue": ["Federal revenue receipts", "Federal tax and non-tax revenue together, as the budget statement prints it."],
  "fed.rev.tax": ["Federal tax revenue", "Taxes the federal government collects; what the line includes changes between editions, as About explains."],
  "fed.rev.tax.fbr": ["FBR taxes", "Taxes collected by the Federal Board of Revenue."],
  "fed.rev.tax.direct": ["Direct taxes", "Federal taxes on income and other direct taxes."],
  "fed.rev.tax.direct.income": ["Income tax", "Federal taxes on income, listed under direct taxes."],
  "fed.rev.tax.direct.workers_welfare_fund": ["Workers' Welfare Fund", "Receipts of the Workers' Welfare Fund, listed under direct taxes."],
  "fed.rev.tax.direct.workers_profit_participation_fund": ["Workers' Profit Participation Fund", "Receipts of the Workers' Profit Participation Fund, listed under direct taxes."],
  "fed.rev.tax.direct.capital_value_tax": ["Capital value tax", "Capital value tax, listed under direct taxes."],
  "fed.rev.tax.indirect": ["Indirect taxes", "Federal taxes on goods, services and imports, such as sales tax, customs and excise."],
  "fed.rev.tax.indirect.customs": ["Customs duties", "Duties on imports and exports, listed under indirect taxes."],
  "fed.rev.tax.indirect.sales_tax": ["Sales tax", "Federal sales tax, listed under indirect taxes."],
  "fed.rev.tax.indirect.federal_excise": ["Federal excise", "Federal excise duty, listed under indirect taxes."],
  "fed.rev.tax.indirect.petroleum_levy": ["Petroleum levy (under indirect taxes)", "The petroleum levy in the editions that list it under indirect taxes; other editions list it elsewhere."],
  "fed.rev.tax.indirect.ict_taxes": ["Islamabad taxes (under indirect taxes)", "Taxes of the Islamabad Capital Territory in the editions that list them under indirect taxes."],
  "fed.rev.tax.indirect.airport_tax": ["Airport tax (under indirect taxes)", "Airport tax in the editions that list it under indirect taxes; other editions list it elsewhere."],
  "fed.rev.tax.other": ["Other taxes", "Federal taxes listed apart from direct and indirect taxes, such as the petroleum levy and gas cess, in some editions."],
  "fed.rev.tax.other.other_indirect_taxes_ict": ["Other indirect taxes, Islamabad", "Other indirect taxes of the Islamabad Capital Territory, listed under other taxes."],
  "fed.rev.tax.other.airport_tax": ["Airport tax (under other taxes)", "Airport tax in the editions that list it under other taxes; other editions list it elsewhere."],
  "fed.rev.tax.other.gas_infrastructure_development_cess": ["Gas infrastructure development cess", "The gas infrastructure development cess, listed under other taxes."],
  "fed.rev.tax.other.natural_gas_development_surcharge": ["Natural gas development surcharge", "The natural gas development surcharge, listed under other taxes."],
  "fed.rev.tax.other.petroleum_levy": ["Petroleum levy (under other taxes)", "The petroleum levy in the editions that list it under other taxes; other editions list it elsewhere."],
  "fed.rev.nontax": ["Federal non-tax revenue", "Federal revenue other than taxes, such as fees, profits of state enterprises and interest."],
  "fed.rev.nontax.levies_and_fees": ["Levies and fees", "Levies and fees, listed under non-tax revenue."],
  "fed.rev.nontax.property_and_enterprise": ["Income from property and enterprise", "Federal income from property and enterprise, such as profits and dividends, listed under non-tax revenue."],
  "fed.rev.nontax.civil_administration": ["Receipts from civil administration", "Receipts from civil administration and similar heads, listed under non-tax revenue."],
  "fed.rev.nontax.miscellaneous": ["Miscellaneous receipts", "Miscellaneous receipts, listed under non-tax revenue."],
  "fed.rev.capital": ["Capital receipts", "Federal capital receipts, such as net domestic borrowing and recovered loans."],
  "fed.rev.capital.recovery_of_loans_and_advances": ["Recovery of loans and advances", "Loans and advances the federal government gets back, listed under capital receipts."],
  "fed.rev.capital.domestic_debt_net": ["Domestic borrowing, net", "Federal borrowing at home minus repayments, listed under capital receipts."],
  "fed.rev.capital.domestic_debt_non_bank_net": ["Domestic non-bank borrowing, net", "Federal borrowing at home outside the banks, minus repayments, listed under capital receipts."],
  "fed.rev.capital.domestic_debt_bank_net": ["Domestic bank borrowing, net (capital receipts)", "A bank borrowing line one edition prints under capital receipts; kept apart until a person checks the label."],
  "fed.rev.domestic_debt_bank_net": ["Domestic bank borrowing, net (financing)", "A financing line newer editions print where older ones print credit from banks; kept apart until a person confirms it."],
  "fed.rev.credit_from_banking_sector": ["Credit from banks", "Federal borrowing from the banking sector, a financing line of total resources in earlier editions."],
  "fed.rev.external": ["External receipts", "Federal receipts from abroad: foreign loans and grants."],
  "fed.rev.external.loans": ["Foreign loans", "Loans the federal government expects from abroad, listed under external receipts."],
  "fed.rev.external.grants": ["Foreign grants", "Grants the federal government expects from abroad, listed under external receipts."],
  "fed.rev.external.project_loans_and_grants_outside_psdp": ["Project loans and grants outside PSDP", "Foreign project loans and grants outside the development programme, listed under external receipts."],
  "fed.rev.public_account": ["Public account receipts, net", "Net receipts of the federal public account, such as deposits, reserves and deferred liabilities."],
  "fed.rev.public_account.deferred_liabilities": ["Deferred liabilities, net", "Net deferred liabilities, listed under public account receipts."],
  "fed.rev.public_account.deposits_and_reserves": ["Deposits and reserves, net", "Net deposits and reserves, listed under public account receipts."],
  "fed.rev.provincial_cash_surplus": ["Provincial cash surplus", "Cash the provinces are expected to build up, counted as a federal financing line."],
  "fed.rev.privatization_proceeds": ["Privatisation proceeds", "Money the federal government expects from selling state enterprises, a financing line."],
  "fed.rev.consolidated_fund": ["Federal Consolidated Fund, gross", "Internal plus external receipts, as the first line of the receipts summary in older editions."],
  "fed.rev.consolidated_fund_net": ["Federal Consolidated Fund, net", "Internal plus external receipts minus the provinces' share, as older editions print it."],
};

/* ------------------------------------------------------------------ */
/* Composition for the long tails                                      */
/* ------------------------------------------------------------------ */

// CPI groups: title noun, "<x> prices" noun, summary phrase.
const CPI_GROUP = {
  food: ["Food", "Food prices", "food and non-alcoholic drinks"],
  alcohol_tobacco: ["Alcohol and tobacco", "Alcohol and tobacco prices", "alcoholic drinks and tobacco"],
  clothing_footwear: ["Clothing and footwear", "Clothing and footwear prices", "clothing and footwear"],
  housing_utilities: ["Housing and utilities", "Housing and utility prices", "housing, water, electricity, gas and fuels"],
  furnishing_household: ["Household goods", "Household goods prices", "furnishings, household equipment and upkeep"],
  health: ["Health care", "Health care prices", "medicines and health services"],
  transport: ["Transport", "Transport prices", "transport"],
  communication: ["Communication", "Communication prices", "communication"],
  recreation_culture: ["Recreation and culture", "Recreation and culture prices", "recreation and culture"],
  education: ["Education", "Education prices", "education"],
  restaurants_hotels: ["Restaurants and hotels", "Restaurant and hotel prices", "restaurants and hotels"],
  miscellaneous: ["Miscellaneous goods", "Miscellaneous goods prices", "miscellaneous goods and services"],
};
const cpiArea = (s) => {
  const a = s.dims.area;
  if (a === "national") return { t: "", where: "across Pakistan", sw: "across Pakistan" };
  if (a === "urban") return { t: ", urban", where: "in towns and cities", sw: "in towns and cities" };
  if (a === "rural") return { t: ", rural", where: "in rural areas", sw: "in rural areas" };
  // 2007-08 base: the table prints no area (AGENTS.md D27). Never national or urban.
  return { t: ", earlier base", where: "on the index used before the rebasing, no area printed", sw: "on the older index, no area printed" };
};
const lc = (s) => s.charAt(0).toLowerCase() + s.slice(1);

function cpi(s) {
  const m = s.dims.measure;
  const g = s.dims.group;
  const ar = cpiArea(s);
  if (g === "general") throw new Error(`CPI general series without a hand entry: ${s.series_id}`);
  const [noun, prices, phrase] = CPI_GROUP[g] ?? [];
  if (!noun) throw new Error(`unknown CPI group ${g}`);
  if (m === "yoy") return [`${noun} inflation${ar.t}`, `How much prices of ${phrase} rose compared with the same month a year earlier, ${ar.where}.`, `Yearly rise in prices of ${phrase}, ${ar.sw}.`];
  if (m === "mom") return [`${prices}, monthly change${ar.t}`, `How much prices of ${phrase} changed compared with the previous month, ${ar.where}.`, `Change in prices of ${phrase} over the previous month, ${ar.sw}.`];
  if (m === "index") return [`${noun} price index${ar.t}`, `Price level of ${phrase} ${ar.where}, as an index where the base-year average is one hundred.`, `Price index of ${phrase}, ${ar.sw}; base-year average is one hundred.`];
  if (m === "weight") return [`Basket weight, ${lc(noun)}${ar.t}`, `Share of ${phrase} in the basket of goods used to measure consumer prices ${ar.where}.`, `Share of ${phrase} in the consumer price basket, ${ar.sw}.`];
  throw new Error(`unknown CPI measure ${m}`);
}

// LFS
// Titles say "KP" (the name readers in Pakistan use; saves sixteen characters on the longest titles); summaries spell it out.
const PROV = { pb: "Punjab", sd: "Sindh", kp: "Khyber Pakhtunkhwa", ba: "Balochistan" };
const PROV_T = { pb: "Punjab", sd: "Sindh", kp: "KP", ba: "Balochistan" };
const LFS_MEASURE = {
  unemployment_rate: ["Unemployment rate", "Share of the labour force, aged ten and over, who are out of work and looking for work", "Share of the labour force who are out of work and looking for work"],
  lfpr_refined: ["Participation rate", "Share of people aged ten and over who are working or looking for work", "Share of people aged ten and over in the labour force"],
  lfpr_crude: ["Crude participation rate", "The labour force as a share of the whole population, all ages counted", "Labour force as a share of the whole population"],
  labour_force: ["Labour force", "Number of people aged ten and over who are working or looking for work", "People aged ten and over working or looking for work"],
  employed: ["Employed people", "Number of people aged ten and over who are in work", "People aged ten and over who are in work"],
  unemployed: ["Unemployed people", "Number of people aged ten and over who are out of work and looking for work", "People aged ten and over out of work and looking for it"],
};
const INDUSTRY = {
  all: ["all industries", "all industries together"],
  agriculture: ["agriculture", "agriculture, forestry, hunting and fishing"],
  manufacturing: ["manufacturing", "manufacturing"],
  construction: ["construction", "construction"],
  wholesale_retail_trade: ["trade", "wholesale and retail trade"],
  transport_storage_communication: ["transport and communication", "transport, storage and communication"],
  community_social_personal_services: ["community services", "community, social and personal services"],
  others: ["other industries", "other industries, as the report's footnote lists them"],
};

function lfsParts(s) {
  const parts = s.series_id.split(".");
  const icls19 = parts[parts.length - 1] === "icls19";
  const prov = PROV[parts[2]] ? parts[2] : null;
  const sex = s.dims.sex;
  const area = s.dims.area;
  const sexT = sex === "female" ? "women" : sex === "male" ? "men" : "";
  const sexS = sex === "female" ? "women" : sex === "male" ? "men" : "both sexes";
  const placeBase = prov ? PROV[prov] : "";
  const placeBaseT = prov ? PROV_T[prov] : "";
  const placeT = area === "total" ? placeBaseT : `${area}${placeBaseT ? ` ${placeBaseT}` : ""}`;
  const placeS = area === "total" ? placeBase || "Pakistan" : `${area} ${placeBase || "areas"}`;
  return { icls19, sexT, sexS, placeT, placeS };
}

function lfs(s) {
  const m = s.series_id.split(".")[1];
  const p = lfsParts(s);
  const tag = p.icls19 ? " (new definition)" : "";
  const sTag = p.icls19 ? ", new international definition" : "";
  const who = `${p.sexS}, ${p.placeS}`;
  if (m === "employment_share") {
    const ind = s.dims.industry;
    const [short, long] = INDUSTRY[ind];
    const title = ind === "all" ? `Share of workers, all industries${p.sexT ? `, ${p.sexT}` : ""}${tag}` : `Share of workers in ${short}${p.sexT ? `, ${p.sexT}` : ""}${tag}`;
    const sum = ind === "all" ? `All employed people, the total the industry shares are taken from${sTag}: ${who}.` : `Share of employed people who work in ${long}${sTag}: ${who}.`;
    return [title, sum, `Share of employed people in ${ind === "others" ? "other industries" : long}${sTag}: ${who}.`];
  }
  const [noun, long, short] = LFS_MEASURE[m];
  const quals = [p.sexT, p.placeT].filter(Boolean).join(", ");
  const title = `${noun}${quals ? `, ${quals}` : ""}${tag}`;
  return [title, `${long}${sTag}: ${who}.`, `${short}${sTag}: ${who}.`];
}

// ABS function-wise lines.
const FN = {
  general_public_services: ["general public services", "general public services"],
  defence_affairs_and_services: ["defence", "defence affairs and services"],
  public_order_and_safety_affairs: ["public order and safety", "public order and safety"],
  economic_affairs: ["economic affairs", "economic affairs"],
  environment_protection: ["environment", "environment protection"],
  housing_and_community_amenities: ["housing and community", "housing and community amenities"],
  health: ["health", "health"],
  recreation_culture_and_religion: ["culture and religion", "recreation, culture and religion"],
  education_affairs_and_services: ["education", "education"],
  social_protection: ["social protection", "social protection"],
};
const SUB = {
  executive_legislative_financial_fiscal_external_affairs: "Executive, fiscal and external affairs",
  foreign_economic_aid: "Foreign economic aid",
  transfers: "Transfers",
  general_services: "General services",
  basic_research: "Basic research",
  research_and_development_general_public_services: "Research, general public services",
  administration_of_general_public_services: "Administration, general public services",
  general_public_services_not_elsewhere_defined: "General public services, unclassified",
  foreign_loans_repayment: "Foreign loan repayments",
  short_term_foreign_credits_repayment: "Short-term foreign credit repayments",
  military_defence: "Military defence",
  defence_administration: "Defence administration",
  research_and_development_defence: "Defence research",
  law_courts: "Law courts",
  police: "Police and civil armed forces",
  fire_protection: "Fire protection",
  prison_administration_and_operation: "Prisons",
  research_and_development_public_order_and_safety: "Research, public order and safety",
  administration_of_public_order: "Administration of public order",
  general_economic_commercial_and_labour_affairs: "Economic, commercial and labour affairs",
  agriculture_food_irrigation_forestry_and_fishing: "Agriculture, food and irrigation",
  fuel_and_energy: "Fuel and energy",
  mining_and_manufacturing: "Mining and manufacturing",
  construction_and_transport: "Construction and transport",
  communications: "Communications",
  other_industries: "Other industries",
  research_and_development_economic_affairs: "Research, economic affairs",
  waste_water_management: "Waste water management",
  pollution_abatement: "Pollution abatement",
  research_and_development_environment_protection: "Research, environment protection",
  administration_of_environment_protection: "Environment administration",
  housing_development: "Housing development",
  community_development: "Community development",
  water_supply: "Water supply",
  medical_products_appliances_and_equipment: "Medicines and medical equipment",
  out_patient_services: "Out-patient services",
  hospital_services: "Hospital services",
  public_health_services: "Public health services",
  research_and_development_health: "Health research",
  health_administration: "Health administration",
  recreational_and_sporting_services: "Sport and recreation",
  cultural_services: "Cultural services",
  broadcasting_and_publishing: "Broadcasting and publishing",
  religious_affairs: "Religious affairs",
  administration_of_information_recreation_and_culture: "Administration of information and culture",
  pre_primary_and_primary_education: "Pre-primary and primary education",
  secondary_education: "Secondary education",
  tertiary_education: "Higher education",
  education_services_not_definable_by_level: "Education services not tied to one level",
  subsidiary_services_to_education: "Support services to education",
  education_administration: "Education administration",
  education_not_elsewhere_classified: "Education, unclassified",
  social_protection_administration: "Social protection administration",
  social_protection_others: "Social protection, others",
  social_protection_not_elsewhere_classified: "Social protection, unclassified",
};
// Part of spending a function line belongs to (dims.part), in title and summary words.
const PART = {
  current_revenue: ["current", "current spending", "revenue account"],
  current_capital: ["current, capital account", "current spending", "capital account"],
  development_revenue: ["development, revenue account", "development spending", "revenue account"],
  development_revenue_psdp: ["PSDP, revenue account", "PSDP development spending", "revenue account"],
  development_capital: ["development, capital account", "development spending", "capital account"],
  development_capital_psdp: ["PSDP, capital account", "PSDP development spending", "capital account"],
};

function absFunction(s, all) {
  const id = s.series_id;
  const m = /^fed\.exp\.(.+?)\.function\.([a-z_]+)(?:\.([a-z_]+))?$/.exec(id);
  if (!m) return null;
  const [, prefix, fnKey, subKey] = m;
  const part =
    s.dims.part ??
    { current: "current_revenue", "current.capital_account": "current_capital", "development.revenue_account": "development_revenue", "development.revenue_account.psdp": "development_revenue_psdp", "development.capital_account": "development_capital", "development.capital_account.psdp": "development_capital_psdp" }[prefix];
  const [tag0, spendWords, account] = PART[part];
  const [fnT, fnS] = FN[fnKey];
  // "(current)" alone only when the release holds no capital-account line for the same item:
  // where it does, "current" alone would claim the whole of current spending on it.
  let tag = tag0;
  if (part === "current_revenue") {
    const twin = id.replace(/^fed\.exp\.current\.function\./, "fed.exp.current.capital_account.function.");
    if (all.has(twin)) tag = "current, revenue account";
  }
  if (!subKey) {
    const title = `Federal ${fnT} spending (${tag})`;
    const sum =
      part === "current_revenue"
        ? `Federal current spending on ${fnS}, revenue account only; excludes development and provincial spending.`
        : `Federal ${spendWords} on ${fnS}, ${account}; one part of federal spending on it, not the whole.`;
    return [title, sum, `Federal ${spendWords} on ${fnS}, ${account} only.`];
  }
  const sub = SUB[subKey];
  if (!sub) throw new Error(`no plain name for sub-function ${subKey} (${id})`);
  // The summary names the sub-function as printed where the printed words read cleanly, else by its plain name.
  const printed = s.name.replace(/\s*\((current|development)[^)]*\)\s*$/, "").replace(/\s*\(also printed as [^)]*\)/, "");
  const what = /\(|^Others|^Research and development/.test(printed) ? lc(sub) : lc(printed);
  const title = `${sub} (${tag})`;
  const sum = `Federal ${spendWords} on ${what}, ${account}, under ${fnS}.`;
  const short = `Federal ${spendWords} on ${lc(sub)}, ${account}, under ${fnS}.`;
  return [title, sum, short];
}

/* ------------------------------------------------------------------ */
const all = new Set(series.map((s) => s.series_id));
const entries = {};
const how = { hand: 0, generated: 0 };
const problems = [];
for (const s of series) {
  let t;
  let origin = "generated";
  if (HAND[s.series_id]) {
    t = HAND[s.series_id];
    origin = "hand";
  } else if (s.dataset === "cpi") t = cpi(s);
  else if (s.dataset === "lfs") t = lfs(s);
  else if (s.dataset === "abs") t = absFunction(s, all);
  if (!t) {
    problems.push(`${s.series_id}: no rule and no hand entry`);
    continue;
  }
  let [title, summary, shortSummary] = t;
  if (summary.length > SUMMARY_MAX && shortSummary) summary = shortSummary;
  if (/\d/.test(title) || /\d/.test(summary)) problems.push(`${s.series_id}: a digit in "${title}" / "${summary}"`);
  if (title.length > TITLE_MAX) problems.push(`${s.series_id}: title over ${TITLE_MAX} characters: "${title}"`);
  if (summary.length > SUMMARY_MAX) problems.push(`${s.series_id}: summary over ${SUMMARY_MAX} characters (${summary.length}): "${summary}"`);
  how[origin]++;
  entries[s.series_id] = { title, summary, status: "draft", drafted: origin === "hand" ? "by hand" : "from template, reviewed" };
}
const seen = new Map();
for (const [id, e] of Object.entries(entries)) {
  const k = e.title.toLowerCase();
  if (seen.has(k)) problems.push(`title "${e.title}" is used by ${seen.get(k)} and ${id}`);
  seen.set(k, id);
}

const file = {
  $comment:
    "Plain titles and one-sentence summaries for every series (DESIGN.md 6.4; round 2, item: plain titles). Editorial text, never data: the printed name stays on the series as its printed label (shown as a grey second line and in About) and the full definition stays in About. Rules: a title is the words a reader would use, at most about forty characters where the series allows it, unique across the release, with no digits; siblings are told apart in words (urban, rural, women, men, a province, 'earlier base' for the index base used before the rebasing, which prints no area, and '(new definition)' for the nineteenth ICLS labour series, never joined to the others). A title never claims more than the series is: budget function lines say which part of spending they are ('current' is the revenue account; development, PSDP and capital-account lines say so), a receipts line listed under a different head says which head, an index is not a rate, a weight is not a price. A summary is one sentence of at most one hundred and thirty characters with no digits. Every entry is a draft for Ali's review ('status': 'draft'); 'drafted' says whether it was written by hand or composed by scripts/draft-titles.mjs from the series' own dims and printed names and then reviewed. scripts/checks/titles.mjs fails the build on a missing, duplicate, over-long or digit-bearing entry, or one keyed to a series the release does not hold. PROVISIONAL (unattended run, 2026-11-15): drafted by the titles agent; Ali approves, edits or replaces.",
  provisional: true,
  series: entries,
};
const text = `${JSON.stringify(file, null, 1)}\n`;
if (problems.length) {
  console.error(`draft-titles: ${problems.length} problem(s)\n  ${problems.join("\n  ")}`);
  process.exitCode = 1;
}
if (process.argv.includes("--stdout")) process.stdout.write(text);
else if (fs.existsSync(out) && !process.argv.includes("--force")) console.error(`draft-titles: ${out} exists (the file is the source of truth); use --force to overwrite it`);
else {
  fs.writeFileSync(out, text);
  console.log(`draft-titles: ${Object.keys(entries).length} entries (${how.hand} by hand, ${how.generated} from templates) written to ${path.relative(siteDir, out)}`);
}
