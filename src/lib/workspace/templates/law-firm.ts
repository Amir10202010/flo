import type { WorkspaceBlueprintInput } from '../blueprint'

/** Law firm — cases, hearings, contracts, deadlines. */
export const lawFirmBlueprint: WorkspaceBlueprintInput = {
  profile: {
    industryKey: 'law-firm',
    industryLabel: 'Law firm',
    businessModel: 'Matter-based legal services',
  },
  terminology: {
    contact: { singular: 'Client', plural: 'Clients' },
  },
  objects: [
    {
      key: 'case',
      singular: 'Case',
      plural: 'Cases',
      icon: 'scale',
      description: 'Legal matters from intake to resolution.',
      fields: [
        { key: 'client_name', label: 'Client', type: 'TEXT', required: true },
        { key: 'practice_area', label: 'Practice area', type: 'SELECT', options: ['Corporate', 'Litigation', 'Family', 'Employment', 'Real estate', 'IP'] },
        { key: 'case_number', label: 'Case #', type: 'TEXT' },
        { key: 'next_deadline', label: 'Next deadline', type: 'DATE' },
        { key: 'opposing_party', label: 'Opposing party', type: 'TEXT', showInList: false },
        { key: 'court', label: 'Court', type: 'TEXT', showInList: false },
        { key: 'summary', label: 'Matter summary', type: 'LONG_TEXT', showInList: false },
      ],
      pipeline: [
        { key: 'intake', label: 'Intake' },
        { key: 'investigation', label: 'Investigation' },
        { key: 'filed', label: 'Filed' },
        { key: 'discovery', label: 'Discovery' },
        { key: 'hearing', label: 'Hearing' },
        { key: 'settled', label: 'Settled', terminal: true },
        { key: 'closed', label: 'Closed', terminal: true },
      ],
    },
    {
      key: 'hearing',
      singular: 'Hearing',
      plural: 'Hearings',
      icon: 'gavel',
      description: 'Court dates and their preparation state.',
      fields: [
        { key: 'case_number', label: 'Case #', type: 'TEXT', required: true },
        { key: 'scheduled_at', label: 'When', type: 'DATETIME', required: true },
        { key: 'court', label: 'Court', type: 'TEXT' },
        { key: 'judge', label: 'Judge', type: 'TEXT', showInList: false },
        { key: 'preparation_notes', label: 'Preparation notes', type: 'LONG_TEXT', showInList: false },
      ],
      pipeline: [
        { key: 'scheduled', label: 'Scheduled' },
        { key: 'preparing', label: 'Preparing' },
        { key: 'ready', label: 'Ready' },
        { key: 'held', label: 'Held', terminal: true },
        { key: 'adjourned', label: 'Adjourned', terminal: true },
      ],
    },
    {
      key: 'contract',
      singular: 'Contract',
      plural: 'Contracts',
      icon: 'file-text',
      description: 'Agreements moving through drafting and negotiation.',
      fields: [
        { key: 'client_name', label: 'Client', type: 'TEXT', required: true },
        { key: 'counterparty', label: 'Counterparty', type: 'TEXT' },
        { key: 'value', label: 'Value', type: 'MONEY' },
        { key: 'effective_date', label: 'Effective', type: 'DATE', showInList: false },
        { key: 'key_terms', label: 'Key terms', type: 'LONG_TEXT', showInList: false },
      ],
      pipeline: [
        { key: 'draft', label: 'Draft' },
        { key: 'internal_review', label: 'Internal review' },
        { key: 'negotiation', label: 'Negotiation' },
        { key: 'signed', label: 'Signed', terminal: true },
        { key: 'terminated', label: 'Terminated', terminal: true },
      ],
    },
    {
      key: 'deadline',
      singular: 'Deadline',
      plural: 'Deadlines',
      icon: 'calendar-clock',
      description: 'Filing and procedural deadlines that cannot slip.',
      fields: [
        { key: 'description', label: 'What is due', type: 'TEXT', required: true },
        { key: 'case_number', label: 'Case #', type: 'TEXT' },
        { key: 'due_at', label: 'Due', type: 'DATETIME', required: true },
      ],
      pipeline: [
        { key: 'upcoming', label: 'Upcoming' },
        { key: 'urgent', label: 'Urgent' },
        { key: 'met', label: 'Met', terminal: true },
        { key: 'missed', label: 'Missed', terminal: true },
      ],
    },
  ],
  dashboard: [
    { type: 'stage-breakdown', objectKey: 'case', label: 'Case pipeline' },
    { type: 'stage-breakdown', objectKey: 'deadline', label: 'Deadlines' },
    { type: 'object-count', objectKey: 'hearing', label: 'Hearings' },
    { type: 'stage-breakdown', objectKey: 'contract', label: 'Contracts' },
  ],
  copilot: {
    title: 'Legal practice copilot',
    style: 'Precise, formal and risk-aware; anchor everything to deadlines and documents; summarize, draft and flag — never give definitive legal advice on behalf of the firm.',
    focus: ['Deadline tracking', 'Hearing preparation', 'Contract summaries', 'Client correspondence drafts'],
  },
  automationIdeas: [
    'Escalate any deadline that comes within 72 hours',
    'Summarize new contracts the moment they are added',
    'Prepare a hearing checklist three days before the date',
    'Draft engagement letters for cases leaving Intake',
    'Send clients a matter status note after every stage change',
  ],
}
