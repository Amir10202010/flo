import type { WorkspaceBlueprintInput } from '../blueprint'

/** Generic business — deals and tasks; the safe fallback for any description. */
export const genericBlueprint: WorkspaceBlueprintInput = {
  profile: {
    industryKey: 'generic',
    industryLabel: 'General business',
  },
  terminology: {
    contact: { singular: 'Client', plural: 'Clients' },
  },
  objects: [
    {
      key: 'deal',
      singular: 'Deal',
      plural: 'Deals',
      icon: 'target',
      description: 'Opportunities moving through your sales process.',
      fields: [
        { key: 'company', label: 'Company', type: 'TEXT' },
        { key: 'value', label: 'Value', type: 'MONEY' },
        { key: 'expected_close', label: 'Expected close', type: 'DATE' },
        { key: 'next_step', label: 'Next step', type: 'TEXT' },
        { key: 'notes', label: 'Notes', type: 'LONG_TEXT', showInList: false },
      ],
      pipeline: [
        { key: 'lead', label: 'Lead' },
        { key: 'qualified', label: 'Qualified' },
        { key: 'proposal', label: 'Proposal' },
        { key: 'negotiation', label: 'Negotiation' },
        { key: 'won', label: 'Won', terminal: true },
        { key: 'lost', label: 'Lost', terminal: true },
      ],
    },
    {
      key: 'task',
      singular: 'Task',
      plural: 'Tasks',
      icon: 'clipboard-list',
      description: 'Work items the team is tracking.',
      fields: [
        { key: 'due_date', label: 'Due', type: 'DATE' },
        { key: 'owner', label: 'Owner', type: 'TEXT' },
        { key: 'details', label: 'Details', type: 'LONG_TEXT', showInList: false },
      ],
      pipeline: [
        { key: 'todo', label: 'To do' },
        { key: 'in_progress', label: 'In progress' },
        { key: 'done', label: 'Done', terminal: true },
      ],
    },
  ],
  dashboard: [
    { type: 'stage-breakdown', objectKey: 'deal', label: 'Sales pipeline' },
    { type: 'object-count', objectKey: 'task', label: 'Tasks' },
  ],
  copilot: {
    title: 'Workspace copilot',
    style: 'Clear and commercial; keep deals moving and replies fast.',
    focus: ['Follow-ups', 'Proposal drafts', 'Pipeline hygiene'],
  },
  automationIdeas: [
    'Follow up on deals with no activity for a week',
    'Summarize new inbound leads into deal records',
    'Send a Monday pipeline overview',
  ],
  automations: [
    {
      key: 'proposal_follow_up',
      name: 'Follow up on sent proposals',
      objectKey: 'deal',
      trigger: { kind: 'stage_entered', stageKey: 'proposal' },
      action: { kind: 'create_reminder', note: 'Follow up on proposal for “{title}”', dueInDays: 5 },
    },
  ],
}
