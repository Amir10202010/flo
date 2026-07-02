import type { WorkspaceBlueprintInput } from '../blueprint'

/** Recruiting agency — candidates, vacancies, placements. */
export const recruitingAgencyBlueprint: WorkspaceBlueprintInput = {
  profile: {
    industryKey: 'recruiting-agency',
    industryLabel: 'Recruiting agency',
    businessModel: 'Placement fees per hire',
  },
  terminology: {
    contact: { singular: 'Employer', plural: 'Employers' },
  },
  objects: [
    {
      key: 'candidate',
      singular: 'Candidate',
      plural: 'Candidates',
      icon: 'user',
      description: 'People being placed, tracked through the hiring funnel.',
      fields: [
        { key: 'role', label: 'Role', type: 'TEXT', required: true },
        { key: 'email', label: 'Email', type: 'EMAIL' },
        { key: 'phone', label: 'Phone', type: 'PHONE', showInList: false },
        { key: 'source', label: 'Source', type: 'SELECT', options: ['LinkedIn', 'Referral', 'Inbound', 'Job board', 'Outreach'] },
        { key: 'expected_salary', label: 'Expected salary', type: 'MONEY', showInList: false },
        { key: 'cv_link', label: 'CV link', type: 'URL', showInList: false },
        { key: 'skills', label: 'Key skills', type: 'TEXT', showInList: false },
      ],
      pipeline: [
        { key: 'sourced', label: 'Sourced' },
        { key: 'screening', label: 'Screening' },
        { key: 'interviewing', label: 'Interviewing' },
        { key: 'offer', label: 'Offer' },
        { key: 'placed', label: 'Placed', terminal: true },
        { key: 'rejected', label: 'Rejected', terminal: true },
      ],
    },
    {
      key: 'vacancy',
      singular: 'Vacancy',
      plural: 'Vacancies',
      icon: 'briefcase',
      description: 'Open roles at client companies.',
      fields: [
        { key: 'client_company', label: 'Company', type: 'TEXT', required: true },
        { key: 'role_title', label: 'Role', type: 'TEXT', required: true },
        { key: 'salary_range', label: 'Salary range', type: 'TEXT' },
        { key: 'location', label: 'Location', type: 'TEXT' },
        { key: 'fee_percent', label: 'Fee %', type: 'NUMBER', showInList: false },
      ],
      pipeline: [
        { key: 'open', label: 'Open' },
        { key: 'shortlisting', label: 'Shortlisting' },
        { key: 'interviews', label: 'Interviews' },
        { key: 'offer_stage', label: 'Offer stage' },
        { key: 'filled', label: 'Filled', terminal: true },
        { key: 'closed', label: 'Closed', terminal: true },
      ],
    },
    {
      key: 'placement',
      singular: 'Placement',
      plural: 'Placements',
      icon: 'handshake',
      description: 'Successful hires and their guarantee periods.',
      fields: [
        { key: 'candidate_name', label: 'Candidate', type: 'TEXT', required: true },
        { key: 'client_company', label: 'Company', type: 'TEXT', required: true },
        { key: 'role_title', label: 'Role', type: 'TEXT' },
        { key: 'start_date', label: 'Starts', type: 'DATE' },
        { key: 'fee', label: 'Fee', type: 'MONEY' },
        { key: 'guarantee_until', label: 'Guarantee until', type: 'DATE', showInList: false },
      ],
      pipeline: [
        { key: 'pending_start', label: 'Pending start' },
        { key: 'active', label: 'Active' },
        { key: 'completed', label: 'Completed', terminal: true },
        { key: 'fell_through', label: 'Fell through', terminal: true },
      ],
    },
  ],
  dashboard: [
    { type: 'stage-breakdown', objectKey: 'candidate', label: 'Candidate pipeline' },
    { type: 'stage-breakdown', objectKey: 'vacancy', label: 'Vacancies' },
    { type: 'object-count', objectKey: 'placement', label: 'Placements' },
  ],
  copilot: {
    title: 'Recruiting copilot',
    style: 'Fast, personable, match-maker mindset; think in roles, funnels and fees; keep candidates warm and clients informed.',
    focus: ['Candidate screening summaries', 'Outreach drafts', 'Interview scheduling', 'Placement follow-ups'],
  },
  automationIdeas: [
    'Draft outreach for every new vacancy',
    'Summarize interviews into the candidate record',
    'Nudge candidates who go quiet for 5 days',
    'Send employers a weekly shortlist update',
    'Check in before a guarantee period ends',
  ],
  automations: [
    {
      key: 'offer_status_check',
      name: 'Chase candidates sitting at offer stage',
      objectKey: 'candidate',
      trigger: { kind: 'stage_entered', stageKey: 'offer' },
      action: { kind: 'create_reminder', note: 'Check offer status for {title}', dueInDays: 3 },
    },
  ],
}
