import { motion } from 'framer-motion'
import { InputField } from './controls'
import { useWorkshopMotion } from './motion'

// Presentation only: the caller owns the constraint and native validation.
export default function TargetRequirementRow({ label, operator = '≥', ...props }) {
  const { entrance, transition } = useWorkshopMotion()
  return <motion.div className="mw-requirement-row" {...entrance} transition={transition}>
    <InputField type="number" label={<>{label} <span aria-label="at least">{operator}</span></>} {...props} />
  </motion.div>
}
