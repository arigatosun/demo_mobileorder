"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import Image from "next/image";

type MenuItem = {
  id: string;
  name: string;
  price: number;
  imageUrl?: string;
};

type CartItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
};

// デモ用のメニュー
const MOCK_MENU: MenuItem[] = [
  { id: "m1", name: "コーヒー", price: 300, imageUrl: "/coffee.jpg" },
  { id: "m2", name: "紅茶", price: 350, imageUrl: "/tea.jpg" },
  { id: "m3", name: "ケーキ", price: 500, imageUrl: "/cake.jpg" },
];

type Order = {
  id: string;
  table_name: string | null;
  status: string | null;
  created_at: string | null;
  items: CartItem[]; // ここでは配列を受け取り
};

export default function HomePage() {
  const [isClient, setIsClient] = useState<boolean>(false);

  // ① お客様(注文)側
  const [tableName, setTableName] = useState<string>("Table A");
  const [cart, setCart] = useState<CartItem[]>([]);

  // カートに追加
  const addToCart = (menu: MenuItem) => {
    setCart((prev) => {
      const found = prev.find((item) => item.id === menu.id);
      if (found) {
        return prev.map((item) =>
          item.id === menu.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prev, { ...menu, quantity: 1 }];
      }
    });
  };

  // カートから1つ減らす or 削除
  const removeFromCart = (id: string) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === id ? { ...item, quantity: item.quantity - 1 } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  // 注文をINSERT
  const submitOrder = async () => {
    if (!cart.length) return;

    try {
      const { data, error } = await supabase
        .from("orders")
        .insert({
          table_name: tableName,
          status: "unprovided", // 注文全体のステータス（必要に応じて）
          items: cart.map((item) => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity,
            // ここで「商品ごとのステータス」を付与
            status: "unprovided",
          })),
        })
        .select()
        .single();

      if (error) throw new Error(`Order error: ${error.message}`);
      if (!data) throw new Error("No data returned from order creation");

      // 新規注文INSERTが完了したら通知APIを呼び出し、スタッフにプッシュ通知を送る
      const notificationResponse = await fetch("/api/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: data.id }),
      });

      if (!notificationResponse.ok) {
        const errorData = await notificationResponse.json();
        throw new Error(`Notification error: ${errorData.error}`);
      }

      setCart([]);
      alert("注文が完了しました！");
    } catch (error: any) {
      console.error("Error:", error);
      alert(`エラーが発生しました: ${error.message}`);
    }
  };

  const totalPrice = cart.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0
  );

  // ② スタッフ(受注)側 (簡易デモ表示)
  const [orders, setOrders] = useState<Order[]>([]);

  // ordersテーブルの取得
  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setOrders(data as Order[]);
    } catch (error) {
      console.error("fetchOrders Error:", error);
    }
  };

  // ステータスを更新（従来の全体ステータス用）
  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("orders")
        .update({ status: newStatus })
        .eq("id", id);
      if (error) throw error;
      await fetchOrders();
    } catch (error) {
      console.error("updateStatus Error:", error);
    }
  };

  // 初期化 & リアルタイム購読
  useEffect(() => {
    setIsClient(true);

    const setupSubscription = async () => {
      try {
        await fetchOrders();
        const channel = supabase
          .channel("orders-realtime")
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "orders" },
            async (payload) => {
              console.log("Realtime change:", payload);
              await fetchOrders();
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      } catch (error) {
        console.error("Subscription setup error:", error);
      }
    };

    setupSubscription();
  }, []);

  // CSR完了まではローディング
  if (!isClient) {
    return (
      <main className="min-h-screen p-6 bg-gray-50">
        <div className="flex items-center justify-center h-screen">
          <div className="text-lg">読み込み中...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-6 bg-gray-50">
      <h1 className="text-2xl font-bold mb-4">Demo: Order System</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ▼ 左カラム: お客様UI ▼ */}
        <div className="bg-white rounded shadow p-4">
          <h2 className="text-xl font-semibold mb-4">お客様側 (注文)</h2>

          {/* テーブル名入力 */}
          <div className="mb-3">
            <label className="block mb-1 font-medium">テーブル名</label>
            <input
              type="text"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              className="border border-gray-300 rounded px-2 py-1 w-full"
            />
          </div>

          {/* メニュー一覧 */}
          <h3 className="text-lg font-medium mt-4">メニュー</h3>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {MOCK_MENU.map((menu) => (
              <div
                key={menu.id}
                className="flex flex-col items-center p-2 border rounded hover:bg-gray-100 transition"
              >
                {menu.imageUrl ? (
                  <Image
                    src={menu.imageUrl}
                    alt={menu.name}
                    width={80}
                    height={80}
                    className="object-cover mb-1"
                  />
                ) : (
                  <div className="w-20 h-20 bg-gray-200 mb-1" />
                )}
                <div className="text-center">
                  <p>{menu.name}</p>
                  <p>¥{menu.price}</p>
                </div>
                <button
                  onClick={() => addToCart(menu)}
                  className="mt-1 px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  カートに追加
                </button>
              </div>
            ))}
          </div>

          {/* カート */}
          <h3 className="text-lg font-medium mt-4">カート</h3>
          {cart.length === 0 ? (
            <p className="text-gray-500">カートが空です</p>
          ) : (
            <table className="w-full mt-2 text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1">商品名</th>
                  <th className="text-right py-1">数量</th>
                  <th className="text-right py-1">小計</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cart.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="py-1">{item.name}</td>
                    <td className="text-right py-1">{item.quantity}</td>
                    <td className="text-right py-1">
                      ¥{item.price * item.quantity}
                    </td>
                    <td>
                      <button
                        onClick={() => removeFromCart(item.id)}
                        className="text-red-500 ml-2"
                      >
                        -1
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="mt-2 text-right font-semibold">
            合計: ¥{totalPrice}
          </div>
          <div className="mt-3 text-right">
            <button
              onClick={submitOrder}
              disabled={cart.length === 0}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              注文確定
            </button>
          </div>
        </div>

        {/* ▼ 右カラム: スタッフUI ▼ */}
        <div className="bg-white rounded shadow p-4">
          <h2 className="text-xl font-semibold mb-4">スタッフ側 (注文一覧)</h2>

          {orders.length === 0 ? (
            <p className="text-gray-500">まだ注文はありません</p>
          ) : (
            <div className="flex flex-col gap-4">
              {orders.map((o) => (
                <div
                  key={o.id}
                  className="border rounded p-3 hover:bg-gray-50 transition"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">Table:</span> {o.table_name}
                    </div>
                    <div>
                      <StatusBadge status={o.status || ""} />
                    </div>
                  </div>

                  <div className="mt-2">
                    {Array.isArray(o.items) && o.items.length > 0 ? (
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-1">商品名</th>
                            <th className="text-right py-1">数量</th>
                            <th className="text-right py-1">価格</th>
                          </tr>
                        </thead>
                        <tbody>
                          {o.items.map((item, idx) => (
                            <tr key={`${o.id}-${idx}`} className="border-b">
                              <td className="py-1">{item.name}</td>
                              <td className="text-right py-1">{item.quantity}</td>
                              <td className="text-right py-1">¥{item.price}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <p className="text-gray-500">No Items</p>
                    )}
                  </div>

                  <div className="mt-3 space-x-2">
                    {o.status !== "provided" && (
                      <button
                        onClick={() => updateStatus(o.id, "provided")}
                        className="px-2 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        提供完了
                      </button>
                    )}
                    {o.status !== "paid" && (
                      <button
                        onClick={() => updateStatus(o.id, "paid")}
                        className="px-2 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                      >
                        お会計済み
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

/**
 * ステータス表示用バッジコンポーネント
 */
function StatusBadge({ status }: { status: string }) {
  let colorClass = "bg-gray-300";
  let text = status;

  switch (status) {
    case "unprovided":
      colorClass = "bg-red-500";
      text = "未提供";
      break;
    case "provided":
      colorClass = "bg-blue-500";
      text = "提供済み";
      break;
    case "paid":
      colorClass = "bg-green-500";
      text = "会計済み";
      break;
    default:
      colorClass = "bg-gray-400";
      text = status || "不明";
  }

  return (
    <span className={`text-white px-2 py-1 rounded text-sm ${colorClass}`}>
      {text}
    </span>
  );
}
