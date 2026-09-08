import { ReputationImpactBridge } from '@/components/dashboard/ReputationImpactBridge'

export default function ReputationLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ReputationImpactBridge />
      {children}
    </>
  )
}
