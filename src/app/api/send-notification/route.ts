// src/app/api/send-notification/route.ts
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// credential情報はすべて環境変数から読み込む
const firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

// Firebase Admin初期化を関数化
function initializeFirebaseAdmin() {
  if (!getApps().length) {
    try {
      initializeApp({
        credential: cert(firebaseConfig),
      });
    } catch (error) {
      console.error('Firebase initialization error:', error);
      throw error;
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    // デバッグログを追加
    console.log('Checking Firebase Config:', {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
    });

    // Firebase設定の存在確認を詳細に
    if (!process.env.FIREBASE_PROJECT_ID) {
      throw new Error('Missing FIREBASE_PROJECT_ID');
    }
    if (!process.env.FIREBASE_CLIENT_EMAIL) {
      throw new Error('Missing FIREBASE_CLIENT_EMAIL');
    }
    if (!process.env.FIREBASE_PRIVATE_KEY) {
      throw new Error('Missing FIREBASE_PRIVATE_KEY');
    }

    // Firebase Admin初期化のデバッグ
    console.log('Initializing Firebase Admin...');
    initializeFirebaseAdmin();
    console.log('Firebase Admin initialized successfully');

    const body = await req.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: 'orderId is required' },
        { status: 400 }
      );
    }

    // Supabaseから注文情報を取得
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError) {
      console.error('Order fetch error:', orderError);
      return NextResponse.json(
        { error: `Failed to fetch order: ${orderError.message}` },
        { status: 500 }
      );
    }

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // 全てのPOSデバイスのFCMトークンを取得
    const { data: posDevices, error: tokenError } = await supabaseAdmin
      .from('pos_devices')
      .select('fcm_token')
      .order('created_at', { ascending: false });

    if (tokenError) {
      console.error('Token fetch error:', tokenError);
      return NextResponse.json(
        { error: `Failed to fetch FCM tokens: ${tokenError.message}` },
        { status: 500 }
      );
    }

    if (!posDevices || posDevices.length === 0) {
      return NextResponse.json(
        { error: 'No POS devices found' },
        { status: 404 }
      );
    }

    // 各デバイスに通知を送信
    const sendResults = await Promise.allSettled(
      posDevices.map(async (device) => {
        if (!device.fcm_token) return null;

        const message = {
          data: {
            orderId: order.id,
            tableName: order.table_name || '',
            status: order.status || '',
            items: JSON.stringify(order.items || []),
          },
          notification: {
            title: "新しい注文",
            body: `${order.table_name}から注文が入りました`,
          },
          android: {
            priority: "high" as const,
            notification: {
              sound: "default",
              channelId: "orders"
            }
          },
          token: device.fcm_token,
        };

        return getMessaging().send(message);
      })
    );

    // 送信結果の集計
    const successCount = sendResults.filter(
      result => result.status === 'fulfilled' && result.value
    ).length;
    const failureCount = sendResults.length - successCount;

    // 結果を返す
    return NextResponse.json({
      success: true,
      summary: {
        total: sendResults.length,
        successful: successCount,
        failed: failureCount,
      }
    });

  } catch (error: any) {
    console.error('Notification error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}