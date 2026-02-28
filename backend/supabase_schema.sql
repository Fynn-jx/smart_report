-- ============================================
-- 中国人民银行智能公文系统 - Supabase 数据库表结构
-- ============================================

-- ============= 1. 转换记录表 =============
CREATE TABLE IF NOT EXISTS conversion_records (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL DEFAULT 'default',
    task_type VARCHAR(50) NOT NULL,

    -- 输入文件信息
    input_file_name VARCHAR(500) NOT NULL,
    input_file_id VARCHAR(200),

    -- 参考文件信息
    reference_file_name VARCHAR(500),
    reference_file_id VARCHAR(200),

    -- 输出结果
    output_url TEXT,
    output_content TEXT,

    -- 状态
    status VARCHAR(20) DEFAULT 'processing',  -- processing, completed, error

    -- 额外参数（JSON字符串）
    extra_params TEXT,

    -- 错误信息
    error_message TEXT,

    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_conversion_user_id ON conversion_records(user_id);
CREATE INDEX IF NOT EXISTS idx_conversion_task_type ON conversion_records(task_type);
CREATE INDEX IF NOT EXISTS idx_conversion_status ON conversion_records(status);
CREATE INDEX IF NOT EXISTS idx_conversion_created_at ON conversion_records(created_at DESC);


-- ============= 2. 用户反馈表 =============
CREATE TABLE IF NOT EXISTS feedbacks (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL DEFAULT 'default',

    -- 反馈内容
    feedback_type VARCHAR(20) NOT NULL,  -- issue, suggestion, other
    content TEXT NOT NULL,

    -- 联系方式
    contact VARCHAR(200),

    -- 状态
    status VARCHAR(20) DEFAULT 'pending',  -- pending, reviewed, resolved

    -- 管理员回复
    admin_reply TEXT,
    admin_reply_at TIMESTAMP WITH TIME ZONE,

    -- 时间戳
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON feedbacks(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedbacks(feedback_type);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedbacks(status);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedbacks(created_at DESC);


-- ============= 3. 启用行级安全策略（RLS）============
ALTER TABLE conversion_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedbacks ENABLE ROW LEVEL SECURITY;


-- ============= 4. 创建安全策略 =============

-- conversion_records 表策略
-- 允许所有用户读取和插入自己的记录
CREATE POLICY "Users can view own conversions"
    ON conversion_records FOR SELECT
    USING (user_id = current_setting('app.current_user_id', true) OR user_id = 'default');

CREATE POLICY "Users can insert own conversions"
    ON conversion_records FOR INSERT
    WITH CHECK (user_id = current_setting('app.current_user_id', true) OR user_id = 'default');

-- 允许所有用户更新记录（用于更新状态）
CREATE POLICY "Users can update own conversions"
    ON conversion_records FOR UPDATE
    USING (user_id = current_setting('app.current_user_id', true) OR user_id = 'default');

-- feedbacks 表策略
-- 允许所有用户插入反馈
CREATE POLICY "Anyone can insert feedback"
    ON feedbacks FOR INSERT
    WITH CHECK (true);

-- 允许所有用户读取反馈
CREATE POLICY "Anyone can view feedbacks"
    ON feedbacks FOR SELECT
    USING (true);

-- 允许更新反馈（管理员功能）
CREATE POLICY "Anyone can update feedbacks"
    ON feedbacks FOR UPDATE
    USING (true);


-- ============= 5. 创建视图（便于查询）============

-- 任务类型统计视图
CREATE OR REPLACE VIEW conversion_stats AS
SELECT
    task_type,
    status,
    COUNT(*) as count,
    MAX(created_at) as latest_activity
FROM conversion_records
GROUP BY task_type, status;

-- 反馈统计视图
CREATE OR REPLACE VIEW feedback_stats AS
SELECT
    feedback_type,
    status,
    COUNT(*) as count
FROM feedbacks
GROUP BY feedback_type, status;


-- ============= 6. 添加注释 =============
COMMENT ON TABLE conversion_records IS '文档转换记录表（学术报告转公文、国别报告、图片转译）';
COMMENT ON TABLE feedbacks IS '用户反馈表';

COMMENT ON COLUMN conversion_records.task_type IS '任务类型：academic_convert(学术转公文), academic_translate(文档翻译), country_situation(国别情况报告), country_quarterly(季度报告), image_translate(图片转译)';
COMMENT ON COLUMN conversion_records.status IS '状态：processing(处理中), completed(完成), error(错误)';

COMMENT ON COLUMN feedbacks.feedback_type IS '反馈类型：issue(问题), suggestion(建议), other(其他)';
COMMENT ON COLUMN feedbacks.status IS '状态：pending(待处理), reviewed(已查看), resolved(已解决)';


-- ============= 完成提示 =============
DO $$
BEGIN
    RAISE NOTICE '===========================================';
    RAISE NOTICE '数据库表结构创建完成！';
    RAISE NOTICE '===========================================';
    RAISE NOTICE '已创建的表：';
    RAISE NOTICE '  1. conversion_records (转换记录表)';
    RAISE NOTICE '  2. feedbacks (反馈表)';
    RAISE NOTICE '===========================================';
END $$;
