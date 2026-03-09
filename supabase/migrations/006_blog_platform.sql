-- Add platform support for Naver Blog (and future platforms)

-- channels 테이블에 platform 및 blog 필드 추가
ALTER TABLE channels ADD COLUMN IF NOT EXISTS platform VARCHAR(20) DEFAULT 'youtube';
ALTER TABLE channels ADD COLUMN IF NOT EXISTS blog_id VARCHAR(100);
ALTER TABLE channels ADD COLUMN IF NOT EXISTS blog_url VARCHAR(500);

-- youtube_channel_id를 NULL 허용 (블로거는 blog_id 사용)
ALTER TABLE channels ALTER COLUMN youtube_channel_id DROP NOT NULL;

-- UNIQUE 제약조건 유지하되 NULL 허용 (PostgreSQL은 NULL 중복 허용)
-- blog_id에도 유니크 인덱스 추가
CREATE UNIQUE INDEX IF NOT EXISTS idx_channels_blog_id ON channels(blog_id) WHERE blog_id IS NOT NULL;

-- platform 인덱스
CREATE INDEX IF NOT EXISTS idx_channels_platform ON channels(platform);

-- videos 테이블에 platform 및 blog 필드 추가
ALTER TABLE videos ADD COLUMN IF NOT EXISTS platform VARCHAR(20) DEFAULT 'youtube';
ALTER TABLE videos ADD COLUMN IF NOT EXISTS blog_post_url VARCHAR(500);
ALTER TABLE videos ADD COLUMN IF NOT EXISTS content_text TEXT;

-- youtube_video_id를 NULL 허용 (블로그 포스트는 blog_post_url 사용)
ALTER TABLE videos ALTER COLUMN youtube_video_id DROP NOT NULL;

-- blog_post_url 유니크 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS idx_videos_blog_post_url ON videos(blog_post_url) WHERE blog_post_url IS NOT NULL;

-- platform 인덱스
CREATE INDEX IF NOT EXISTS idx_videos_platform ON videos(platform);

-- videos 테이블의 sentiment 필드 (없으면 추가)
ALTER TABLE videos ADD COLUMN IF NOT EXISTS sentiment VARCHAR(20);
