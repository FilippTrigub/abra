import { existsSync, mkdirSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { GA4 } from '../../../../_providers/marketing/ga4.mjs';
import { Optimizely } from '../../../../_providers/marketing/optimizely.mjs';
import { Mixpanel } from '../../../../_providers/marketing/mixpanel.mjs';
import { Amplitude } from '../../../../_providers/marketing/amplitude.mjs';
import { PostHog } from '../../../../_providers/marketing/posthog.mjs';

/**
 * A/B Test Setup Task
 * 
 * Designs and plans A/B tests and growth experiments with statistical rigor.
 * 
 * Source: marketingskills/skills/ab-test-setup
 */

export async function run({ inputDir, outputDir, outputFormat }) {
    const inputPath = inputDir;
    const outputPath = outputDir;
    
    // Create output directory if it doesn't exist
    mkdirSync(outputPath, { recursive: true });
    
    // Get input files
    const inputFiles = readdirSync(inputPath).filter(f => f.endsWith('.md') || f.endsWith('.txt'));
    const brandContext = inputFiles.length > 0 ? `\nBased on input files: ${inputFiles.join(', ')}\n` : '';
    
    console.log('🔍 Designing A/B test with statistical rigor...');
    
    // Build experiment data from available context
    const experimentData = {
        hypothesis: 'not_provided',
        baselineConversion: null,
        trafficVolume: null,
        mde: null,
        testType: null,
        brandContext: brandContext,
        posthogContext: await loadPostHogExperimentContext()
    };
    
    // Run analysis
    const analysis = analyzeExperiment(experimentData);
    
    // Save results
    const outputFile = join(outputPath, 'experiment_design.json');
    writeFileSync(outputFile, JSON.stringify(analysis, null, 2));
    
    console.log(`\n✅ Analysis saved to: ${outputFile}`);
    console.log(`\n📊 Sample Size per Variant: ${analysis.sample_size_calculation.sample_size_per_variant.toLocaleString()}`);
    console.log(`📊 Total Sample Size: ${analysis.sample_size_calculation.total_sample_size.toLocaleString()}`);
    
    return { output: JSON.stringify(analysis, null, 2) };
}

function calculateSampleSize(baseline, mde, confidence = 0.95) {
    /**
     * Quick sample size approximation for A/B tests.
     * Uses simplified formula for common baseline rates.
     */
    const z = 1.96; // 95% confidence
    const p = baseline;
    const q = 1 - p;
    
    // Effect size in absolute terms
    const delta = baseline * mde;
    
    // Sample size per variant (simplified formula)
    const n = 2 * Math.pow(z + 0.5, 2) * p * q / Math.pow(delta, 2);
    
    return Math.ceil(n);
}

function analyzeExperiment(experimentData) {
    /**
     * Analyze experiment design and provide recommendations.
     * 
     * Returns structured analysis with test design recommendations.
     */
    const analysis = {
        summary: {
            hypothesis: experimentData.hypothesis,
            baseline_conversion: experimentData.baselineConversion,
            traffic_volume: experimentData.trafficVolume,
            mde: experimentData.mde,
            test_type: experimentData.testType,
            posthog_context: experimentData.posthogContext
        },
        hypothesis_framework: {},
        sample_size_calculation: {},
        metrics_plan: {},
        variant_design: {},
        recommendations: {
            design_recommendations: [],
            implementation_recommendations: [],
            analysis_recommendations: [],
            common_pitfalls_to_avoid: []
        }
    };
    
    // Build hypothesis framework
    analysis.hypothesis_framework = {
        structure: 'Because [observation/data], we believe [change] will cause [expected outcome] for [audience]. We\'ll know this is true when [metrics].',
        provided_hypothesis: experimentData.hypothesis,
        strong_hypothesis_example: {
            observation: 'Heatmaps show users miss the primary CTA (data from analytics)',
            change: 'making the button larger with contrasting color',
            expected_outcome: 'increasing CTA clicks by 15%+',
            audience: 'new visitors',
            metrics: 'click-through rate from page view to signup start'
        }
    };
    
    // Calculate sample size
    const baseline = experimentData.baselineConversion || 0.01;
    const mde = experimentData.mde || 0.10;
    
    const sampleSize = calculateSampleSize(baseline, mde);
    
    analysis.sample_size_calculation = {
        baseline_conversion_rate: baseline,
        minimum_detectable_effect: `${Math.round(mde * 100)}% lift`,
        sample_size_per_variant: sampleSize,
        total_sample_size: sampleSize * 2,
        estimated_duration: {
            daily_traffic_required: sampleSize / 7,
            duration_at_current_traffic: 'N/A (need traffic data)'
        },
        reference_tables: {
            '1% baseline': {
                '10% lift': '150k/variant',
                '20% lift': '39k/variant',
                '50% lift': '6k/variant'
            },
            '3% baseline': {
                '10% lift': '47k/variant',
                '20% lift': '12k/variant',
                '50% lift': '2k/variant'
            },
            '5% baseline': {
                '10% lift': '27k/variant',
                '20% lift': '7k/variant',
                '50% lift': '1.2k/variant'
            },
            '10% baseline': {
                '10% lift': '12k/variant',
                '20% lift': '3k/variant',
                '50% lift': '550/variant'
            }
        }
    };
    
    // Metrics plan
    analysis.metrics_plan = {
        primary_metric: {
            required: true,
            description: 'Single metric that matters most, directly tied to hypothesis',
            example: 'CTA click-through rate'
        },
        secondary_metrics: {
            required: true,
            description: 'Support primary metric interpretation',
            examples: ['time on page', 'scroll depth', 'navigation clicks']
        },
        guardrail_metrics: {
            required: true,
            description: 'Things that shouldn\'t get worse',
            examples: ['bounce rate', 'support tickets', 'page load time']
        }
    };
    
    // Variant design
    analysis.variant_design = {
        what_tovary: ['headlines/copy', 'visual_design', 'cta_button', 'content', 'layout'],
        best_practices: [
            'Single, meaningful change per test',
            'Bold enough to make a difference',
            'True to the hypothesis',
            'Don\'t test trivial changes'
        ]
    };
    
    // Generate recommendations
    analysis.recommendations.design_recommendations = [
        {
            recommendation: 'Focus on one primary variable',
            rationale: 'Testing multiple changes confuses results',
            impact: 'ensures clean interpretation'
        },
        {
            recommendation: 'Ensure hypothesis is based on data, not gut',
            rationale: 'Data-backed hypotheses have higher success rates',
            impact: 'improved win rate'
        },
        {
            recommendation: 'Pre-determine sample size and stick to it',
            rationale: 'Avoids false positives from early stopping',
            impact: 'statistical validity'
        }
    ];
    
    analysis.recommendations.implementation_recommendations = [
        {
            recommendation: 'Verify tracking before launch',
            rationale: 'Invalid tracking invalidates entire test',
            impact: 'test credibility'
        },
        {
            recommendation: 'Run for full business cycle',
            rationale: 'Avoid weekend-only or weekday-only biases',
            impact: 'representative results'
        },
        {
            recommendation: 'Document everything',
            rationale: 'Builds experimentation playbook over time',
            impact: 'compounding learning'
        }
    ];
    
    analysis.recommendations.analysis_recommendations = [
        {
            recommendation: 'Check for statistical significance before declaring winner',
            rationale: 'p < 0.05 means <5% chance result is random',
            impact: 'reliable decisions'
        },
        {
            recommendation: 'Look at segment differences',
            rationale: 'Winners may differ by device, segment, or cohort',
            impact: 'deeper insights'
        },
        {
            recommendation: 'Consider effect size, not just significance',
            rationale: 'Statistically significant != business meaningful',
            impact: 'better ROI decisions'
        }
    ];
    
    analysis.recommendations.common_pitfalls_to_avoid = [
        'Testing too small a change (undetectable)',
        'Testing too many things (can\'t isolate what worked)',
        'No clear hypothesis (just "let\'s see what happens")',
        'Stopping early (peeking at results)',
        'Changing variants mid-test',
        'Not checking implementation correctness',
        'Ignoring confidence intervals',
        'Over-interpreting inconclusive results'
    ];
    
    return analysis;
}

async function loadPostHogExperimentContext() {
    if (!PostHog.hasQueryCredentials()) {
        return {
            enabled: false,
            reason: 'POSTHOG_API_KEY and POSTHOG_PROJECT_ID not configured'
        };
    }

    try {
        const experiments = await PostHog.listExperiments({ limit: 10 });
        const flags = await PostHog.listFeatureFlags({ limit: 10 });
        return {
            enabled: true,
            experiments,
            feature_flags: flags
        };
    } catch (error) {
        return {
            enabled: false,
            reason: error.message
        };
    }
}
