'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type OrderItem = {
  id: string
  name: string
  price: number
  quantity: number
}

type Order = {
  id: string
  table_name: string | null
  status: string | null
  created_at: string | null
  items: OrderItem[]
}

export default function StaffPage() {
  const [orders, setOrders] = useState<Order[]>([])

  // 初回ロード or イベント後に一覧を取得
  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      return
    }
    setOrders(data as Order[])
  }

  // 新規注文(INSERT)購読
  useEffect(() => {
    fetchOrders()

    // ordersテーブルのINSERTだけ監視
    const channel = supabase
      .channel('orders-ch') 
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          console.log('New order arrived:', payload.new)

          // 音を鳴らす (スタッフ端末のみ)
          const audio = new Audio('/sounds/notify.mp3')
          audio.play().catch(err => console.warn("Audio blocked:", err))

          // リストを更新
          fetchOrders()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // ステータス更新 (例: provided, paid)
  const updateStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId)

    if (error) console.error('Update error:', error)
  }

  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">スタッフ用 - 注文一覧</h1>

      {orders.length === 0 ? (
        <p>まだ注文はありません</p>
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <div key={o.id} className="border p-2 rounded">
              <div className="flex justify-between">
                <div>Table: {o.table_name}</div>
                <StatusBadge status={o.status || ''} />
              </div>
              {/* 商品一覧 */}
              {o.items && o.items.length > 0 ? (
                <table className="w-full text-sm mt-2">
                  <thead>
                    <tr className="border-b">
                      <th>商品名</th>
                      <th className="text-right">数量</th>
                      <th className="text-right">価格</th>
                    </tr>
                  </thead>
                  <tbody>
                    {o.items.map((item, idx) => (
                      <tr key={idx} className="border-b">
                        <td>{item.name}</td>
                        <td className="text-right">{item.quantity}</td>
                        <td className="text-right">¥{item.price}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-gray-600 mt-2">No items</p>
              )}
              {/* ステータス変更 */}
              <div className="mt-2 space-x-2">
                {o.status !== 'provided' && (
                  <button
                    onClick={() => updateStatus(o.id, 'provided')}
                    className="px-2 py-1 bg-blue-500 text-white rounded"
                  >
                    提供完了
                  </button>
                )}
                {o.status !== 'paid' && (
                  <button
                    onClick={() => updateStatus(o.id, 'paid')}
                    className="px-2 py-1 bg-green-600 text-white rounded"
                  >
                    お会計済み
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

// ステータスバッジ用
function StatusBadge({ status }: { status: string }) {
  let color = 'bg-gray-400'
  let label = status
  switch (status) {
    case 'unprovided':
      color = 'bg-red-500'; label = '未提供'; break
    case 'provided':
      color = 'bg-blue-500'; label = '提供済み'; break
    case 'paid':
      color = 'bg-green-500'; label = '会計済み'; break
  }

  return (
    <span className={`px-2 py-1 text-white rounded ${color}`}>
      {label}
    </span>
  )
}
