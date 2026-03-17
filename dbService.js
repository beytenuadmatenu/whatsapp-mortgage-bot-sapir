const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Ensure the application fails fast if Supabase isn't configured
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;

if (supabaseUrl && supabaseServiceKey) {
    supabase = createClient(supabaseUrl, supabaseServiceKey);
    console.log('[Supabase] Initialized with URL:', supabaseUrl);
    console.log('[Supabase] Service Key (first 10 chars):', supabaseServiceKey.substring(0, 10) + '...');
    
    // Quick connection test
    supabase.from('leads').select('count', { count: 'exact', head: true })
        .then(({ count, error }) => {
            if (error) {
                console.error('[Supabase] Connection test failed:', error.message);
                console.error('[Supabase] Full error:', JSON.stringify(error, null, 2));
            } else {
                console.log('[Supabase] Connection test successful. Current lead count:', count);
            }
        });
} else {
    console.warn('[Supabase] Warning: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. URL present:', !!supabaseUrl, 'Key present:', !!supabaseServiceKey);
}

/**
 * Upsert a lead into the 'leads' table in Supabase
 * @param {Object} leadData The extracted lead details
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
async function upsertLead(leadData) {
    if (!supabase) {
        console.warn('[Supabase] Skipped upsertLead: Database not configured.');
        return false;
    }

    try {
        if (!leadData.phone) {
            console.error('[Supabase] Cannot upsert lead without a phone number.');
            return false;
        }

        console.log('[Supabase] Attempting to upsert lead data:', JSON.stringify(leadData, null, 2));

        const { data, error } = await supabase
            .from('leads')
            .upsert({
                phone: leadData.phone,
                full_name: leadData.full_name || 'לא ידוע',
                summary_sentence: leadData.summary_sentence || '',
                meeting_time: leadData.meeting_time || null,
                status: leadData.status === 'cancelled' ? 'CANCELLED' 
                        : (leadData.meeting_time ? 'MEETING_SCHEDULED' : 'NEW_LEAD'),
                // agent_notes will remain untouched on upsert if not sent
            }, { 
                onConflict: 'phone',
                ignoreDuplicates: false
            })
            .select();

        if (error) {
            console.error('[Supabase] Error upserting lead:', error.message);
            console.error('[Supabase] Error Details:', JSON.stringify(error, null, 2));
            return false;
        }

        console.log(`[Supabase] Lead ${leadData.phone} saved/updated successfully. Response:`, JSON.stringify(data, null, 2));
        return true;
    } catch (err) {
        console.error('[Supabase] Exception in upsertLead:', err);
        return false;
    }
}

/**
 * Parses a Hebrew date string in the format "יום [שם] DD.MM.YYYY בשעה HH:MM"
 * or "DD.MM.YYYY בשעה HH:MM"
 */
function parseHebrewDate(str) {
    if (!str) return null;
    const dateMatch = str.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    const timeMatch = str.match(/(\d{1,2}):(\d{1,2})/);
    if (!dateMatch || !timeMatch) return null;

    const [_, d, m, y] = dateMatch;
    const [__, hh, mm] = timeMatch;
    return new Date(parseInt(y), parseInt(m) - 1, parseInt(d), parseInt(hh), parseInt(mm));
}

/**
 * Fetches leads that have a meeting in the next minutesLimit
 * @param {number} minutesMin Minimum minutes from now
 * @param {number} minutesMax Maximum minutes from now
 */
async function getUpcomingMeetings(minutesMin, minutesMax) {
    if (!supabase) return [];
    
    try {
        // Fetch all scheduled meetings (simplified, we'll filter in JS to handle Hebrew dates)
        const { data, error } = await supabase
            .from('leads')
            .select('*')
            .eq('status', 'MEETING_SCHEDULED');

        if (error) throw error;

        const now = new Date();
        return data.filter(lead => {
            const meetingDate = parseHebrewDate(lead.meeting_time);
            if (!meetingDate) return false;

            const diffMinutes = (meetingDate - now) / (1000 * 60);
            return diffMinutes >= minutesMin && diffMinutes <= minutesMax;
        });
    } catch (err) {
        console.error('[Supabase] Error fetching upcoming meetings:', err.message);
        return [];
    }
}

/**
 * Marks a lead as reminded
 */
async function markLeadAsReminded(phone) {
    if (!supabase) return false;
    try {
        const { error } = await supabase
            .from('leads')
            .update({ reminder_sent_at: new Date().toISOString() })
            .eq('phone', phone);
        return !error;
    } catch (err) {
        return false;
    }
}

module.exports = {
    supabase,
    upsertLead,
    getUpcomingMeetings,
    markLeadAsReminded
};
