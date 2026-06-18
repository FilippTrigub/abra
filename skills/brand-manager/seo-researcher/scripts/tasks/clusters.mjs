#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { GSC } from '../../../../_providers/marketing/gsc.mjs';
import { Ahrefs } from '../../../../_providers/marketing/ahrefs.mjs';
import { DataForSEO } from '../../../../_providers/marketing/dataforseo.mjs';

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

function pathSegment(url) {
  try {
    const path = new URL(url).pathname;
    return path.split('/').filter(Boolean)[0] || 'root';
  } catch {
    return 'root';
  }
}

/**
 * Site Architecture Clusters Task
 * Groups indexed pages (Google Search Console / Ahrefs) into content silos
 * by URL path segment, and surfaces shared-keyword silos from DataForSEO.
 */
export default async function clustersTask(args) {
  const config = { ...defaultConfig };

  // Merge CLI args
  if (args.domain) config.domain = args.domain;
  if (args.clusterThreshold) config.clusterThreshold = parseFloat(args.clusterThreshold);
  if (args.includeSitemaps !== undefined) config.includeSitemaps = args.includeSitemaps === 'true' || args.includeSitemaps === true;
  if (args.maxClusters) config.maxClusters = parseInt(args.maxClusters, 10);

  // Validation
  if (!config.domain) {
    console.error('Error: --domain is required for site-architecture');
    console.error('Usage: node scripts/run.mjs --task clusters --domain example.com');
    process.exit(1);
  }

  const domain = config.domain;
  const maxClusters = config.maxClusters || 50;
  const outputDir = config.output_dir || './output';

  console.log(`🏗️  Starting Site Architecture Analysis for: ${domain}`);
  console.log(`   Cluster threshold: ${config.clusterThreshold || 0.7}`);
  console.log(`   Include sitemaps: ${config.includeSitemaps}`);
  console.log(`   Max clusters: ${maxClusters}`);
  console.log('');

  console.log('📊 Analyzing URL structure (Ahrefs)...');
  const topPages = await tryProvider(() => Ahrefs.topPagesList(domain, {}));

  console.log('📊 Fetching indexed page inventory (Google Search Console)...');
  const gscPages = await tryProvider(() => GSC.searchPages(domain, { limit: maxClusters }));

  console.log('📊 Identifying content silos (DataForSEO)...');
  const rankedKeywords = await tryProvider(() => DataForSEO.labsRankedKeywords(domain, { limit: maxClusters }));

  let sitemap = { status: 'skipped', reason: 'includeSitemaps disabled' };
  if (config.includeSitemaps) {
    console.log('📊 Fetching sitemaps (Google Search Console)...');
    sitemap = await tryProvider(() => GSC.listSitemaps(domain));
  }
  console.log('');

  const ahrefsPages = topPages.status === 'ok' ? (topPages.data?.pages ?? (Array.isArray(topPages.data) ? topPages.data : [])) : [];
  const gscRows = gscPages.status === 'ok' ? (gscPages.data?.rows ?? []) : [];

  const urlStructure = (gscRows.length ? gscRows.map(r => r.keys?.[0]) : ahrefsPages.map(p => p.url || p.page))
    .filter(Boolean);

  const silos = new Map();
  urlStructure.forEach(url => {
    const segment = pathSegment(url);
    if (!silos.has(segment)) silos.set(segment, []);
    silos.get(segment).push(url);
  });

  const clusters = Array.from(silos.entries())
    .map(([segment, urls]) => ({ name: segment, pages: urls }))
    .sort((a, b) => b.pages.length - a.pages.length)
    .slice(0, maxClusters);

  const rankedKeywordItems = rankedKeywords.status === 'ok'
    ? (rankedKeywords.data?.tasks?.[0]?.result?.[0]?.items ?? rankedKeywords.data?.tasks?.[0]?.result ?? [])
    : [];

  const clustersResults = {
    task: 'site-architecture',
    domain,
    timestamp: new Date().toISOString(),
    config: {
      clusterThreshold: config.clusterThreshold || 0.7,
      includeSitemaps: config.includeSitemaps,
      maxClusters
    },
    architecture: {
      urlStructure,
      internalLinking: {},
      hierarchy: clusters.map(c => ({ segment: c.name, pageCount: c.pages.length }))
    },
    clusters,
    keywordSilos: rankedKeywordItems,
    recommendations: {
      structural: clusters.length === 0 ? ['No page inventory available — configure GSC or Ahrefs credentials'] : [],
      linking: [],
      navigation: []
    },
    sitemap: sitemap.status === 'ok' ? (sitemap.data?.sitemap ?? []) : null,
    providers: {
      ahrefs: topPages,
      gsc: { pages: gscPages, sitemap },
      dataforseo: rankedKeywords
    }
  };

  console.log(`✅ Site architecture analysis complete for ${domain}`);
  console.log('');

  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
  const outputPath = join(outputDir, `site-architecture-${Date.now()}.json`);
  writeFileSync(outputPath, JSON.stringify(clustersResults, null, 2));
  console.log(`📁 Output written to: ${outputPath}`);

  return clustersResults;
}
