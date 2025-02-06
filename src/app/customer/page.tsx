'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import Image from 'next/image'

type MenuItem = {
  id: string
  name: string
  price: number
  imageUrl?: string
}

const MOCK_MENU: MenuItem[] = [
  { id: 'm1', name: 'コーヒー', price: 300, imageUrl: '/coffee.jpg' },
  { id: 'm2', name: '紅茶',   price: 350, imageUrl: '/tea.jpg' },
  { id: 'm3', name: 'ケーキ', price: 500, imageUrl: '/cake.jpg' },
]

export default function CustomerPage() {
  const [tableName, setTableName] = useState('Table A')
  const [cart, setCart] = useState<{ id: string; name: string; price: number; quantity: number }[]>([])

  // メニューをカートに追加
  const addToCart = (menu: MenuItem) => {
    setCart((prev) => {
      const found = prev.find((item) => item.id === menu.id)
      if (found) {
        return prev.map((item) =>
          item.id === menu.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      } else {
        return [...prev, { ...menu, quantity: 1 }]
      }
    })
  }

  // カートから1つ減らす
  const removeFromCart = (id: string) => {
    setCart((prev) =>
      prev
        .map((item) => item.id === id ? { ...item, quantity: item.quantity - 1 } : item)
        .filter((item) => item.quantity > 0)
    )
  }

  // 注文送信（ordersテーブルにINSERT）
  const submitOrder = async () => {
    if (!cart.length) return
    const items = cart.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity
    }))

    const { error } = await supabase.from('orders').insert({
      table_name: tableName,
      status: 'unprovided',
      items: items,
    })
    if (error) {
      alert('注文送信に失敗: ' + error.message)
      return
    }

    alert('注文を送信しました！')
    setCart([])
  }

  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

  return (
    <main className="p-4">
      <h1 className="text-2xl font-bold mb-4">お客様用 - 注文画面</h1>

      <label className="block mb-2">
        テーブル名:
        <input
          type="text"
          value={tableName}
          onChange={(e) => setTableName(e.target.value)}
          className="border ml-2"
        />
      </label>

      <h2 className="text-xl mt-4">メニュー</h2>
      <div className="grid grid-cols-3 gap-4 mt-2">
        {MOCK_MENU.map((m) => (
          <div key={m.id} className="border p-2 flex flex-col items-center">
            {m.imageUrl ? (
              <Image src={m.imageUrl} alt={m.name} width={80} height={80} />
            ) : (
              <div className="w-20 h-20 bg-gray-200" />
            )}
            <p>{m.name} (¥{m.price})</p>
            <button
              onClick={() => addToCart(m)}
              className="mt-1 px-2 py-1 bg-blue-500 text-white"
            >
              カートに追加
            </button>
          </div>
        ))}
      </div>

      <h2 className="text-xl mt-4">カート</h2>
      {cart.length === 0 ? (
        <p>カートが空です</p>
      ) : (
        <table className="mt-2 w-full text-sm">
          <thead>
            <tr className="border-b">
              <th>商品名</th>
              <th>数量</th>
              <th>小計</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cart.map((c) => (
              <tr key={c.id} className="border-b">
                <td>{c.name}</td>
                <td className="text-right">{c.quantity}</td>
                <td className="text-right">¥{c.price * c.quantity}</td>
                <td>
                  <button onClick={() => removeFromCart(c.id)} className="ml-2 text-red-500">
                    -1
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="text-right mt-2">
        <p>合計: ¥{totalPrice}</p>
        <button
          onClick={submitOrder}
          disabled={cart.length === 0}
          className="mt-2 px-4 py-2 bg-green-600 text-white"
        >
          注文確定
        </button>
      </div>
    </main>
  )
}
