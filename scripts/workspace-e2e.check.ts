/**
 * Integration check for the adaptive-workspace service layer against the REAL
 * dev database: materialize a blueprint for a throwaway org, read the schema
 * model back, run record CRUD + stats, re-apply a shrunk blueprint (archive
 * semantics), then delete the org (cascades clean up everything).
 *
 * Run with: `npm run test:workspace-e2e` (needs DATABASE_URL).
 * Safe: only touches rows of the temp org it creates.
 */
import assert from 'node:assert/strict'
import { prisma } from '@/lib/prisma'
import { safeParseBlueprint } from '@/lib/workspace/blueprint'
import { INDUSTRY_TEMPLATES } from '@/lib/workspace/templates'
import { addFieldToObject, applyBlueprint, getObjectByKey, getWorkspaceSchema } from '@/services/workspace/workspace.service'
import { createRecord, deleteRecord, getRecord, listRecords, recordStats, sweepRecordAutomations, updateRecord } from '@/services/workspace/record.service'

let passed = 0
function check(name: string) {
  passed++
  console.log(`  ✓ ${name}`)
}

async function main() {
  const slug = `wse2e-${Date.now().toString(36)}`
  const org = await prisma.organization.create({ data: { name: 'Workspace E2E (temp)', slug } })
  // Owner membership so stage automations have someone to remind.
  const user = await prisma.user.create({ data: { email: `${slug}@e2e.local`, name: 'E2E Owner' } })
  await prisma.membership.create({ data: { organizationId: org.id, userId: user.id, role: 'OWNER', status: 'ACTIVE' } })
  console.log(`workspace e2e — temp org ${org.id} (${slug})`)

  try {
    // 1. Materialize the dental template.
    const parsed = safeParseBlueprint(INDUSTRY_TEMPLATES['dental-clinic'].blueprint)
    assert.equal(parsed.ok, true)
    if (!parsed.ok) return
    await applyBlueprint(org.id, parsed.blueprint, { source: 'TEMPLATE', provider: 'local' })
    check('applyBlueprint materializes the dental template')

    // 2. Read-model.
    const schema = await getWorkspaceSchema(org.id)
    assert.ok(schema)
    assert.equal(schema!.profile.industryKey, 'dental-clinic')
    assert.equal(schema!.objects.length, 3)
    assert.deepEqual(schema!.nav.map((n) => n.key), ['patient', 'appointment', 'treatment_plan'])
    assert.ok(schema!.dashboard.length >= 3)
    const patient = schema!.objects.find((o) => o.key === 'patient')!
    assert.ok(patient.fields.some((f) => f.key === 'insurance_policy_number'))
    check('getWorkspaceSchema returns profile, nav, objects, widgets')

    // 3. Record CRUD with validation.
    const bad = await createRecord(org.id, 'appointment', { title: 'Checkup', data: { scheduled_at: 'whenever' } }, { userId: 'e2e', membershipId: 'e2e' })
    assert.ok(bad && !bad.ok, 'invalid DATETIME must be rejected')
    check('createRecord rejects invalid field data')

    const created = await createRecord(
      org.id,
      'appointment',
      { title: 'Checkup — Aliya', data: { patient_name: 'Aliya', scheduled_at: '2026-07-03T10:30', doctor: 'Dr. K' } },
      { userId: 'e2e', membershipId: 'e2e' },
    )
    assert.ok(created && created.ok)
    if (!created || !created.ok) return
    assert.equal(created.record.stageKey, 'requested', 'defaults to first pipeline stage')
    check('createRecord validates, stores and defaults the stage')

    const moved = await updateRecord(org.id, created.record.id, { stageKey: 'confirmed', data: { room: 'A2' } })
    assert.ok(moved && moved.ok)
    if (!moved || !moved.ok) return
    assert.equal(moved.record.stageKey, 'confirmed')
    assert.equal(moved.record.data.room, 'A2')
    assert.equal(moved.record.data.patient_name, 'Aliya', 'partial update merges data')
    check('updateRecord moves stage and merges data')

    const detail = await getRecord(org.id, 'appointment', created.record.id)
    assert.ok(detail && detail.record.id === created.record.id && detail.object.key === 'appointment')
    assert.equal(await getRecord(org.id, 'patient', created.record.id), null, 'object/record mismatch → null')
    check('getRecord scopes by object and org')

    const listed = await listRecords(org.id, 'appointment')
    assert.equal(listed!.records.length, 1)
    const stats = await recordStats(org.id)
    const apptObj = await getObjectByKey(org.id, 'appointment')
    assert.equal(stats.get(apptObj!.id)?.byStage.confirmed, 1)
    check('listRecords + recordStats see the record')

    // 4. Stage automations: the dental template reminds on treatment_plan
    // entering Proposed (its first stage) — creating one fires exactly once.
    const auto = await prisma.recordAutomation.findFirst({ where: { organizationId: org.id, key: 'treatment_follow_up' } })
    assert.ok(auto && auto.isActive, 'blueprint automation materialized active')
    const plan = await createRecord(
      org.id,
      'treatment_plan',
      { title: 'Braces — Aliya', data: { patient_name: 'Aliya', treatment: 'Braces' } },
      { userId: user.id, membershipId: 'e2e' },
    )
    assert.ok(plan && plan.ok)
    if (!plan || !plan.ok) return
    assert.equal(await prisma.reminder.count({ where: { organizationId: org.id } }), 1, 'stage_entered automation created one reminder')
    // Leaving and re-entering the stage must NOT re-fire (fire-once guard).
    await updateRecord(org.id, plan.record.id, { stageKey: 'accepted' })
    await updateRecord(org.id, plan.record.id, { stageKey: 'proposed' })
    assert.equal(await prisma.reminder.count({ where: { organizationId: org.id } }), 1, 'fire-once per record+stage')
    await deleteRecord(org.id, plan.record.id)
    check('stage automation fires once and is idempotent on re-entry')

    // 4b. Sweep triggers: the dental template confirms appointments the day
    // before (date_approaching scheduled_at, 1 day). Tomorrow qualifies.
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 16)
    const appt = await createRecord(
      org.id,
      'appointment',
      { title: 'Cleaning — Marat', data: { patient_name: 'Marat', scheduled_at: tomorrow } },
      { userId: user.id, membershipId: 'e2e' },
    )
    assert.ok(appt && appt.ok)
    const before = await prisma.reminder.count({ where: { organizationId: org.id } })
    const sweep1 = await sweepRecordAutomations()
    const afterFirst = await prisma.reminder.count({ where: { organizationId: org.id } })
    assert.ok(afterFirst > before, `date_approaching fired (sweep fired=${sweep1.fired})`)
    await sweepRecordAutomations()
    assert.equal(await prisma.reminder.count({ where: { organizationId: org.id } }), afterFirst, 'sweep is idempotent')
    if (appt && appt.ok) await deleteRecord(org.id, appt.record.id)
    check('date_approaching sweep fires once per record+date')

    // 4c. Manual schema editing: add a field, then store a value in it.
    const added = await addFieldToObject(org.id, 'patient', { label: 'Referral Source', type: 'TEXT' })
    assert.ok(added && added.ok, added && !added.ok ? added.error : 'field added')
    if (added && added.ok) assert.equal(added.field.key, 'referral_source')
    const dup = await addFieldToObject(org.id, 'patient', { label: 'Referral Source', type: 'TEXT' })
    assert.ok(dup && !dup.ok, 'duplicate label rejected')
    const templateDup = await addFieldToObject(org.id, 'patient', { label: 'Insurance Policy Number', type: 'TEXT' })
    assert.ok(templateDup && !templateDup.ok, 'collision with a template field rejected')
    const badSelect = await addFieldToObject(org.id, 'patient', { label: 'Plan tier', type: 'SELECT', options: ['Only one'] })
    assert.ok(badSelect && !badSelect.ok, 'select needs 2+ options')
    const withValue = await createRecord(
      org.id,
      'patient',
      { title: 'Marat', data: { referral_source: 'Instagram' } },
      { userId: user.id, membershipId: 'e2e' },
    )
    assert.ok(withValue && withValue.ok && withValue.record.data.referral_source === 'Instagram')
    if (withValue && withValue.ok) await deleteRecord(org.id, withValue.record.id)
    check('addFieldToObject: slug key, uniqueness, option rules, usable immediately')

    // 5. Re-apply a shrunk blueprint — archive-only, records intact.
    const shrunk = { ...parsed.blueprint, objects: parsed.blueprint.objects.filter((o) => o.key !== 'treatment_plan') }
    const reparsed = safeParseBlueprint(shrunk)
    assert.equal(reparsed.ok, true)
    if (!reparsed.ok) return
    await applyBlueprint(org.id, reparsed.blueprint, { source: 'MANUAL' })
    const after = await getWorkspaceSchema(org.id)
    assert.equal(after!.objects.length, 2, 'archived object leaves the read-model')
    const archivedRow = await prisma.objectDefinition.findFirst({ where: { organizationId: org.id, key: 'treatment_plan' } })
    assert.ok(archivedRow && archivedRow.isArchived, 'object archived, not deleted')
    const stillThere = await listRecords(org.id, 'appointment')
    assert.equal(stillThere!.records.length, 1, 'records untouched by re-apply')
    const autoAfter = await prisma.recordAutomation.findFirst({ where: { organizationId: org.id, key: 'treatment_follow_up' } })
    assert.ok(autoAfter && !autoAfter.isActive, 'automation of removed object deactivated, not deleted')
    const patientAfter = await getObjectByKey(org.id, 'patient')
    assert.ok(
      patientAfter!.fields.some((f) => f.key === 'referral_source'),
      'manually-added fields survive blueprint re-application',
    )
    check('re-apply archives (never deletes) and preserves records + manual fields')

    // 6. Delete record.
    assert.equal(await deleteRecord(org.id, created.record.id), true)
    assert.equal((await listRecords(org.id, 'appointment'))!.records.length, 0)
    check('deleteRecord removes the row')
  } finally {
    await prisma.organization.delete({ where: { id: org.id } })
    await prisma.user.delete({ where: { id: user.id } })
    console.log('  ✓ temp org + user cascaded away')
    await prisma.$disconnect()
  }

  console.log(`\n${passed} e2e checks passed.`)
}

void main().catch(async (err) => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
