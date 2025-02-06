'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type Order = {
  id: string
  table_name: string | null
  status: string | null
  items: any // JSONB, {id, name, price, quantity}[] を格納予定
  created_at: string | null
}

export default function StaffOrders() {
  const [orders, setOrders] = useState<Order[]>([])

  // orders一覧を取得
  const fetchOrders = async () => {
    let { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      return
    }
    setOrders(data as Order[])
  }

  useEffect(() => {
    fetchOrders()

    // リアルタイム購読
    const channel = supabase
      .channel('orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          console.log('スタッフ画面：Realtime payload:', payload)
          // 音を鳴らす例（フォアグラウンドで開いている場合）
          const audio = new Audio('/sounds/notify.mp3')
          audio.play().catch(err => console.warn("Auto-play blocked:", err))

          // 変更があったら再取得
          fetchOrders()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // ステータスを "provided" に更新
  const handleProvided = async (id: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: 'provided' })
      .eq('id', id)
    if (error) console.error(error)
  }

  // ステータスを "paid" に更新 など、必要に応じて追加
  const handlePaid = async (id: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: 'paid' })
      .eq('id', id)
    if (error) console.error(error)
  }

  return (
    <div style={{ border: '1px solid #ccc', padding: 10 }}>
      <h2>スタッフ側 - 注文一覧</h2>
      <ul>
        {orders.map((o) => (
          <li key={o.id} style={{ marginBottom: 10 }}>
            <div>
              <strong>Table:</strong> {o.table_name} / 
              <strong>Status:</strong> {o.status}
              <button onClick={() => handleProvided(o.id)} style={{ marginLeft: 8 }}>
                提供完了
              </button>
              <button onClick={() => handlePaid(o.id)} style={{ marginLeft: 8 }}>
                お会計済み
              </button>
            </div>
            {/* JSONBのitemsを配列として描画 */}
            {Array.isArray(o.items) && o.items.length > 0 && (
              <ul style={{ marginLeft: 20 }}>
                {o.items.map((item: any, idx: number) => (
                  <li key={`${o.id}-${idx}`}>
                    {item.name} x {item.quantity} (¥{item.price})
                  </li>
                ))}
              </ul>
            )}
            <small>OrderID: {o.id}</small>
          </li>
        ))}
      </ul>
    </div>
  )
}
