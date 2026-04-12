import { existsSync, mkdirSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { GA4 } from '../../../../_providers/marketing/ga4.mjs';
import { Mixpanel } from '../../../../_providers/marketing/mixpanel.mjs';
import { Amplitude } from '../../../../_providers/marketing/amplitude.mjs';
import { Hotjar } from '../../../../_providers/marketing/hotjar.mjs';

/**
 * Onboarding CRO Task
 * 
 * Analyzes post-signup onboarding flows and provides recommendations to improve activation rates.
 * 
 * Source: marketingskills/skills/onboarding-cro
 */

export async function run({ inputDir, outputDir, outputFormat }) {
    const inputPath = inputDir;
    const outputPath = outputDir;
    
    // Create output directory if it doesn't exist
    mkdirSync(outputPath, { recursive: true });
    
    // Get input files
    const inputFiles = readdirSync(inputPath).filter(f => f.endsWith('.md') || f.endsWith('.txt'));
    const brandContext = inputFiles.length > 0 ? `\nBased on input files: ${inputFiles.join(', ')}\n` : '';
    
    console.log('🔍 Analyzing onboarding flow for activation opportunities...');
    
    // Build onboarding data from available context
    const onboardingData = {
        activation: 'not_provided',
        activationRate: null,
        timeToActivation: null,
        dropoffPoint: null,
        brandContext: brandContext
    };
    
    // Run analysis
    const analysis = analyzeOnboarding(onboardingData);
    
    // Save results
    const outputFile = join(outputPath, 'onboarding_cro_analysis.json');
    writeFileSync(outputFile, JSON.stringify(analysis, null, 2));
    
    console.log(`\n✅ Analysis saved to: ${outputFile}`);
    console.log(`\n📊 Friction Points Found: ${analysis.friction_points.length}`);
    console.log(`📊 Quick Wins: ${analysis.recommendations.quick_wins.length}`);
    console.log(`📊 High-Impact Changes: ${analysis.recommendations.high_impact.length}`);
    console.log(`📊 Test Hypotheses: ${analysis.recommendations.test_hypotheses.length}`);
    
    return { output: JSON.stringify(analysis, null, 2) };
}

function analyzeOnboarding(onboardingData) {
    /**
     * Analyze onboarding flow for optimization opportunities.
     * 
     * Returns structured analysis with recommendations.
     */
    const analysis = {
        summary: {
            activation_goal: onboardingData.activation,
            activation_rate: onboardingData.activationRate,
            time_to_activation: onboardingData.timeToActivation,
            main_dropoff: onboardingData.dropoffPoint
        },
        immediate_post_signup: {
            value_delivered_immediately: false,
            clear_single_next_action: false,
            blank_slate_risk: false,
            empty_states_optimized: false
        },
        onboarding_flow: {
            step_count: 0,
            progress_indication_present: false,
            interactive_over_tutorial: false,
            checklist_pattern: false
        },
        friction_points: [],
        recommendations: {
            quick_wins: [],
            high_impact: [],
            test_hypotheses: [],
            onboarding_flow_design: null
        },
        multi_channel: {
            email_coordination: false,
            trigger_based_emails: [],
            re_engagement_tactics: []
        }
    };
    
    // Analyze immediate post-signup experience
    const postSignup = onboardingData.post_signup_analysis || {};
    if (postSignup.blank_slate) {
        analysis.friction_points.push({
            issue: 'Blank slate after signup',
            impact: 'Users don\'t know what to do, feel overwhelmed',
            fix: 'Add clear empty state with primary action and example data'
        });
    }
    
    if (postSignup.no_clear_next_step) {
        analysis.friction_points.push({
            issue: 'No clear next action',
            impact: 'Users wander, don\'t reach activation',
            fix: 'Single primary CTA that leads to first value action'
        });
    }
    
    // Analyze flow structure
    const flowStructure = onboardingData.flow_structure || {};
    analysis.onboarding_flow.step_count = flowStructure.step_count || 0;
    analysis.onboarding_flow.progress_indication_present = flowStructure.progress_bar || false;
    analysis.onboarding_flow.interactive_over_tutorial = flowStructure.show_tutorial_first !== false;
    
    // Generate recommendations
    analysis.recommendations.quick_wins = [
        {
            action: 'Add progress bar to multi-step flow',
            rationale: 'Shows advancement and estimated completion time',
            impact: 'low',
            effort: 'low'
        },
        {
            action: 'Replace tutorial with interactive walkthrough',
            rationale: 'Users learn by doing, not watching',
            impact: 'medium',
            effort: 'medium'
        },
        {
            action: 'Celebrate activation achievement',
            rationale: 'Positive reinforcement encourages continued engagement',
            impact: 'medium',
            effort: 'low'
        }
    ];
    
    analysis.recommendations.high_impact = [
        {
            action: 'Implement onboarding checklist pattern',
            rationale: 'Progress visualization creates motivation to complete',
            impact: 'high',
            effort: 'medium'
        },
        {
            action: 'Set up trigger-based email sequence',
            rationale: 'Re-engage users who stall at key points',
            impact: 'high',
            effort: 'medium'
        },
        {
            action: 'Reduce step count by 30%',
            rationale: 'Fewer steps = faster time to value',
            impact: 'high',
            effort: 'high'
        }
    ];
    
    analysis.recommendations.test_hypotheses = [
        {
            hypothesis: 'Value-first approach will increase activation by 25%',
            test: 'Show product experience before any setup questions',
            primary_metric: 'activation rate',
            secondary_metrics: ['time to activation', 'day 7 retention']
        },
        {
            hypothesis: 'Onboarding checklist will increase completion by 20%',
            test: 'A/B test checklist vs. linear flow',
            primary_metric: 'onboarding completion rate',
            secondary_metrics: ['activation rate', 'time to activation']
        },
        {
            hypothesis: 'Personalized onboarding by role will increase activation by 15%',
            test: 'Role-based onboarding paths vs. generic path',
            primary_metric: 'activation rate',
            secondary_metrics: ['time to activation', 'engagement score']
        }
    ];
    
    // Define recommended onboarding flow
    analysis.recommendations.onboarding_flow_design = {
        activation_goal: onboardingData.activation || 'unknown',
        recommended_steps: [
            { step: 1, action: 'Immediate value action', rationale: 'Deliver core value instantly' },
            { step: 2, action: 'Quick customization', rationale: 'Personalize experience without friction' },
            { step: 3, action: 'Second value moment', rationale: 'Reinforce value with secondary action' },
            { step: 4, action: 'Optional advanced setup', rationale: 'For power users who want more' }
        ],
        empty_state_template: {
            headline: 'Your first [item] is ready',
            description: 'Click here to add your first [item] and see the value',
            primary_cta: 'Create my first [item]',
            secondary_cta: 'View example'
        }
    };
    
    // Email coordination
    analysis.multi_channel.trigger_based_emails = [
        { trigger: 'incomplete_onboarding_24h', purpose: 'reminder' },
        { trigger: 'incomplete_onboarding_72h', purpose: 'help + examples' },
        { trigger: 'activation_achieved', purpose: 'celebration + next step' },
        { trigger: 'feature_discovery_day7', purpose: 'show advanced features' }
    ];
    
    return analysis;
}
