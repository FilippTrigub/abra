#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { GSC } from '../../../../_providers/marketing/gsc.mjs';
import { Semrush } from '../../../../_providers/marketing/semrush.mjs';
import { Ahrefs } from '../../../../_providers/marketing/ahrefs.mjs';
import { DataForSEO } from '../../../../_providers/marketing/dataforseo.mjs';
import { KeywordsEverywhere } from '../../../../_providers/marketing/keywords-everywhere.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load config
const configPath = join(__dirname, '..', '..', 'config.json');
const defaultConfig = JSON.parse(readFileSync(configPath, 'utf-8'));

async function tryProvider(fn) {
  try {
    return { status: 'ok', data: await fn() };
  } catch (error) {
    return { status: 'unavailable', reason: error.message };
  }
}

/**
 * Programmatic SEO Task
 * Generates keyword clusters for a base topic using DataForSEO and Keywords
 * Everywhere, supplemented by Semrush, then filters out keywords the domain
 * already ranks for per Google Search Console / Ahrefs.
 */
export default async function pseoTask(args) {
  const config = { ...defaultConfig };

  // Merge CLI args
  if (args.domain) config.domain = args.domain;
  if (args.baseTopic) config.baseTopic = args.baseTopic;
  if (args.clusterCount) config.clusterCount = parseInt(args.clusterCount, 10);
  if (args.minKeywordVolume) config.minKeywordVolume = parseInt(args.minKeywordVolume, 10);

  // Validation
  if (!config.domain) {
    console.error('Error: --domain is required for programmatic-seo');
    console.error('Usage: node scripts/run.mjs --task pseo --domain example.com');
    process.exit(1);
  }

  const domain = config.domain;
  const baseTopic = config.baseTopic || 'seo';
  const clusterCount = config.clusterCount || 10;
  const minKeywordVolume = config.minKeywordVolume || 100;
  const outputDir = config.output_dir || './output';

  console.log(`🎯 Starting Programmatic SEO for: ${domain}`);
  console.log(`   Base topic: ${baseTopic}`);
  console.log(`   Target clusters: ${clusterCount}`);
  console.log(`   Min keyword volume: ${minKeywordVolume}`);
  console.log('');

  console.log('📊 Generating keyword candidates (DataForSEO)...');
  const dataforseoKeywords = await tryProvider(() => DataForSEO.keywordsForKeywords([baseTopic], {}));

  console.log('📊 Analyzing search intent patterns (Keywords Everywhere)...');
  const keKeywords = await tryProvider(() => KeywordsEverywhere.keywordsRelated([baseTopic], {}));

  console.log('📊 Mapping keyword relationships (Semrush)...');
  const semrushKeywords = await tryProvider(() => Semrush.keywordsRelated(baseTopic, {}));

  console.log('📊 Checking existing rankings (Google Search Console + Ahrefs)...');
  const gscRankings = await tryProvider(() => GSC.searchQuery(domain, { limit: 50 }));
  const ahrefsRankings = await tryProvider(() => Ahrefs.keywordsOrganic(domain, {}));
  console.log('');

  const dataforseoResults = dataforseoKeywords.status === 'ok' ? (dataforseoKeywords.data?.tasks?.[0]?.result ?? []) : [];
  const keResults = keKeywords.status === 'ok' ? (keKeywords.data?.data ?? []) : [];
  const semrushResults = semrushKeywords.status === 'ok' && Array.isArray(semrushKeywords.data) ? semrushKeywords.data : [];

  const candidates = [
    ...dataforseoResults.map(r => ({ keyword: r.keyword, volume: r.search_volume ?? 0, source: 'dataforseo' })),
    ...keResults.map(r => ({ keyword: r.keyword, volume: r.vol ?? 0, source: 'keywords-everywhere' })),
    ...semrushResults.map(r => ({ keyword: r.Ph, volume: parseFloat(r.Nq) || 0, source: 'semrush' }))
  ].filter(k => k.keyword && k.volume >= minKeywordVolume);

  const gscRows = gscRankings.status === 'ok' ? (gscRankings.data?.rows ?? []) : [];
  const ahrefsOrganic = ahrefsRankings.status === 'ok' ? (ahrefsRankings.data?.keywords ?? (Array.isArray(ahrefsRankings.data) ? ahrefsRankings.data : [])) : [];
  const alreadyRanked = new Set([
    ...gscRows.map(row => (row.keys?.[0] || '').toLowerCase()),
    ...ahrefsOrganic.map(row => (row.keyword || '').toLowerCase())
  ]);

  const gapKeywords = candidates.filter(c => !alreadyRanked.has(c.keyword.toLowerCase()));

  const clusters = Array.from({ length: Math.min(clusterCount, gapKeywords.length || 1) }, (_, i) => ({
    name: `${baseTopic}-cluster-${i + 1}`,
    keywords: []
  }));
  gapKeywords.forEach((k, i) => {
    if (clusters.length > 0) clusters[i % clusters.length].keywords.push(k);
  });

  const keywordMap = {};
  gapKeywords.forEach(k => {
    keywordMap[k.keyword] = { volume: k.volume, source: k.source };
  });

  const templateSuggestions = clusters
    .filter(c => c.keywords.length > 0)
    .map(c => ({
      cluster: c.name,
      urlPattern: `/${baseTopic}/{slug}`,
      sampleSlugs: c.keywords.slice(0, 3).map(k => k.keyword.toLowerCase().replace(/\s+/g, '-'))
    }));

  const implementationGuide = clusters.length > 0
    ? [
        `Build ${clusters.filter(c => c.keywords.length > 0).length} cluster pages targeting ${gapKeywords.length} gap keywords`,
        'Use templateSuggestions.urlPattern per cluster for consistent URL structure',
        'Prioritize clusters by total keyword volume before publishing'
      ]
    : ['No keyword gap data available — provide API keys for DataForSEO/Keywords Everywhere/Semrush to generate clusters'];

  const pseoResults = {
    task: 'programmatic-seo',
    domain,
    timestamp: new Date().toISOString(),
    config: {
      baseTopic,
      clusterCount,
      minKeywordVolume
    },
    clusters,
    keywordMap,
    templateSuggestions,
    implementationGuide,
    providers: {
      dataforseo: dataforseoKeywords,
      keywordsEverywhere: keKeywords,
      semrush: semrushKeywords,
      gsc: gscRankings,
      ahrefs: ahrefsRankings
    }
  };

  console.log(`✅ Programmatic SEO analysis complete for ${domain}`);
  console.log('');

  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
  const outputPath = join(outputDir, `programmatic-seo-${Date.now()}.json`);
  writeFileSync(outputPath, JSON.stringify(pseoResults, null, 2));
  console.log(`📁 Output written to: ${outputPath}`);

  return pseoResults;
}
