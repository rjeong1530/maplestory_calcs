import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { ThemeProvider } from './theme'
import {
  AppShell, Navbar, PageHeader, ContentCard, CalculatorPanel, CalculatorGrid,
  ResultCard, StatCard, SectionHeader, Tabs, SegmentedControl, Toggle,
  SelectField, NumberStepper, InputField, Tooltip, ItemCard, EquipmentSlot,
  RarityBadge, PrimaryButton, SecondaryButton, DangerButton, LoadingSpinner,
  SkeletonCard, EmptyState, ErrorState, Modal, Toast,
} from './index'

export default function Preview() {
  const [tab, setTab] = useState('controls')
  const [segment, setSegment] = useState('standard')
  const [stars, setStars] = useState('17')
  const [checked, setChecked] = useState(true)
  const [selected, setSelected] = useState(0)
  const [modal, setModal] = useState(false)
  const [toast, setToast] = useState(false)
  const [result, setResult] = useState('12.6')
  const [error, setError] = useState(true)
  return <AppShell navbar={<Navbar brandHref="#" links={[
    { href: '#components', label: 'Components', active: true }, { href: '#palette', label: 'Palette' },
    { href: '#feedback', label: 'Feedback' },
  ]} actions={<SecondaryButton onClick={() => setModal(true)}>Open dialog</SecondaryButton>} />}>
    <PageHeader eyebrow="The workshop toolkit" title="A little magic. A clear next step." icon="✦"
      description="Shared building blocks for Maple Workshop. Preview values are illustrative; no calculator or API is connected." />
    <div id="components" className="mb-6">
      <Tabs label="Component examples" value={tab} onChange={setTab} tabs={[
        { value: 'controls', label: 'Controls & results', content: <CalculatorGrid columns={3}>
          <CalculatorPanel title="Plan your next upgrade" description="Native inputs, familiar interactions.">
            <div className="grid gap-5">
              <SelectField label="Equipment type" defaultValue="hat"><option value="hat">Hat</option><option value="gloves">Gloves</option></SelectField>
              <InputField label="Item level" type="number" min="1" max="300" defaultValue="200" required />
              <NumberStepper label="Current stars" value={stars} onValueChange={setStars} min={0} max={30} />
              <SegmentedControl label="Example mode" value={segment} onChange={setSegment} options={[{ value: 'standard', label: 'Standard' }, { value: 'safeguard', label: 'Safeguard' }]} />
              <Toggle label="Example event setting" checked={checked} onChange={event => setChecked(event.target.checked)} />
              <Tooltip content="This is a component preview. It does not calculate upgrade costs."><span className="mw-muted text-xs underline decoration-dotted">About these values ⓘ</span></Tooltip>
              <PrimaryButton onClick={() => setResult(value => value === '12.6' ? '18.4' : '12.6')}>Preview result transition →</PrimaryButton>
            </div>
          </CalculatorPanel>
          <div className="grid gap-5">
            <ItemCard name="Your next adventure" rarity="Legendary" detail="Equipment card" image="/maplecalculator48.png" />
            <ContentCard>
              <SectionHeader title="Equipment slots" description="Selection belongs to the calling page." />
              <div className="flex flex-wrap gap-3">{['Rare', 'Epic', 'Unique', 'Legendary'].map((rarity, i) => <EquipmentSlot key={rarity} label={`${rarity} item`} rarity={rarity} selected={selected === i} onClick={() => setSelected(i)} />)}<EquipmentSlot label="Unavailable slot" disabled /></div>
            </ContentCard>
            <ContentCard hover><SectionHeader title="Made for focused planning" /><p className="mw-muted mb-0">Soft surfaces, clear hierarchy and room for the details that matter.</p></ContentCard>
          </div>
          <ResultCard>
            <div className="grid gap-3">
              <StatCard label="Example success rate" value={result} unit="%" hint="Illustrative value" />
              <StatCard label="Example expected attempts" value="96" />
              <StatCard label="Example expected cost" value="18.4M" unit="mesos" />
            </div>
            <div className="mw-actions mt-5 flex gap-2"><SecondaryButton onClick={() => setToast(true)}>Preview notification</SecondaryButton></div>
          </ResultCard>
        </CalculatorGrid> },
        { value: 'validation', label: 'Validation & states', content: <CalculatorGrid>
          <CalculatorPanel title="Field states"><div className="grid gap-4">
            <InputField label="Equipment name" defaultValue="" required error="Enter an equipment name." />
            <SelectField label="Disabled field" disabled defaultValue=""><option value="">Waiting for options</option></SelectField>
            <InputField label="Read-only value" value="Preserved by the caller" readOnly />
            <InputField label="Notes" multiline rows={3} hint="Field hints are associated with the control." />
          </div></CalculatorPanel>
          <ResultCard><EmptyState title="No result yet" description="Choose your settings to get started." /></ResultCard>
        </CalculatorGrid> },
      ]} />
    </div>
    <ContentCard id="palette" className="mb-6">
      <SectionHeader title="A brighter palette" description="Sky blue, warm maple accents and four readable rarity treatments." />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">{['background', 'primary', 'secondary', 'success', 'warning', 'danger', 'purple', 'border'].map(token => <div key={token}>
        <div className="mb-2 h-12 rounded-lg border border-[var(--border)]" style={{ background: `var(--${token})` }} /><span className="mw-muted text-xs capitalize">{token}</span>
      </div>)}</div>
      <div className="mt-5 flex flex-wrap gap-2">{['Rare', 'Epic', 'Unique', 'Legendary'].map(rarity => <RarityBadge key={rarity} rarity={rarity} />)}</div>
      <div className="mw-actions mt-5 flex flex-wrap gap-3"><PrimaryButton>Primary action</PrimaryButton><SecondaryButton>Secondary action</SecondaryButton><DangerButton onClick={() => setModal(true)}>Danger action</DangerButton><PrimaryButton disabled>Unavailable</PrimaryButton></div>
    </ContentCard>
    <div id="feedback"><CalculatorGrid columns={3}>
      <ContentCard><SectionHeader title="Loading" /><LoadingSpinner label="Loading equipment…" /><p className="mw-muted mt-4 mb-0">Status remains readable when reduced motion is enabled.</p></ContentCard>
      <SkeletonCard />
      {error ? <ErrorState message="An example connection error. Your inputs are still here." onRetry={() => setError(false)} />
        : <ContentCard><EmptyState title="Retry acknowledged" description="This preview does not send a request." action={<SecondaryButton onClick={() => setError(true)}>Show error again</SecondaryButton>} /></ContentCard>}
    </CalculatorGrid></div>
    <p className="mt-8 mb-0 text-center text-xs">Maple Workshop · Design system preview · No saved equipment is read or changed</p>
    <Modal open={modal} onClose={() => setModal(false)} title="A moment before you continue" description="Dialogs keep focus inside, close with Escape, and return focus to the trigger."
      actions={<><SecondaryButton onClick={() => setModal(false)}>Cancel</SecondaryButton><PrimaryButton onClick={() => { setModal(false); setToast(true) }}>Confirm preview</PrimaryButton></>}>
      <InputField label="Example note" placeholder="Try keyboard navigation" />
    </Modal>
    <Toast open={toast} onDismiss={() => setToast(false)}>Your preview is ready. No equipment was changed.</Toast>
  </AppShell>
}

createRoot(document.getElementById('root')).render(<StrictMode><ThemeProvider><Preview /></ThemeProvider></StrictMode>)
