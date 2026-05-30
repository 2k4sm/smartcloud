'use client'

import { useEffect, useState, useCallback } from 'react'
import type { ProjectMember, ProjectRole } from '@/lib/types'

export default function MembersManager({ projectId }: { projectId: string }) {
  const [members, setMembers] = useState<ProjectMember[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<ProjectRole>('viewer')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${projectId}/members`)
    const data = await res.json()
    if (res.ok) setMembers(data.members)
    setLoading(false)
  }, [projectId])

  useEffect(() => {
    load()
  }, [load])

  async function invite(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to add member')
        return
      }
      setEmail('')
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function changeRole(memberId: string, newRole: ProjectRole) {
    await fetch(`/api/projects/${projectId}/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole }),
    })
    await load()
  }

  async function remove(memberId: string) {
    if (!confirm('Remove this member from the project?')) return
    await fetch(`/api/projects/${projectId}/members/${memberId}`, {
      method: 'DELETE',
    })
    await load()
  }

  return (
    <div className="max-w-2xl space-y-6">
      <form onSubmit={invite} className="glass-card p-5">
        <h2 className="text-white font-medium mb-3 text-sm">Invite a teammate</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            required
            placeholder="teammate@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="glass-input flex-1"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as ProjectRole)}
            className="glass-input sm:w-36"
          >
            <option value="viewer">Viewer</option>
            <option value="admin">Admin</option>
          </select>
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? <span className="spinner" /> : 'Invite'}
          </button>
        </div>
        {error && <p className="text-rose-400 text-xs mt-2">{error}</p>}
        <p className="text-gray-500 text-xs mt-2">
          The person must already have a SmartCloud account. Viewers can read
          secrets; admins can also add and edit them.
        </p>
      </form>

      <div className="glass-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.03]">
              <th className="text-left text-gray-400 font-medium px-4 py-3">Member</th>
              <th className="text-left text-gray-400 font-medium px-4 py-3">Role</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-gray-500">
                  <span className="spinner" />
                </td>
              </tr>
            ) : (
              members.map((m) => (
                <tr key={m.id} className="border-b border-white/[0.06] last:border-0">
                  <td className="px-4 py-3 text-gray-200">
                    {m.email ?? m.user_id}
                  </td>
                  <td className="px-4 py-3">
                    {m.role === 'owner' ? (
                      <span className="text-cyan-400 text-xs font-medium">Owner</span>
                    ) : (
                      <select
                        value={m.role}
                        onChange={(e) =>
                          changeRole(m.id, e.target.value as ProjectRole)
                        }
                        className="glass-input py-1 text-xs w-28"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {m.role !== 'owner' && (
                      <button
                        onClick={() => remove(m.id)}
                        className="text-rose-400/70 hover:text-rose-300 hover:bg-rose-400/10 text-xs px-2 py-1 rounded-lg transition-colors"
                      >
                        remove
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
