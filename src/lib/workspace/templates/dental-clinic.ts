import type { WorkspaceBlueprintInput } from '../blueprint'

/** Dental clinic — patients, appointments, treatment plans, recall. */
export const dentalClinicBlueprint: WorkspaceBlueprintInput = {
  profile: {
    industryKey: 'dental-clinic',
    industryLabel: 'Dental clinic',
    businessModel: 'Appointment-based patient care',
  },
  terminology: {
    contact: { singular: 'Patient', plural: 'Patients' },
    conversation: { singular: 'Patient inquiry', plural: 'Patient inquiries' },
  },
  objects: [
    {
      key: 'patient',
      singular: 'Patient',
      plural: 'Patients',
      icon: 'user',
      description: 'People the clinic treats — contact details, insurance and history.',
      fields: [
        { key: 'phone', label: 'Phone', type: 'PHONE' },
        { key: 'email', label: 'Email', type: 'EMAIL', showInList: false },
        { key: 'date_of_birth', label: 'Date of birth', type: 'DATE', showInList: false },
        { key: 'insurance_provider', label: 'Insurance', type: 'SELECT', options: ['None', 'Private', 'Employer plan', 'State'] },
        { key: 'insurance_policy_number', label: 'Policy number', type: 'TEXT', showInList: false },
        { key: 'last_visit', label: 'Last visit', type: 'DATE' },
        { key: 'allergies', label: 'Allergies', type: 'TEXT', showInList: false },
        { key: 'notes', label: 'Notes', type: 'LONG_TEXT', showInList: false },
      ],
    },
    {
      key: 'appointment',
      singular: 'Appointment',
      plural: 'Appointments',
      icon: 'calendar-check',
      description: 'Scheduled visits with their confirmation status.',
      fields: [
        { key: 'patient_name', label: 'Patient', type: 'TEXT', required: true },
        { key: 'scheduled_at', label: 'When', type: 'DATETIME', required: true },
        { key: 'doctor', label: 'Doctor', type: 'TEXT' },
        { key: 'procedure', label: 'Procedure', type: 'TEXT' },
        { key: 'room', label: 'Room / chair', type: 'TEXT', showInList: false },
        { key: 'notes', label: 'Notes', type: 'LONG_TEXT', showInList: false },
      ],
      pipeline: [
        { key: 'requested', label: 'Requested' },
        { key: 'confirmed', label: 'Confirmed' },
        { key: 'completed', label: 'Completed', terminal: true },
        { key: 'no_show', label: 'No-show', terminal: true },
        { key: 'cancelled', label: 'Cancelled', terminal: true },
      ],
    },
    {
      key: 'treatment_plan',
      singular: 'Treatment plan',
      plural: 'Treatment plans',
      icon: 'clipboard-list',
      description: 'Proposed courses of treatment and their acceptance status.',
      fields: [
        { key: 'patient_name', label: 'Patient', type: 'TEXT', required: true },
        { key: 'treatment', label: 'Treatment', type: 'TEXT', required: true },
        { key: 'doctor', label: 'Doctor', type: 'TEXT' },
        { key: 'total_cost', label: 'Total cost', type: 'MONEY' },
        { key: 'insurance_covered', label: 'Insurance covered', type: 'BOOLEAN', showInList: false },
        { key: 'start_date', label: 'Start date', type: 'DATE', showInList: false },
        { key: 'notes', label: 'Clinical notes', type: 'LONG_TEXT', showInList: false },
      ],
      pipeline: [
        { key: 'proposed', label: 'Proposed' },
        { key: 'accepted', label: 'Accepted' },
        { key: 'in_progress', label: 'In progress' },
        { key: 'completed', label: 'Completed', terminal: true },
        { key: 'declined', label: 'Declined', terminal: true },
      ],
    },
  ],
  dashboard: [
    { type: 'stage-breakdown', objectKey: 'appointment', label: 'Appointments' },
    { type: 'stage-breakdown', objectKey: 'treatment_plan', label: 'Treatment funnel' },
    { type: 'object-count', objectKey: 'patient', label: 'Patients' },
  ],
  copilot: {
    title: 'Dental practice copilot',
    style: 'Warm, precise and patient-first; use dental terminology (recall, hygiene visit, treatment plan) naturally and keep messages reassuring.',
    focus: ['Appointment reminders', 'Recall & follow-ups', 'Treatment plan acceptance', 'Insurance questions'],
  },
  automationIdeas: [
    'Send appointment reminders the day before each visit',
    'Follow up when a treatment plan sits in Proposed for a week',
    'Recall patients whose last visit was over 6 months ago',
    'Flag no-shows for a reschedule call the same day',
    'Draft insurance responses from the patient record',
  ],
  automations: [
    {
      key: 'treatment_follow_up',
      name: 'Follow up on proposed treatment plans',
      objectKey: 'treatment_plan',
      trigger: { kind: 'stage_entered', stageKey: 'proposed' },
      action: { kind: 'create_reminder', note: 'Follow up on treatment plan “{title}” — still awaiting acceptance', dueInDays: 7 },
    },
    {
      key: 'no_show_reschedule',
      name: 'Reschedule no-shows the same day',
      objectKey: 'appointment',
      trigger: { kind: 'stage_entered', stageKey: 'no_show' },
      action: { kind: 'create_reminder', note: 'Call to reschedule: {title}', dueInDays: 0 },
    },
  ],
}
