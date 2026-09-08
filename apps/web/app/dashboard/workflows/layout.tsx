import { WorkflowTriageBoard } from '@/components/dashboard/WorkflowTriageBoard'

export default function WorkflowsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <WorkflowTriageBoard />
      {children}
    </>
  )
}
