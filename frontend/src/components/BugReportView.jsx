import { motion } from 'framer-motion'
import { ContentCard, SectionHeader } from '../ui/layout'
import { InputField, PrimaryButton, SecondaryButton } from '../ui/controls'
import { LoadingButtonContent } from '../ui/loading'
import { useWorkshopMotion } from '../ui/motion'

const areas = ['Star Force', 'Star Force strategies', 'Potential', 'Flames', 'Equipment upgrade', 'Navigation / display', 'Other']

export default function BugReportView({ fields, report, copyStatus, submission, change, prepare, submitReport, copyReport, downloadReport }) {
  const { entrance, transition, reduced } = useWorkshopMotion()
  return <div className="bug-workshop">
    <ContentCard className="bug-main" aria-labelledby="bug-report-heading">
      <SectionHeader id="bug-report-heading" title="Report a Bug" description="Help make Maple Workshop better. Prepare your report, review the details, then submit it to the developer." />
      <form onSubmit={prepare} className="bug-form">
        <fieldset disabled={submission.loading} className="bug-fields">
          <legend className="sr-only">Bug report details</legend>
          <InputField label="Title" name="summary" value={fields.summary} onChange={change} required maxLength={120} pattern={'.*\\S.*'} placeholder="Example: Strategy comparison never finishes" />
          <fieldset className="bug-category-field"><legend>Category</legend>
            <div className="bug-category-chips">{areas.map(area => <label key={area} className="bug-category-chip">
              <input type="radio" name="area" value={area} checked={fields.area === area} onChange={change} />
              <span>{area}</span>
            </label>)}</div>
          </fieldset>
          <div className="bug-description"><h3>Description</h3><p className="mw-help">Keep each part of the report specific so we can reproduce the issue.</p>
            {[
              ['steps', 'Steps to reproduce', '1. Open Star Force strategies\n2. Set level 200, 0–25 stars\n3. Click Compare strategies'],
              ['expected', 'What did you expect?', 'Describe what should happen.'],
              ['actual', 'What happened instead?', 'Include the result or exact error message.'],
            ].map(([name, label, placeholder]) => <InputField key={name} multiline label={label} name={name} value={fields[name]} onChange={change} required maxLength={2000} rows={4} placeholder={placeholder} />)}
          </div>
          <InputField label="Browser and device (optional)" name="environment" value={fields.environment} onChange={change} maxLength={200} placeholder="Example: Firefox on Windows 11, or Safari on iPhone" />
          <InputField label="Contact information (optional)" name="contact" value={fields.contact} onChange={change} maxLength={200} aria-describedby="bug-report-contact-hint" placeholder="Discord: username, Reddit: u/username, or X: @handle" />
          <p id="bug-report-contact-hint" className="mw-help">Leave a Discord username, Reddit username, or X handle if you would like to be contacted about your report. Include the platform so we know where to reach you.</p>
          <p className="mw-help">Only the details you enter are included. Do not include passwords, account credentials, or other private information.</p>
          <PrimaryButton type="submit" className="w-full">Prepare report</PrimaryButton>
        </fieldset>
      </form>
      {report && <section className="bug-preview" aria-labelledby="report-preview-heading" aria-busy={!!submission.loading}>
        <SectionHeader id="report-preview-heading" title="Review your report" description={submission.saved ? 'Your report has been saved. Thank you for helping improve the app.' : 'Review the details below before submitting your report.'} />
        <InputField multiline label="Report text" readOnly value={report} rows={12} />
        <div className="bug-report-actions">
          <PrimaryButton disabled={submission.loading || !!submission.saved} onClick={submitReport}>
            <LoadingButtonContent busy={submission.loading} label="Submitting…">{submission.saved ? 'Report submitted' : 'Submit report'}</LoadingButtonContent>
          </PrimaryButton>
          <SecondaryButton onClick={copyReport}>Copy report</SecondaryButton>
          <SecondaryButton onClick={downloadReport}>Download report</SecondaryButton>
        </div>
        {submission.error && <p className="bug-error" role="alert">{submission.error}</p>}
        {submission.saved && <motion.div {...entrance} transition={transition} className="bug-success" role="status">
          <svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true"><circle cx="24" cy="24" r="21" fill="currentColor" opacity=".12" /><motion.path d="m14 24 7 7 14-14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" initial={reduced ? false : {pathLength:0}} animate={{pathLength:1}} transition={transition} /></svg>
          <div><h3>Thanks for helping the workshop!</h3><p>Your bug report was submitted successfully.</p><p>Report reference: <strong>{submission.saved}</strong></p></div>
        </motion.div>}
        <p className="mw-help" role="status">{copyStatus}</p>
      </section>}
    </ContentCard>
    <ContentCard className="bug-sidebar" aria-labelledby="bug-before-heading">
      <SectionHeader id="bug-before-heading" title="Before Submitting" />
      <ul className="bug-reminders">
        <li>Describe what happened and what you expected.</li>
        <li>Provide the steps needed to reproduce the issue.</li>
        <li>Specify the calculator, equipment, level, modes, and event settings.</li>
        <li>For an incorrect result, include the expected value and its source.</li>
        <li>Copy the exact error message if one appeared.</li>
      </ul>
      <div className="bug-sidebar-note"><h3>Review before sending</h3><p className="mw-help">Prepare report lets you check everything first. You can also copy or download the report as text.</p><p className="mw-help">No account or email app is needed.</p></div>
    </ContentCard>
  </div>
}
