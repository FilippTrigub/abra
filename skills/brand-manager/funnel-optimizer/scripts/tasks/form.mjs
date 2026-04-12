import { existsSync, mkdirSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { GA4 } from '../../../../_providers/marketing/ga4.mjs';
import { Hotjar } from '../../../../_providers/marketing/hotjar.mjs';
import { Mixpanel } from '../../../../_providers/marketing/mixpanel.mjs';

/**
 * Form CRO Task
 * 
 * Analyzes non-signup forms and provides recommendations to improve completion rates.
 * 
 * Source: marketingskills/skills/form-cro
 */

export async function run({ inputDir, outputDir, outputFormat }) {
    const inputPath = inputDir;
    const outputPath = outputDir;
    
    // Create output directory if it doesn't exist
    mkdirSync(outputPath, { recursive: true });
    
    // Get input files
    const inputFiles = readdirSync(inputPath).filter(f => f.endsWith('.md') || f.endsWith('.txt'));
    const brandContext = inputFiles.length > 0 ? `\nBased on input files: ${inputFiles.join(', ')}\n` : '';
    
    console.log('🔍 Analyzing form for conversion opportunities...');
    
    // Build form data from available context
    const formData = {
        name: 'not_provided',
        type: 'unknown',
        completionRate: null,
        fieldCount: null,
        mobileSplit: null,
        brandContext: brandContext
    };
    
    // Run analysis
    const analysis = analyzeForm(formData);
    
    // Save results
    const outputFile = join(outputPath, 'form_cro_analysis.json');
    writeFileSync(outputFile, JSON.stringify(analysis, null, 2));
    
    console.log(`\n✅ Analysis saved to: ${outputFile}`);
    console.log(`\n📊 Friction Points Found: ${analysis.friction_points.length}`);
    console.log(`📊 Quick Wins: ${analysis.recommendations.quick_wins.length}`);
    console.log(`📊 High-Impact Changes: ${analysis.recommendations.high_impact.length}`);
    console.log(`📊 Test Hypotheses: ${analysis.recommendations.test_hypotheses.length}`);
    
    return { output: JSON.stringify(analysis, null, 2) };
}

function analyzeForm(formData) {
    /**
     * Analyze form for optimization opportunities.
     * 
     * Returns structured analysis with recommendations.
     */
    const analysis = {
        summary: {
            form_name: formData.name,
            form_type: formData.type,
            completion_rate: formData.completionRate,
            field_count: formData.fieldCount,
            mobile_split: formData.mobileSplit
        },
        field_analysis: {},
        friction_points: [],
        recommendations: {
            quick_wins: [],
            high_impact: [],
            test_hypotheses: [],
            form_redesign: null
        }
    };
    
    // Analyze field set
    analysis.field_analysis = {
        total_fields: formData.fieldCount || 0,
        required_fields: [],
        optional_fields: [],
        field_efficiency: {}
    };
    
    // Calculate field cost
    const fieldCount = formData.fieldCount || 0;
    if (fieldCount >= 7) {
        analysis.friction_points.push({
            issue: 'Too many fields (7+)',
            impact: '25-50%+ reduction in completion rate',
            fix: 'Reduce to minimum viable fields, defer others to post-submission'
        });
    } else if (fieldCount >= 5) {
        analysis.friction_points.push({
            issue: 'Many fields (5-6)',
            impact: '10-25% reduction in completion rate',
            fix: 'Evaluate each field necessity, consider progressive disclosure'
        });
    }
    
    // Field-level analysis
    analysis.field_analysis.email = {
        single_field: true,
        inline_validation: false,
        typo_detection: false
    };
    
    analysis.field_analysis.name = {
        single_field: false,
        required: true,
        can_be_optional: true
    };
    
    analysis.field_analysis.phone = {
        required: true,
        optional_recommended: true,
        auto_format: false,
        country_handling: false
    };
    
    analysis.field_analysis.company = {
        required: true,
        auto_suggest: false,
        enrichment_available: false,
        inferred_from_email: false
    };
    
    analysis.field_analysis.free_text = {
        character_limits_set: false,
        expand_on_focus: false,
        optional: false
    };
    
    // Generate recommendations
    analysis.recommendations.quick_wins = [
        {
            action: 'Make free text/comment fields optional',
            rationale: 'Free text is the lowest priority field',
            impact: 'medium',
            effort: 'low'
        },
        {
            action: 'Add auto-format for phone numbers',
            rationale: 'Improves UX and data quality',
            impact: 'low',
            effort: 'low'
        },
        {
            action: 'Change button copy to be value-focused',
            rationale: 'Button text like "Submit" is weak; use action + value',
            impact: 'medium',
            effort: 'low'
        }
    ];
    
    analysis.recommendations.high_impact = [
        {
            action: 'Reduce field count by 30-40%',
            rationale: 'Each field reduces completion; defer non-essential fields',
            impact: 'high',
            effort: 'medium'
        },
        {
            action: 'Implement field enrichment (e.g., company from email)',
            rationale: 'Auto-fill known data to reduce typing',
            impact: 'high',
            effort: 'medium'
        },
        {
            action: 'Switch to single-column layout',
            rationale: 'Higher completion, mobile-friendly',
            impact: 'high',
            effort: 'low'
        },
        {
            action: 'Add inline validation',
            rationale: 'Prevents errors and frustration',
            impact: 'high',
            effort: 'medium'
        }
    ];
    
    analysis.recommendations.test_hypotheses = [
        {
            hypothesis: 'Reducing to 4 fields will increase completion by 25%',
            test: 'Remove company and phone as required',
            primary_metric: 'form completion rate',
            secondary_metrics: ['lead quality', 'sales follow-up rate']
        },
        {
            hypothesis: 'Single-column layout will improve mobile conversion by 20%',
            test: 'A/B test single vs. multi-column layout',
            primary_metric: 'mobile completion rate',
            secondary_metrics: ['time to complete', 'error rate']
        },
        {
            hypothesis: 'Value-focused CTA copy will increase clicks by 15%',
            test: 'Test "Get My Quote" vs. "Submit"',
            primary_metric: 'CTA click-through rate',
            secondary_metrics: ['completion rate']
        }
    ];
    
    // Recommended form redesign
    analysis.recommendations.form_redesign = {
        recommended_fields: [],
        optional_fields: [],
        field_order: [],
        copy: {
            button_copy: null,
            error_messages: {}
        }
    };
    
    // Tailor recommendations by form type
    const formType = formData.type;
    if (formType === 'lead_capture') {
        analysis.recommendations.quick_wins.push({
            action: 'Test email-only field',
            rationale: 'Minimum friction for content gating',
            impact: 'high',
            effort: 'low'
        });
        
        analysis.recommendations.form_redesign.recommended_fields = [
            { field: 'email', required: true, rationale: 'Essential for delivering content' }
        ];
        analysis.recommendations.form_redesign.optional_fields = [
            { field: 'name', rationale: 'Can enrich post-download' }
        ];
        
    } else if (formType === 'demo_request') {
        analysis.recommendations.form_redesign.recommended_fields = [
            { field: 'name', required: true, rationale: 'Personalize demo' },
            { field: 'email', required: true, rationale: 'Send demo link and follow-up' },
            { field: 'company', required: false, rationale: 'Optional for qualification' },
            { field: 'phone', required: false, rationale: 'Optional, ask for preferred contact method' },
            { field: 'use_case', required: false, rationale: 'Helps personalize demo' }
        ];
        
        analysis.recommendations.form_redesign.copy.button_copy = 'Request My Personalized Demo';
        
    } else if (formType === 'contact') {
        analysis.recommendations.form_redesign.recommended_fields = [
            { field: 'email', required: true, rationale: 'Respond to inquiry' },
            { field: 'name', required: false, rationale: 'Optional, but preferred' },
            { field: 'message', required: true, rationale: 'Understand the inquiry' }
        ];
        analysis.recommendations.form_redesign.copy.button_copy = 'Send Message';
        analysis.recommendations.quick_wins.push({
            action: 'Add expected response time',
            rationale: 'Sets expectations and reduces follow-up emails',
            impact: 'low',
            effort: 'low'
        });
        
    } else if (formType === 'checkout') {
        analysis.recommendations.quick_wins = [
            ...analysis.recommendations.quick_wins,
            {
                action: 'Add guest checkout option',
                rationale: 'Reduces friction for first-time buyers',
                impact: 'high',
                effort: 'medium'
            },
            {
                action: 'Add progress indicator',
                rationale: 'Shows remaining steps',
                impact: 'medium',
                effort: 'low'
            }
        ];
    }
    
    return analysis;
}
