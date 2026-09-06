import CitizenCommandCenter from '@/components/dashboard/CitizenCommandCenter'
import DashboardEvidenceAttentionQueue from '@/components/dashboard/DashboardEvidenceAttentionQueue'

export default function DashboardPage() {
  return (
    <div className="bg-[#F7F9FC]">
      <DashboardEvidenceAttentionQueue />
      <CitizenCommandCenter />
    </div>
  )
}
