'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

/** メニューアイテム例 */
const MOCK_MENU = [
  { id: 'm1', name: 'コーヒー', price: 300 },
  { id: 'm2', name: '紅茶',   price: 350 },
  { id: 'm3', name: 'ケーキ', price: 500 },
]

export default function CustomerOrder() {
  // テーブル名/番号など
  const [tableName, setTableName] = useState('Table A')

  // カート (メニューID, 名前, 価格, 数量)
  const [cart, setCart] = useState<{ id: string, name: string, price: number, quantity: number }[]>([])

  // カートに追加する処理
  const addToCart = (menuItem: typeof MOCK_MENU[number]) => {
    setCart((prev) => {
      // 既に追加済みならquantityだけ増やす
      const existing = prev.find((item) => item.id === menuItem.id)
      if (existing) {
        return prev.map((item) =>
          item.id === menuItem.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      } else {
        // 新規で1個追加
        return [...prev, { ...menuItem, quantity: 1 }]
      }
    })
  }

  // カートから削除 or 数量を減らすなど
  const removeFromCart = (menuItemId: string) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === menuItemId
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter((item) => item.quantity > 0)
    )
  }

  // 注文確定 (DBにINSERT)
  const submitOrder = async () => {
    // JSONに入れるデータ例
    const orderItems = cart.map((item) => ({
      id: item.id,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
    }))

    const { error } = await supabase.from('orders').insert({
      table_name: tableName,
      status: 'unprovided', // 新規注文ステータス
      items: orderItems     // JSONBカラムに保存
    })

    if (error) {
      alert('注文登録に失敗しました:' + error.message)
      return
    }

    // 成功したらカートをクリア
    setCart([])
    alert('注文を送信しました！')
  }

  // カートの合計金額を計算
  const totalPrice = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

  return (
    <div style={{ border: '1px solid #ccc', padding: 10 }}>
      <h2>お客様側 - メニュー</h2>

      <label>
        テーブル名:
        <input
          type="text"
          value={tableName}
          onChange={(e) => setTableName(e.target.value)}
          style={{ marginLeft: 8 }}
        />
      </label>

      <h3>メニュー一覧</h3>
      {MOCK_MENU.map((menu) => (
        <div key={menu.id} style={{ marginBottom: 8 }}>
          {menu.name} (¥{menu.price})
          <button onClick={() => addToCart(menu)} style={{ marginLeft: 8 }}>
            カートに追加
          </button>
        </div>
      ))}

      <h3>カート内容</h3>
      {cart.length === 0 ? (
        <p>カートが空です</p>
      ) : (
        <ul>
          {cart.map((item) => (
            <li key={item.id}>
              {item.name} x {item.quantity} (¥{item.price * item.quantity})
              <button onClick={() => removeFromCart(item.id)} style={{ marginLeft: 8 }}>
                -1
              </button>
            </li>
          ))}
        </ul>
      )}
      <p>合計: ¥{totalPrice}</p>
      <button onClick={submitOrder} disabled={cart.length === 0}>
        注文確定
      </button>
    </div>
  )
}
