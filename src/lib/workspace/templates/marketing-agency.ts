import type { WorkspaceBlueprintInput } from '../blueprint'

/** Marketing agency — projects, campaigns, deliverables, invoices. */
export const marketingAgencyBlueprint: WorkspaceBlueprintInput = {
  profile: {
    industryKey: 'marketing-agency',
    industryLabel: 'Marketing agency',
    businessModel: 'Client services & retainers',
  },
  terminology: {
    contact: { singular: 'Client', plural: 'Clients' },
  },
  objects: [
    {
      key: 'project',
      singular: 'Project',
      plural: 'Projects',
      icon: 'folder-open',
      description: 'Client engagements from discovery to delivery.',
      fields: [
        { key: 'client_name', label: 'Client', type: 'TEXT', required: true },
        { key: 'budget', label: 'Budget', type: 'MONEY' },
        { key: 'deadline', label: 'Deadline', type: 'DATE' },
        { key: 'owner', label: 'Project lead', type: 'TEXT' },
        { key: 'brief', label: 'Brief', type: 'LONG_TEXT', showInList: false },
      ],
      pipeline: [
        { key: 'discovery', label: 'Discovery' },
        { key: 'proposal', label: 'Proposal' },
        { key: 'in_progress', label: 'In progress' },
        { key: 'review', label: 'Client review' },
        { key: 'delivered', label: 'Delivered', terminal: true },
        { key: 'on_hold', label: 'On hold', terminal: true },
      ],
    },
    {
      key: 'campaign',
      singular: 'Campaign',
      plural: 'Campaigns',
      icon: 'megaphone',
      description: 'Live marketing campaigns and their channels.',
      fields: [
        { key: 'client_name', label: 'Client', type: 'TEXT', required: true },
        { key: 'channel', label: 'Channel', type: 'SELECT', options: ['Paid social', 'Search', 'Email', 'Content', 'Influencer', 'Out-of-home'] },
        { key: 'budget', label: 'Budget', type: 'MONEY' },
        { key: 'start_date', label: 'Starts', type: 'DATE' },
        { key: 'end_date', label: 'Ends', type: 'DATE', showInList: false },
        { key: 'goal', label: 'Goal', type: 'TEXT', showInList: false },
      ],
      pipeline: [
        { key: 'planned', label: 'Planned' },
        { key: 'live', label: 'Live' },
        { key: 'optimizing', label: 'Optimizing' },
        { key: 'completed', label: 'Completed', terminal: true },
        { key: 'paused', label: 'Paused', terminal: true },
      ],
    },
    {
      key: 'deliverable',
      singular: 'Deliverable',
      plural: 'Deliverables',
      icon: 'clipboard-check',
      description: 'Individual pieces of work moving through review.',
      fields: [
        { key: 'project_name', label: 'Project', type: 'TEXT' },
        { key: 'kind', label: 'Type', type: 'SELECT', options: ['Design', 'Copy', 'Video', 'Report', 'Landing page'] },
        { key: 'due_date', label: 'Due', type: 'DATE' },
        { key: 'owner', label: 'Owner', type: 'TEXT' },
      ],
      pipeline: [
        { key: 'briefed', label: 'Briefed' },
        { key: 'in_production', label: 'In production' },
        { key: 'internal_review', label: 'Internal review' },
        { key: 'client_review', label: 'Client review' },
        { key: 'approved', label: 'Approved', terminal: true },
      ],
    },
    {
      key: 'invoice',
      singular: 'Invoice',
      plural: 'Invoices',
      icon: 'receipt',
      description: 'Billing from draft to paid.',
      fields: [
        { key: 'client_name', label: 'Client', type: 'TEXT', required: true },
        { key: 'amount', label: 'Amount', type: 'MONEY', required: true },
        { key: 'invoice_number', label: 'Invoice #', type: 'TEXT' },
        { key: 'due_date', label: 'Due', type: 'DATE' },
      ],
      pipeline: [
        { key: 'draft', label: 'Draft' },
        { key: 'sent', label: 'Sent' },
        { key: 'paid', label: 'Paid', terminal: true },
        { key: 'overdue', label: 'Overdue' },
      ],
    },
  ],
  dashboard: [
    { type: 'stage-breakdown', objectKey: 'project', label: 'Project pipeline' },
    { type: 'object-count', objectKey: 'campaign', label: 'Campaigns' },
    { type: 'stage-breakdown', objectKey: 'invoice', label: 'Invoices' },
    { type: 'object-count', objectKey: 'deliverable', label: 'Deliverables' },
  ],
  copilot: {
    title: 'Agency copilot',
    style: 'Sharp, commercial and deadline-aware; think in campaigns, deliverables and billable scope; keep client updates crisp.',
    focus: ['Weekly client updates', 'Proposal drafts', 'Campaign recaps', 'Overdue invoices'],
  },
  automationIdeas: [
    'Draft a proposal when a project leaves Discovery',
    'Send clients a status update every Friday',
    'Nudge invoices that go overdue',
    'Flag deliverables stuck in client review for 5+ days',
    'Summarize meetings into the project record',
  ],
}
