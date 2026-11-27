import { useCallback, useEffect, useState } from 'react'
import { adaptNotifications } from '../adapters/notificationAdapter.js'
import { fetchNotifications, markAllNotificationsRead, markNotificationRead } from '../api/notificationApi.js'

// D-23 알림 목록·읽음 상태를 관리하고 SSE 연결 시 새 항목을 추가할 수 있는 함수를 제공한다.
export function useNotifications() {
  const [state, setState] = useState({ items: [], unreadCount: 0, loading: true, error: '' })
  const refresh = useCallback(async () => {
    setState((current) => ({ ...current, error: '', loading: true }))
    try { setState({ ...adaptNotifications(await fetchNotifications()), loading: false, error: '' }) }
    catch { setState((current) => ({ ...current, loading: false, error: '알림을 불러오지 못했어요.' })) }
  }, [])

  useEffect(() => {
    let active = true
    fetchNotifications().then((data) => { if (active) setState({ ...adaptNotifications(data), loading: false, error: '' }) })
      .catch(() => { if (active) setState((current) => ({ ...current, loading: false, error: '알림을 불러오지 못했어요.' })) })
    return () => { active = false }
  }, [])

  const addNotification = useCallback((item) => {
    setState((current) => {
      const items = [item, ...current.items.filter((row) => row.notificationId !== item.notificationId)]
      return { ...current, items, unreadCount: items.filter((row) => !row.read).length }
    })
  }, [])

  const markRead = useCallback(async (id) => {
    await markNotificationRead(id)
    setState((current) => {
      const items = current.items.map((item) => item.notificationId === id ? { ...item, read: true } : item)
      return { ...current, items, unreadCount: items.filter((item) => !item.read).length }
    })
  }, [])
  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead()
    setState((current) => ({ ...current, items: current.items.map((item) => ({ ...item, read: true })), unreadCount: 0 }))
  }, [])

  return { ...state, refresh, addNotification, markRead, markAllRead }
}
