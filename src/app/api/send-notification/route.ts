import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// -------------------------------
// 環境変数をもとにしたFirebase Admin初期化
// -------------------------------
const firebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
};

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

// -------------------------------
// メインの POST ハンドラ
// -------------------------------
export async function POST(req: NextRequest) {
  try {
    console.log('Checking Firebase Config:', {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
    });

    if (!process.env.FIREBASE_PROJECT_ID) {
      throw new Error('Missing FIREBASE_PROJECT_ID');
    }
    if (!process.env.FIREBASE_CLIENT_EMAIL) {
      throw new Error('Missing FIREBASE_CLIENT_EMAIL');
    }
    if (!process.env.FIREBASE_PRIVATE_KEY) {
      throw new Error('Missing FIREBASE_PRIVATE_KEY');
    }

    console.log('Initializing Firebase Admin...');
    initializeFirebaseAdmin();
    console.log('Firebase Admin initialized successfully');

    // リクエスト Body から orderId を取得
    const body = await req.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: 'orderId is required' },
        { status: 400 }
      );
    }

    // -------------------------------
    // 注文情報を取得
    // -------------------------------
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
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // -------------------------------
    // 全POS端末の FCMトークンを取得
    // -------------------------------
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

    // -------------------------------
    // 重複トークンの排除
    // -------------------------------
    const uniqueTokens = [...new Set(posDevices.map((d) => d.fcm_token))];

    // -------------------------------
    // FCMメッセージの共通部分
    // -------------------------------
    const messageBase = {
      // data フィールド: アプリ側(onMessageなど)で取り出すカスタムデータ
      data: {
        orderId: order.id,
        tableName: order.table_name || '',
        status: order.status || '',
        // itemsをJSON文字列化
        items: JSON.stringify(order.items || []),
      },
      notification: {
        // iOS/Android両対応の「タイトル・本文」
        title: '新しい注文',
        body: `${order.table_name}から注文が入りました`,
        // ※ ここでは sound は指定しない (Androidと衝突しないようにする)
      },
      android: {
        // Androidの優先度
        priority: 'high' as const,
        // Android通知の詳細設定: チャネルやサウンド名など
        notification: {
          sound: 'notification_sound', // 拡張子なし
          channelId: 'orders',
        },
      },
      apns: {
        // iOS向け APNs ペイロード
        payload: {
          aps: {
            // iOS バックグラウンドで鳴らしたいカスタム音ファイル (拡張子つき)
            // 例: ios/Runner/notification_sound.mp3 を Xcodeで Copy Bundle Resource に登録
            sound: 'notification_sound.mp3',
          },
        },
      },
    };

    // -------------------------------
    // 各トークンに対して送信
    // -------------------------------
    const sendResults = await Promise.allSettled(
      uniqueTokens.map(async (token) => {
        if (!token) return null;
        const message = { ...messageBase, token };
        return getMessaging().send(message);
      })
    );

    // 成功・失敗カウント
    const successCount = sendResults.filter(
      (r) => r.status === 'fulfilled' && r.value
    ).length;
    const failureCount = sendResults.length - successCount;

    return NextResponse.json({
      success: true,
      summary: {
        total: sendResults.length,
        successful: successCount,
        failed: failureCount,
      },
    });
  } catch (error: any) {
    console.error('Notification error:', error);
    return NextResponse.json(
      {
        error: error.message || 'Internal server error',
        details:
          process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}