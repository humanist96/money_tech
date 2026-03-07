import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function setup() {
  console.log('Creating tables...');

  await sql`
    CREATE TABLE IF NOT EXISTS channels (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      youtube_channel_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('stock', 'coin', 'real_estate', 'economy')),
      subscriber_count INTEGER,
      total_view_count BIGINT,
      video_count INTEGER,
      thumbnail_url TEXT,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log('  channels OK');

  await sql`
    CREATE TABLE IF NOT EXISTS videos (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      channel_id UUID REFERENCES channels(id) ON DELETE CASCADE,
      youtube_video_id TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      view_count INTEGER,
      like_count INTEGER,
      comment_count INTEGER,
      duration INTEGER,
      published_at TIMESTAMPTZ,
      thumbnail_url TEXT,
      tags TEXT[],
      subtitle_text TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  console.log('  videos OK');

  await sql`
    CREATE TABLE IF NOT EXISTS daily_stats (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      date DATE NOT NULL,
      category TEXT NOT NULL CHECK (category IN ('stock', 'coin', 'real_estate', 'economy')),
      total_videos INTEGER,
      top_channels JSONB,
      top_keywords JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(date, category)
    )
  `;
  console.log('  daily_stats OK');

  // Indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_channels_category ON channels(category)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_videos_channel_id ON videos(channel_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_videos_published_at ON videos(published_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_videos_youtube_video_id ON videos(youtube_video_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_daily_stats_date ON daily_stats(date DESC)`;
  console.log('  indexes OK');

  console.log('\nSeeding data...');

  // Channels
  const channelRows = [
    ['UCdtRAcd3L_UpV4yEbaehRCg', '삼프로TV', 'stock', 3200000, 1500000000, 5200, '경제 전문 유튜브 채널'],
    ['UCPzEEOm0rOLaCzHPsP2GOHA', '신사임당', 'stock', 2800000, 980000000, 1800, '재테크/자기계발 채널'],
    ['UCsJ6RuBiTVWRX156FVbeaGg', '슈카월드', 'stock', 2500000, 850000000, 1200, '경제/시사 분석 채널'],
    ['UCyhA1SsMIlMrJKhjB7lHNOQ', '김작가TV', 'stock', 1800000, 620000000, 2100, '부동산/경제 채널'],
    ['UCM0crzME48sp3JWiPJJfJOA', '소수몽키', 'stock', 850000, 320000000, 900, '미국주식 전문 채널'],
    ['UCkVrfoxMmh1BPFwmQ_KZHPQ', '주코노미', 'stock', 720000, 280000000, 1500, '한국경제 유튜브'],
    ['UCM9dAomhOTqNjcVMmb5_6Mw', '박곰희TV', 'stock', 650000, 250000000, 800, '투자/재테크 채널'],
    ['UCetCFq6D8vqVDkTLiCRl7Bw', '코인데스크코리아', 'coin', 180000, 45000000, 3200, '암호화폐 뉴스'],
    ['UCWOGeEddFhIPjHpXAQBz0QA', '비트코인100문100답', 'coin', 320000, 98000000, 600, '비트코인 교육'],
    ['UC6r3xBQ9QCYa0T3LIB6DXoA', '블록미디어', 'coin', 150000, 38000000, 2800, '블록체인/암호화폐 뉴스'],
    ['UC4UoG96xCWLJoVxGP2wDLJQ', '코인니스', 'coin', 95000, 22000000, 1500, '실시간 코인 뉴스'],
    ['UCH3UVGBBJpKYBSxwFP8cMRA', '업비트', 'coin', 280000, 75000000, 400, '업비트 공식 채널'],
    ['UCn5HEiGWVsFiKCQe1YdqsJQ', '부읽남', 'real_estate', 1500000, 520000000, 1600, '부동산 분석'],
    ['UCsyTA05CB3eQTkJyxH1O97w', '빠숑', 'real_estate', 980000, 380000000, 1200, '부동산 전문가'],
    ['UCQnGifhZ35ViMPkLh8GF6Iw', '월급쟁이부자들', 'real_estate', 1200000, 450000000, 900, '재테크/부동산'],
    ['UC91PEpKLdUC9S3z1D41M38g', '집코노미', 'real_estate', 420000, 160000000, 2200, '한경 부동산 채널'],
    ['UC0-IxVbR4VRWF-bB_fDKqqg', '렘군', 'real_estate', 680000, 270000000, 1100, '부동산 투자'],
    ['UCThaOciJ1xN4v7mJTcqZDig', '부동산김사부', 'real_estate', 350000, 130000000, 800, '부동산 전문'],
    ['UCS-fVz_pNf_WznG73Jxdoyw', '머니투데이', 'economy', 950000, 420000000, 8500, '경제 뉴스'],
    ['UCzPaR7fc_P-LtVVPWCGaLog', '한경글로벌마켓', 'economy', 780000, 350000000, 4200, '글로벌 경제'],
    ['UCBvf-JmP6WT7xfh1rKp-dgQ', '이진우의손에잡히는경제', 'economy', 620000, 240000000, 1800, 'MBC 경제 팟캐스트'],
    ['UCQbGOTIb_0MFv_LvWj0jTGA', 'KBS시사기획창', 'economy', 450000, 180000000, 1200, 'KBS 시사 프로그램'],
  ];

  for (const [ytId, name, category, subs, views, vcount, desc] of channelRows) {
    await sql`
      INSERT INTO channels (youtube_channel_id, name, category, subscriber_count, total_view_count, video_count, description)
      VALUES (${ytId}, ${name}, ${category}, ${subs}, ${views}, ${vcount}, ${desc})
      ON CONFLICT (youtube_channel_id) DO UPDATE SET
        subscriber_count = EXCLUDED.subscriber_count,
        total_view_count = EXCLUDED.total_view_count,
        video_count = EXCLUDED.video_count
    `;
  }
  console.log('  channels seeded: ' + channelRows.length);

  // Sample videos
  const sampro = await sql`SELECT id FROM channels WHERE youtube_channel_id = 'UCdtRAcd3L_UpV4yEbaehRCg'`;
  const schuka = await sql`SELECT id FROM channels WHERE youtube_channel_id = 'UCsJ6RuBiTVWRX156FVbeaGg'`;
  const coindesk = await sql`SELECT id FROM channels WHERE youtube_channel_id = 'UCetCFq6D8vqVDkTLiCRl7Bw'`;
  const buread = await sql`SELECT id FROM channels WHERE youtube_channel_id = 'UCn5HEiGWVsFiKCQe1YdqsJQ'`;
  const moneytoday = await sql`SELECT id FROM channels WHERE youtube_channel_id = 'UCS-fVz_pNf_WznG73Jxdoyw'`;

  const videoRows = [
    [sampro[0].id, 'sample_stock_01', '2026년 주식시장 전망, 이것만은 알고 투자하세요', 580000, 12000, 3200, 1820, '2 hours', ['주식','2026전망','투자','삼프로TV']],
    [sampro[0].id, 'sample_stock_02', '반도체 슈퍼사이클 온다? SK하이닉스 삼성전자 분석', 420000, 8500, 2100, 2400, '1 day', ['반도체','SK하이닉스','삼성전자','투자']],
    [sampro[0].id, 'sample_stock_03', '금리인하 시작! 수혜주 TOP 5', 350000, 7200, 1800, 1560, '2 days', ['금리','금리인하','수혜주','투자전략']],
    [schuka[0].id, 'sample_stock_04', '미국 경제 진짜 괜찮은걸까? 숨겨진 위험 신호', 920000, 25000, 5400, 1980, '6 hours', ['미국경제','경기침체','분석','슈카']],
    [schuka[0].id, 'sample_stock_05', 'AI 버블인가 혁명인가, 엔비디아의 미래', 780000, 18000, 4200, 2160, '1 day', ['AI','엔비디아','GPU','테크주']],
    [coindesk[0].id, 'sample_coin_01', '비트코인 15만달러 돌파 가능성, 온체인 데이터 분석', 125000, 3200, 890, 1440, '3 hours', ['비트코인','BTC','온체인','가격전망']],
    [coindesk[0].id, 'sample_coin_02', '이더리움 ETF 승인 이후 기관 자금 유입 현황', 98000, 2800, 650, 1200, '1 day', ['이더리움','ETF','기관투자','암호화폐']],
    [buread[0].id, 'sample_re_01', '서울 아파트 가격, 2026년 하반기 전망은?', 380000, 9500, 4200, 2700, '4 hours', ['서울아파트','부동산전망','집값','투자']],
    [buread[0].id, 'sample_re_02', '전세사기 예방법 총정리, 이것만 확인하세요', 520000, 15000, 6800, 1800, '2 days', ['전세사기','전세','부동산','예방법']],
    [moneytoday[0].id, 'sample_econ_01', '환율 1300원 붕괴, 수출기업 영향과 투자전략', 210000, 5200, 1500, 960, '5 hours', ['환율','원달러','수출','경제']],
    [moneytoday[0].id, 'sample_econ_02', '한국은행 기준금리 동결, 다음 인하 시점은?', 185000, 4800, 1200, 840, '1 day', ['기준금리','한국은행','금리동결','통화정책']],
  ];

  for (const [chId, ytVid, title, views, likes, comments, dur, ago, tags] of videoRows) {
    await sql`
      INSERT INTO videos (channel_id, youtube_video_id, title, view_count, like_count, comment_count, duration, published_at, tags)
      VALUES (${chId}, ${ytVid}, ${title}, ${views}, ${likes}, ${comments}, ${dur}, NOW() - ${ago}::interval, ${tags})
      ON CONFLICT (youtube_video_id) DO NOTHING
    `;
  }
  console.log('  videos seeded: ' + videoRows.length);

  // Daily stats (last 7 days)
  for (let i = 0; i < 7; i++) {
    const categories = [
      { cat: 'stock', vids: 8 + Math.floor(Math.random() * 5),
        channels: [{"channel_name":"삼프로TV","video_count":3,"total_views":1350000},{"channel_name":"슈카월드","video_count":2,"total_views":1700000}],
        keywords: [{"keyword":"주식","count":12},{"keyword":"투자","count":10},{"keyword":"반도체","count":8},{"keyword":"AI","count":7},{"keyword":"금리","count":6},{"keyword":"삼성전자","count":5},{"keyword":"미국주식","count":4},{"keyword":"배당","count":3}]
      },
      { cat: 'coin', vids: 4 + Math.floor(Math.random() * 3),
        channels: [{"channel_name":"코인데스크코리아","video_count":2,"total_views":223000},{"channel_name":"업비트","video_count":1,"total_views":85000}],
        keywords: [{"keyword":"비트코인","count":8},{"keyword":"이더리움","count":5},{"keyword":"ETF","count":4},{"keyword":"알트코인","count":3},{"keyword":"온체인","count":3}]
      },
      { cat: 'real_estate', vids: 5 + Math.floor(Math.random() * 4),
        channels: [{"channel_name":"부읽남","video_count":2,"total_views":900000},{"channel_name":"월급쟁이부자들","video_count":2,"total_views":650000}],
        keywords: [{"keyword":"아파트","count":10},{"keyword":"전세","count":7},{"keyword":"서울","count":6},{"keyword":"분양","count":5},{"keyword":"재건축","count":4},{"keyword":"집값","count":4}]
      },
      { cat: 'economy', vids: 6 + Math.floor(Math.random() * 4),
        channels: [{"channel_name":"머니투데이","video_count":4,"total_views":395000},{"channel_name":"한경글로벌마켓","video_count":3,"total_views":280000}],
        keywords: [{"keyword":"경제","count":9},{"keyword":"환율","count":6},{"keyword":"금리","count":5},{"keyword":"인플레이션","count":4},{"keyword":"GDP","count":3}]
      },
    ];

    for (const { cat, vids, channels, keywords } of categories) {
      await sql`
        INSERT INTO daily_stats (date, category, total_videos, top_channels, top_keywords)
        VALUES (CURRENT_DATE - ${i}::integer, ${cat}, ${vids}, ${JSON.stringify(channels)}::jsonb, ${JSON.stringify(keywords)}::jsonb)
        ON CONFLICT (date, category) DO UPDATE SET
          total_videos = EXCLUDED.total_videos,
          top_channels = EXCLUDED.top_channels,
          top_keywords = EXCLUDED.top_keywords
      `;
    }
  }
  console.log('  daily_stats seeded: 28 rows (7 days x 4 categories)');

  console.log('\nSetup complete!');
}

setup().catch(console.error);
